// Package main 是 mimo-music 接口调试 CLI 工具 musicctl。
//
// 直连 engine + endpoint 声明,不经 gRPC/gateway,用于手动验证各网易云接口的
// path/crypto/响应映射是否正确。出错栈最短,定位最快。
//
// 用法:
//
//	go run cmd/musicctl/main.go <command> [flags]
//
// 登录态接口需先扫码:
//
//	go run cmd/musicctl/main.go login   # 扫码登录,cookie 持久化到 ~/.musicctl/session.json
//	go run cmd/musicctl/main.go like --id 347230 --on
//	go run cmd/musicctl/main.go logout  # 登出并删除本地会话
//
// 环境变量 NETEASE_COOKIE 优先级高于本地会话文件,可用于临时换号调试。
package main

import (
	"bufio"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	qrcode "github.com/skip2/go-qrcode"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/cache"
	albumendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/album"
	artistendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/artist"
	authendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/auth"
	fmendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/fm"
	playlistendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/playlist"
	recommendendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/recommend"
	searchendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/search"
	songendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/song"
	userendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/user"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/model"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

// eng 是全局 engine 单例(无缓存、无 session 池,纯转发到网易云)。
var eng = engine.New(engine.WithCache(cache.Noop{}))

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}

	cmd := os.Args[1]
	args := os.Args[2:]

	switch cmd {
	// --- 登录 ---
	case "login":
		runLogin()

	// --- 歌曲(匿名) ---
	case "song-detail":
		id := songIDFlag(args)
		exec("song-detail", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, songendpoint.Detail, &mmpb.GetSongDetailRequest{SongId: id})
			exitOnErr(err)
			printJSON(resp)
		})
	case "song-url":
		fs := newFlagSet(args)
		id := fs.Int64("id", 0, "歌曲 ID")
		level := fs.Int("level", 1, "音质: 1=standard 2=exhigh 3=lossless 4=hires")
		fs.Parse()
		exec("song-url", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, songendpoint.URL, &mmpb.GetSongURLRequest{SongId: *id, Level: mmpb.SongLevel(*level)})
			exitOnErr(err)
			printJSON(resp)
		})
	case "lyric":
		id := songIDFlag(args)
		exec("lyric", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, songendpoint.Lyric, &mmpb.GetLyricRequest{SongId: id})
			exitOnErr(err)
			printJSON(resp)
		})
	case "word-lyric":
		id := songIDFlag(args)
		exec("word-lyric", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, songendpoint.WordLyricEP, &mmpb.GetWordLyricRequest{SongId: id})
			exitOnErr(err)
			printJSON(resp)
		})
	case "check-available":
		id := songIDFlag(args)
		exec("check-available", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, songendpoint.CheckAvailable, &mmpb.CheckAvailableRequest{SongId: id})
			exitOnErr(err)
			printJSON(resp)
		})
	case "quality-detail":
		id := songIDFlag(args)
		execEapi("quality-detail", songendpoint.QualityDetail, func() *mmpb.QualityDetailRequest {
			return &mmpb.QualityDetailRequest{SongId: id}
		})
	case "like-count":
		id := songIDFlag(args)
		execEapi("like-count", songendpoint.LikeCount, func() *mmpb.LikeCountRequest {
			return &mmpb.LikeCountRequest{SongId: id}
		})
	case "dynamic-cover":
		id := songIDFlag(args)
		execEapi("dynamic-cover", songendpoint.DynamicCover, func() *mmpb.DynamicCoverRequest {
			return &mmpb.DynamicCoverRequest{SongId: id}
		})
	case "chorus-time":
		id := songIDFlag(args)
		execEapi("chorus-time", songendpoint.ChorusTime, func() *mmpb.ChorusTimeRequest {
			return &mmpb.ChorusTimeRequest{SongId: id}
		})
	case "creator-info":
		id := songIDFlag(args)
		execEapi("creator-info", songendpoint.CreatorInfo, func() *mmpb.CreatorInfoRequest {
			return &mmpb.CreatorInfoRequest{SongId: id}
		})
	case "similar-songs":
		id := songIDFlag(args)
		exec("similar-songs", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, songendpoint.SimilarSongs, &mmpb.SimilarSongsRequest{SongId: id})
			exitOnErr(err)
			printJSON(resp)
		})

	// --- 歌曲(登录态) ---
	case "like":
		fs := newFlagSet(args)
		id := fs.Int64("id", 0, "歌曲 ID")
		on := fs.Bool("on", false, "红心(true)/取消(false)")
		fs.Parse()
		requireCookie()
		confirmWrite(fmt.Sprintf("对歌曲 %d %s", *id, ternary(*on, "点红心", "取消红心")))
		exec("like", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, songendpoint.Like, &mmpb.LikeRequest{SongId: *id, Like: *on})
			exitOnErr(err)
			printJSON(resp)
		})
	case "trash":
		id := songIDFlag(args)
		requireCookie()
		confirmWrite(fmt.Sprintf("把歌曲 %d 丢进垃圾桶(降推荐权重)", id))
		exec("trash", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, songendpoint.Trash, &mmpb.TrashRequest{SongId: id})
			exitOnErr(err)
			printJSON(resp)
		})
	case "disallow-recommend":
		id := songIDFlag(args)
		requireCookie()
		confirmWrite(fmt.Sprintf("标记歌曲 %d 不感兴趣(影响日推)", id))
		exec("disallow-recommend", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, songendpoint.DisallowRecommend, &mmpb.DisallowRecommendRequest{SongId: id})
			exitOnErr(err)
			printJSON(resp)
		})
	case "liked-list":
		fs := newFlagSet(args)
		uid := fs.Int64("uid", 0, "用户 ID")
		fs.Parse()
		requireCookie()
		exec("liked-list", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, songendpoint.LikedList, &mmpb.LikedListRequest{UserId: *uid})
			exitOnErr(err)
			printJSON(resp)
		})
	case "is-like":
		id := songIDFlag(args)
		requireCookie()
		exec("is-like", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, songendpoint.IsLike, &mmpb.IsLikeRequest{SongId: id})
			exitOnErr(err)
			printJSON(resp)
		})

	// --- 专辑 ---
	case "new-album-shelf":
		fs := newFlagSet(args)
		areaStr := albumAreaFlag(fs)
		limit := fs.Int("limit", 10, "返回数量")
		fs.Parse()
		area := strToArea(*areaStr)
		exec("new-album-shelf", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, albumendpoint.NewAlbumShelf, &mmpb.NewAlbumShelfRequest{Area: area, Limit: int32(*limit)})
			exitOnErr(err)
			printJSON(resp)
		})
	case "newest-albums":
		exec("newest-albums", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, albumendpoint.NewestAlbums, &mmpb.NewestAlbumsRequest{})
			exitOnErr(err)
			printJSON(resp)
		})
	case "all-new-albums":
		fs := newFlagSet(args)
		areaStr := albumAreaFlag(fs)
		limit := fs.Int("limit", 10, "返回数量")
		offset := fs.Int("offset", 0, "偏移量")
		fs.Parse()
		area := strToArea(*areaStr)
		exec("all-new-albums", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, albumendpoint.AllNewAlbums, &mmpb.AllNewAlbumsRequest{Area: area, Limit: int32(*limit), Offset: int32(*offset)})
			exitOnErr(err)
			printJSON(resp)
		})
	// --- 专辑 ---
	case "album":
		id := albumIDFlag(args)
		// album 需要 id 拼进 path（/weapi/v1/album/{id}）。
		execRaw("album", func(ctx context.Context) {
			raw, _, err := eng.RawDoWithCookieAndInput(ctx, engine.Meta{
				Path: fmt.Sprintf("/weapi/v1/album/%d", id), Method: "POST",
				Crypto: engine.CryptoWeAPI, Auth: 0,
			}, map[string]any{})
			exitOnErr(err)
			printRaw(raw)
		})
	case "album-dynamic":
		fs := newFlagSet(args)
		id := fs.Int64("id", 0, "专辑 ID")
		fs.Parse()
		exec("album-dynamic", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, albumendpoint.AlbumDynamic, &mmpb.AlbumDynamicRequest{AlbumId: *id})
			exitOnErr(err)
			printJSON(resp)
		})
	case "album-song-quality":
		fs := newFlagSet(args)
		id := fs.Int64("id", 0, "专辑 ID")
		fs.Parse()
		exec("album-song-quality", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, albumendpoint.AlbumSongQuality, &mmpb.AlbumSongQualityRequest{AlbumId: *id})
			exitOnErr(err)
			printJSON(resp)
		})
	case "subscribe-album":
		fs := newFlagSet(args)
		id := fs.Int64("id", 0, "专辑 ID")
		fs.Parse()
		requireCookie()
		confirmWrite(fmt.Sprintf("收藏专辑 %d", *id))
		exec("subscribe-album", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, albumendpoint.Subscribe, &mmpb.SubscribeAlbumRequest{AlbumId: *id})
			exitOnErr(err)
			printJSON(resp)
		})
	case "unsubscribe-album":
		fs := newFlagSet(args)
		id := fs.Int64("id", 0, "专辑 ID")
		fs.Parse()
		requireCookie()
		confirmWrite(fmt.Sprintf("取消收藏专辑 %d", *id))
		exec("unsubscribe-album", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, albumendpoint.Unsubscribe, &mmpb.UnsubscribeAlbumRequest{AlbumId: *id})
			exitOnErr(err)
			printJSON(resp)
		})
	case "subscribed-albums":
		fs := newFlagSet(args)
		limit := fs.Int("limit", 25, "返回数量")
		fs.Parse()
		requireCookie()
		exec("subscribed-albums", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, albumendpoint.SubscribedAlbums, &mmpb.SubscribedAlbumsRequest{Limit: int32(*limit)})
			exitOnErr(err)
			printJSON(resp)
		})

	// --- 歌单(相似/相关) ---
	case "similar-playlists":
		id := songIDFlag(args)
		exec("similar-playlists", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, playlistendpoint.SimilarPlaylists, &mmpb.SimilarPlaylistsRequest{SongId: id})
			exitOnErr(err)
			printJSON(resp)
		})
	case "related-playlist-recommend":
		fs := newFlagSet(args)
		id := fs.Int64("id", 0, "歌单 ID")
		fs.Parse()
		exec("related-playlist-recommend", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, playlistendpoint.RelatedPlaylistRecommend, &mmpb.RelatedPlaylistRecommendRequest{PlaylistId: *id})
			exitOnErr(err)
			printJSON(resp)
		})

	// --- 用户 ---
	case "similar-users":
		id := songIDFlag(args)
		exec("similar-users", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, userendpoint.SimilarUsers, &mmpb.SimilarUsersRequest{SongId: id})
			exitOnErr(err)
			printJSON(resp)
		})

	// --- 推荐 ---
	case "daily-recommend-playlists":
		requireCookie()
		exec("daily-recommend-playlists", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, recommendendpoint.DailyRecommendPlaylists, &mmpb.DailyRecommendPlaylistsRequest{})
			exitOnErr(err)
			printJSON(resp)
		})
	case "recommend-playlists":
		fs := newFlagSet(args)
		limit := fs.Int("limit", 10, "返回数量")
		fs.Parse()
		exec("recommend-playlists", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, recommendendpoint.RecommendPlaylists, &mmpb.RecommendPlaylistsRequest{Limit: int32(*limit)})
			exitOnErr(err)
			printJSON(resp)
		})
	case "recommend-new-songs":
		fs := newFlagSet(args)
		limit := fs.Int("limit", 10, "返回数量")
		fs.Parse()
		exec("recommend-new-songs", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, recommendendpoint.RecommendNewSongs, &mmpb.RecommendNewSongsRequest{Limit: int32(*limit)})
			exitOnErr(err)
			printJSON(resp)
		})

	// --- 歌手 ---
	case "artist":
		id := artistIDFlag(args)
		exec("artist", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, artistendpoint.GetArtist, &mmpb.GetArtistRequest{ArtistId: id})
			exitOnErr(err); printJSON(resp)
		})
	case "artist-songs":
		fs := newFlagSet(args)
		id := fs.Int64("id", 0, "歌手 ID")
		limit := fs.Int("limit", 20, "返回数量")
		offset := fs.Int("offset", 0, "偏移量")
		fs.Parse()
		exec("artist-songs", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, artistendpoint.AllSongs, &mmpb.AllSongsRequest{ArtistId: *id, Limit: int32(*limit), Offset: int32(*offset)})
			exitOnErr(err); printJSON(resp)
		})
	case "artist-top":
		id := artistIDFlag(args)
		exec("artist-top", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, artistendpoint.TopSongs, &mmpb.TopSongsRequest{ArtistId: id})
			exitOnErr(err); printJSON(resp)
		})
	case "artist-albums":
		fs := newFlagSet(args)
		id := fs.Int64("id", 0, "歌手 ID")
		limit := fs.Int("limit", 10, "返回数量")
		offset := fs.Int("offset", 0, "偏移量")
		fs.Parse()
		// artist-albums 需要 id 拼进 path（/weapi/artist/albums/{id}）。
		execRaw("artist-albums", func(ctx context.Context) {
			raw, _, err := eng.RawDoWithCookieAndInput(ctx, engine.Meta{
				Path: fmt.Sprintf("/weapi/artist/albums/%d", *id), Method: "POST",
				Crypto: engine.CryptoWeAPI, Auth: 0,
			}, map[string]any{"limit": int32(*limit), "offset": int32(*offset), "total": true})
			exitOnErr(err)
			printRaw(raw)
		})
	case "artist-desc":
		id := artistIDFlag(args)
		exec("artist-desc", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, artistendpoint.Desc, &mmpb.DescRequest{ArtistId: id})
			exitOnErr(err); printJSON(resp)
		})
	case "artist-similar":
		id := artistIDFlag(args)
		exec("artist-similar", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, artistendpoint.Similar, &mmpb.SimilarRequest{ArtistId: id})
			exitOnErr(err); printJSON(resp)
		})
	case "artist-fans":
		id := artistIDFlag(args)
		exec("artist-fans", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, artistendpoint.Fans, &mmpb.FansRequest{ArtistId: id})
			exitOnErr(err); printJSON(resp)
		})
	case "top-artists":
		fs := newFlagSet(args)
		limit := fs.Int("limit", 10, "返回数量")
		offset := fs.Int("offset", 0, "偏移量")
		fs.Parse()
		exec("top-artists", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, artistendpoint.TopArtists, &mmpb.TopArtistsRequest{Limit: int32(*limit), Offset: int32(*offset)})
			exitOnErr(err); printJSON(resp)
		})
	case "artist-subscribe":
		id := artistIDFlag(args)
		requireCookie()
		confirmWrite(fmt.Sprintf("收藏/取消收藏歌手 %d", id))
		execRaw("artist-subscribe", func(ctx context.Context) {
			raw, _, err := eng.RawDoWithCookieAndInput(ctx, artistendpoint.SubscribeMeta, artistendpoint.SubscribeRequest(&mmpb.ArtistSubscribeRequest{ArtistId: id}))
			exitOnErr(err)
			printJSON(artistendpoint.ParseSubscribeResponse(raw))
		})

	// --- 认证（除 login 外）---
	case "login-status":
		execRaw("login-status", func(ctx context.Context) {
			raw, _, err := eng.RawDoWithCookieAndInput(ctx, authendpoint.LoginStatus, authendpoint.LoginStatusRequest(nil))
			exitOnErr(err)
			sess, e := model.DecodeLoginResponse(raw)
			if e != nil { exitOnErr(e) }
			sess.Cookie = engine.CookieFromContext(ctx)
			printJSON(sess)
		})
	case "logout":
		execRaw("logout", func(ctx context.Context) {
			if cookie := currentCookie(); cookie != "" {
				// 远端登出失败(如 cookie 已过期)不阻断本地清理。
				if _, _, err := eng.RawDoWithCookieAndInput(ctx, authendpoint.Logout, authendpoint.LogoutRequest(nil)); err != nil {
					fmt.Fprintf(os.Stderr, "警告: 远端登出失败(继续清除本地会话): %v\n", err)
				}
			}
			if err := clearSession(); err != nil {
				fmt.Fprintf(os.Stderr, "警告: 删除本地会话失败: %v\n", err)
			}
			fmt.Println("已登出,本地会话已清除")
		})

	// --- 私人 FM ---
	case "personal-fm":
		exec("personal-fm", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, fmendpoint.GetPersonalFM, &mmpb.GetPersonalFMRequest{})
			exitOnErr(err); printJSON(resp)
		})

	// --- 每日推荐歌曲 ---
	case "daily-recommend-songs":
		exec("daily-recommend-songs", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, recommendendpoint.GetDailyRecommend, &mmpb.GetDailyRecommendRequest{})
			exitOnErr(err); printJSON(resp)
		})

	// --- 搜索 ---
	case "search":
		fs := newFlagSet(args)
		keyword := fs.String("keyword", "", "搜索关键词")
		limit := fs.Int("limit", 10, "返回数量")
		offset := fs.Int("offset", 0, "偏移量")
		fs.Parse()
		exec("search", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, searchendpoint.Search, &mmpb.SearchRequest{Keyword: *keyword, Limit: int32(*limit), Offset: int32(*offset)})
			exitOnErr(err); printJSON(resp)
		})
	case "search-suggest":
		fs := newFlagSet(args)
		keyword := fs.String("keyword", "", "搜索关键词")
		fs.Parse()
		exec("search-suggest", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, searchendpoint.Suggest, &mmpb.SuggestRequest{Keyword: *keyword})
			exitOnErr(err); printJSON(resp)
		})
	case "search-hot":
		exec("search-hot", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, searchendpoint.Hot, &mmpb.HotRequest{})
			exitOnErr(err); printJSON(resp)
		})
	case "search-hot-detail":
		exec("search-hot-detail", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, searchendpoint.HotDetail, &mmpb.HotDetailRequest{})
			exitOnErr(err); printJSON(resp)
		})
	case "search-default-keyword":
		exec("search-default-keyword", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, searchendpoint.DefaultKeyword, &mmpb.DefaultKeywordRequest{})
			exitOnErr(err); printJSON(resp)
		})

	// --- 歌单 ---
	case "playlist":
		id := playlistIDFlag(args)
		exec("playlist", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, playlistendpoint.GetPlaylist, &mmpb.GetPlaylistRequest{PlaylistId: id})
			exitOnErr(err); printJSON(resp)
		})
	case "playlist-highquality":
		fs := newFlagSet(args)
		cat := fs.String("cat", "全部", "分类")
		limit := fs.Int("limit", 10, "返回数量")
		fs.Parse()
		exec("playlist-highquality", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, playlistendpoint.HighQuality, &mmpb.HighQualityRequest{Cat: *cat, Limit: int32(*limit)})
			exitOnErr(err); printJSON(resp)
		})
	case "playlist-highquality-tags":
		exec("playlist-highquality-tags", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, playlistendpoint.HighQualityTags, &mmpb.HighQualityTagsRequest{})
			exitOnErr(err); printJSON(resp)
		})
	case "playlist-catlist":
		exec("playlist-catlist", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, playlistendpoint.CatList, &mmpb.CatListRequest{})
			exitOnErr(err); printJSON(resp)
		})
	case "playlist-hot":
		exec("playlist-hot", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, playlistendpoint.BrowseHot, &mmpb.BrowseHotRequest{})
			exitOnErr(err); printJSON(resp)
		})
	case "playlist-subscribers":
		id := playlistIDFlag(args)
		exec("playlist-subscribers", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, playlistendpoint.Subscribers, &mmpb.SubscribersRequest{PlaylistId: id})
			exitOnErr(err); printJSON(resp)
		})
	case "playlist-tracks":
		id := playlistIDFlag(args)
		exec("playlist-tracks", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, playlistendpoint.AllTracks, &mmpb.AllTracksRequest{PlaylistId: id})
			exitOnErr(err); printJSON(resp)
		})
	case "playlist-subscribe":
		id := playlistIDFlag(args)
		requireCookie()
		confirmWrite(fmt.Sprintf("收藏/取消收藏歌单 %d", id))
		execRaw("playlist-subscribe", func(ctx context.Context) {
			raw, _, err := eng.RawDoWithCookieAndInput(ctx, playlistendpoint.SubscribeMeta, playlistendpoint.SubscribeRequest(&mmpb.SubscribeRequest{PlaylistId: id}))
			exitOnErr(err)
			printJSON(playlistendpoint.ParseSubscribed(raw))
		})
	case "playlist-create":
		fs := newFlagSet(args)
		name := fs.String("name", "", "歌单名")
		privacy := fs.Bool("privacy", false, "是否隐私")
		fs.Parse()
		requireCookie()
		confirmWrite(fmt.Sprintf("创建歌单 %s", *name))
		execRaw("playlist-create", func(ctx context.Context) {
			raw, _, err := eng.RawDoWithCookieAndInput(ctx, playlistendpoint.CreateMeta, playlistendpoint.CreateRequest(&mmpb.CreateRequest{Name: *name, Privacy: *privacy}))
			exitOnErr(err)
			printJSON(playlistendpoint.ParseCreateResponse(raw))
		})
	case "playlist-delete":
		id := playlistIDFlag(args)
		requireCookie()
		confirmWrite(fmt.Sprintf("删除歌单 %d", id))
		execRaw("playlist-delete", func(ctx context.Context) {
			_, _, err := eng.RawDoWithCookieAndInput(ctx, playlistendpoint.DeleteMeta, playlistendpoint.DeleteRequest(&mmpb.DeleteRequest{PlaylistId: id}))
			exitOnErr(err)
			fmt.Println("已删除")
		})
	case "playlist-update-name":
		fs := newFlagSet(args)
		id := fs.Int64("id", 0, "歌单 ID")
		name := fs.String("name", "", "新名称")
		fs.Parse()
		requireCookie()
		confirmWrite(fmt.Sprintf("把歌单 %d 改名为 %q", *id, *name))
		execRaw("playlist-update-name", func(ctx context.Context) {
			_, _, err := eng.RawDoWithCookieAndInput(ctx, playlistendpoint.UpdateNameMeta, playlistendpoint.UpdateNameRequest(&mmpb.UpdateNameRequest{PlaylistId: *id, Name: *name}))
			exitOnErr(err)
			fmt.Println("已更新")
		})
	case "playlist-update-desc":
		fs := newFlagSet(args)
		id := fs.Int64("id", 0, "歌单 ID")
		desc := fs.String("desc", "", "新描述")
		fs.Parse()
		requireCookie()
		confirmWrite(fmt.Sprintf("修改歌单 %d 的描述", *id))
		execRaw("playlist-update-desc", func(ctx context.Context) {
			_, _, err := eng.RawDoWithCookieAndInput(ctx, playlistendpoint.UpdateDescMeta, playlistendpoint.UpdateDescRequest(&mmpb.UpdateDescRequest{PlaylistId: *id, Desc: *desc}))
			exitOnErr(err)
			fmt.Println("已更新")
		})
	case "playlist-update-tags":
		fs := newFlagSet(args)
		id := fs.Int64("id", 0, "歌单 ID")
		tags := fs.String("tags", "", "标签,分号分隔")
		fs.Parse()
		requireCookie()
		confirmWrite(fmt.Sprintf("把歌单 %d 的标签改为 %q", *id, *tags))
		execRaw("playlist-update-tags", func(ctx context.Context) {
			_, _, err := eng.RawDoWithCookieAndInput(ctx, playlistendpoint.UpdateTagsMeta, playlistendpoint.UpdateTagsRequest(&mmpb.UpdateTagsRequest{PlaylistId: *id, Tags: *tags}))
			exitOnErr(err)
			fmt.Println("已更新")
		})
	case "playlist-update-tracks":
		fs := newFlagSet(args)
		id := fs.Int64("id", 0, "歌单 ID")
		opStr := fs.String("op", "add", "操作: add=添加 del=删除")
		tracks := fs.String("tracks", "", "歌曲 ID,逗号分隔")
		fs.Parse()
		ids, err := parseIDs(*tracks)
		exitOnErr(err)
		op := mmpb.TracksOp_TRACKS_OP_ADD
		opText := "添加"
		if *opStr == "del" {
			op = mmpb.TracksOp_TRACKS_OP_DEL
			opText = "删除"
		} else if *opStr != "add" {
			fmt.Fprintf(os.Stderr, "无效的 --op %q: 只支持 add/del\n", *opStr)
			os.Exit(1)
		}
		requireCookie()
		confirmWrite(fmt.Sprintf("对歌单 %d %s歌曲 %v", *id, opText, ids))
		execRaw("playlist-update-tracks", func(ctx context.Context) {
			raw, _, err := eng.RawDoWithCookieAndInput(ctx, playlistendpoint.UpdateTracksMeta, playlistendpoint.UpdateTracksRequest(&mmpb.UpdateTracksRequest{PlaylistId: *id, Op: op, TrackIds: ids}))
			exitOnErr(err)
			printJSON(playlistendpoint.ParseUpdateTracksResponse(raw))
		})

	// --- 用户 ---
	case "user-account":
		requireCookie()
		exec("user-account", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, userendpoint.Account, &mmpb.AccountRequest{})
			exitOnErr(err); printJSON(resp)
		})
	case "user-detail":
		uid := userIDFlag(args)
		// user-detail 需要 uid 拼进 path（/weapi/v1/user/detail/{uid}），endpoint 架构暂不支持动态 path，这里直接 RawDo。
		execRaw("user-detail", func(ctx context.Context) {
			raw, _, err := eng.RawDoWithCookieAndInput(ctx, engine.Meta{
				Path: fmt.Sprintf("/weapi/v1/user/detail/%d", uid), Method: "POST",
				Crypto: engine.CryptoWeAPI, Auth: 0,
			}, map[string]any{})
			exitOnErr(err)
			printRaw(raw)
		})
	case "user-sub-count":
		// subcount 查当前登录用户的计数（无 uid 参数）。
		exec("user-sub-count", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, userendpoint.SubCount, &mmpb.SubCountRequest{})
			exitOnErr(err); printJSON(resp)
		})
	case "user-detail-by-name":
		fs := newFlagSet(args)
		nickname := fs.String("nickname", "", "用户昵称")
		fs.Parse()
		exec("user-detail-by-name", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, userendpoint.DetailByName, &mmpb.DetailByNameRequest{Nickname: *nickname})
			exitOnErr(err); printJSON(resp)
		})
	case "user-playlists":
		uid := userIDFlag(args)
		exec("user-playlists", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, userendpoint.UserPlaylist, &mmpb.UserPlaylistRequest{UserId: uid})
			exitOnErr(err); printJSON(resp)
		})
	case "user-follows":
		fs := newFlagSet(args)
		uid := fs.Int64("uid", 0, "用户 ID")
		limit := fs.Int("limit", 20, "返回数量")
		offset := fs.Int("offset", 0, "偏移量")
		fs.Parse()
		// user-follows 需要 uid 拼进 path（/weapi/user/getfollows/{uid}）。
		execRaw("user-follows", func(ctx context.Context) {
			raw, _, err := eng.RawDoWithCookieAndInput(ctx, engine.Meta{
				Path: fmt.Sprintf("/weapi/user/getfollows/%d", *uid), Method: "POST",
				Crypto: engine.CryptoWeAPI, Auth: 0,
			}, map[string]any{"offset": int32(*offset), "limit": int32(*limit), "order": true})
			exitOnErr(err)
			printRaw(raw)
		})
	case "user-followeds":
		fs := newFlagSet(args)
		uid := fs.Int64("uid", 0, "用户 ID")
		limit := fs.Int("limit", 20, "返回数量")
		offset := fs.Int("offset", 0, "偏移量")
		fs.Parse()
		exec("user-followeds", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, userendpoint.Followeds, &mmpb.FollowedsRequest{UserId: *uid, Limit: int32(*limit), Offset: int32(*offset)})
			exitOnErr(err); printJSON(resp)
		})
	case "user-follow-each-other":
		fs := newFlagSet(args)
		uid := fs.Int64("uid", 0, "用户 ID")
		target := fs.Int64("target", 0, "对方用户 ID")
		fs.Parse()
		exec("user-follow-each-other", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, userendpoint.FollowEachOther, &mmpb.FollowEachOtherRequest{UserId: *uid, TargetUserId: *target})
			exitOnErr(err); printJSON(resp)
		})
	case "user-record":
		fs := newFlagSet(args)
		uid := fs.Int64("uid", 0, "用户 ID")
		typ := fs.Int("type", 0, "0=本周 1=全部")
		fs.Parse()
		exec("user-record", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, userendpoint.Record, &mmpb.RecordRequest{UserId: *uid, Type: int32(*typ)})
			exitOnErr(err); printJSON(resp)
		})
	case "user-events":
		fs := newFlagSet(args)
		uid := fs.Int64("uid", 0, "用户 ID")
		limit := fs.Int("limit", 30, "返回数量")
		lastID := fs.Int64("last-event-id", 0, "偏移量(上一页最后一条动态 ID)")
		fs.Parse()
		exec("user-events", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, userendpoint.Events, &mmpb.EventsRequest{UserId: *uid, Limit: int32(*limit), LastEventId: *lastID})
			exitOnErr(err); printJSON(resp)
		})
	case "user-level":
		uid := userIDFlag(args)
		exec("user-level", func(ctx context.Context) {
			resp, err := executeOverride(eng, ctx, userendpoint.Level, &mmpb.LevelRequest{UserId: uid})
			exitOnErr(err); printJSON(resp)
		})

	case "-h", "--help", "help":
		usage()
	default:
		fmt.Fprintf(os.Stderr, "未知命令: %s\n\n", cmd)
		usage()
		os.Exit(1)
	}
}

// --- 共享辅助 ---

// currentCookie 返回当前生效的 cookie: 环境变量 NETEASE_COOKIE 优先,其次本地会话文件。
func currentCookie() string {
	if c := os.Getenv("NETEASE_COOKIE"); c != "" {
		return c
	}
	sess, err := loadSession()
	if err != nil {
		return ""
	}
	return sess.Cookie
}

// cookieCtx 把当前生效的 cookie 注入 context(无则注入空)。
func cookieCtx() context.Context {
	return engine.WithCookie(context.Background(), currentCookie())
}

// exec 包裹一次 engine 调用:注入 cookie ctx,失败时统一报错退出。
func exec(_ string, fn func(ctx context.Context)) {
	fn(cookieCtx())
}

// execRaw 包裹一次 RawDoWithCookieAndInput 调用（旧式 endpoint 用）。
func execRaw(_ string, fn func(ctx context.Context)) {
	fn(cookieCtx())
}

// artistIDFlag 解析 --id 歌手ID。
func artistIDFlag(args []string) int64 {
	fs := flag.NewFlagSet("", flag.ExitOnError)
	id := fs.Int64("id", 0, "歌手 ID")
	_ = fs.Parse(args)
	return *id
}

// playlistIDFlag 解析 --id 歌单ID。
func playlistIDFlag(args []string) int64 {
	fs := flag.NewFlagSet("", flag.ExitOnError)
	id := fs.Int64("id", 0, "歌单 ID")
	_ = fs.Parse(args)
	return *id
}

// albumIDFlag 解析 --id 专辑ID。
func albumIDFlag(args []string) int64 {
	fs := flag.NewFlagSet("", flag.ExitOnError)
	id := fs.Int64("id", 0, "专辑 ID")
	_ = fs.Parse(args)
	return *id
}

// userIDFlag 解析 --uid 用户ID。
func userIDFlag(args []string) int64 {
	fs := flag.NewFlagSet("", flag.ExitOnError)
	id := fs.Int64("uid", 0, "用户 ID")
	_ = fs.Parse(args)
	return *id
}

// execEapi 执行一个 eapi 读类接口并打印响应。eapi 接口走 engine.Execute(匿名)。
func execEapi[Req any, Resp proto.Message](name string, ep *engine.Endpoint[Req, Resp], makeReq func() Req) {
	ctx := cookieCtx()
	resp, err := executeOverride(eng, ctx, ep, makeReq())
	exitOnErr(err)
	printJSON(resp)
}

// executeOverride 是 service 包的 executeOverride 的本地副本(cookie override 路径)。
// 复制而非 import,因为 service 包还装配了 gRPC 相关类型,这里只要纯执行逻辑。
func executeOverride[Req, Resp any](eng *engine.Engine, ctx context.Context, ep *engine.Endpoint[Req, Resp], req Req) (Resp, error) {
	params, err := ep.MapRequest(req)
	if err != nil {
		var zero Resp
		return zero, err
	}
	raw, _, err := eng.RawDoWithCookieAndInput(ctx, ep.Meta, params)
	if err != nil {
		var zero Resp
		return zero, err
	}
	return ep.MapResponse(req, raw)
}

// printJSON 用 protojson 输出 pretty JSON。
func printJSON(msg proto.Message) {
	b, err := protojson.MarshalOptions{Multiline: true, EmitUnpopulated: true}.Marshal(msg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "序列化响应失败: %v\n", err)
		os.Exit(1)
	}
	fmt.Println(string(b))
}

// printRaw 直接 pretty 打印原始 JSON（动态 path 接口未经 proto 映射时用）。
func printRaw(raw json.RawMessage) {
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		fmt.Println(string(raw))
		return
	}
	b, _ := json.MarshalIndent(v, "", "  ")
	fmt.Println(string(b))
}

// exitOnErr 有错打印并退出。
func exitOnErr(err error) {
	if err != nil {
		fmt.Fprintf(os.Stderr, "错误: %v\n", err)
		os.Exit(1)
	}
}

// requireCookie 检查当前有可用的登录态(环境变量或本地会话文件),否则提示先登录。
func requireCookie() {
	if currentCookie() == "" {
		fmt.Fprintln(os.Stderr, "未登录:先运行 `musicctl login` 扫码登录(也可用 NETEASE_COOKIE 环境变量临时指定 cookie)")
		os.Exit(1)
	}
}

// confirmWrite 写操作前 y/N 确认。
func confirmWrite(action string) {
	fmt.Printf("⚠ 即将真实操作你的网易云账号:%s\n输入 y 确认,其他取消: ", action)
	reader := bufio.NewReader(os.Stdin)
	line, _ := reader.ReadString('\n')
	if strings.TrimSpace(line) != "y" {
		fmt.Println("已取消")
		os.Exit(0)
	}
}

// --- flag 辅助 ---

// flagHolder 包装 flag.FlagSet 并持有子命令的参数(args[1:])。
// Parse 时解析这些参数。flag.ExitOnError 让 -h 自动打印用法并退出。
type flagHolder struct {
	fs   *flag.FlagSet
	args []string
}

func newFlagSet(args []string) *flagHolder {
	return &flagHolder{fs: flag.NewFlagSet("", flag.ExitOnError), args: args}
}

func (h *flagHolder) Int64(name string, value int64, usage string) *int64 { return h.fs.Int64(name, value, usage) }
func (h *flagHolder) Int(name string, value int, usage string) *int       { return h.fs.Int(name, value, usage) }
func (h *flagHolder) Bool(name string, value bool, usage string) *bool    { return h.fs.Bool(name, value, usage) }
func (h *flagHolder) String(name string, value, usage string) *string     { return h.fs.String(name, value, usage) }
func (h *flagHolder) Parse()                                              { _ = h.fs.Parse(h.args) }

// songIDFlag 解析 --id 歌曲ID(高频复用)。
func songIDFlag(args []string) int64 {
	fs := flag.NewFlagSet("", flag.ExitOnError)
	id := fs.Int64("id", 0, "歌曲 ID")
	_ = fs.Parse(args)
	return *id
}

// albumAreaFlag 添加 --area 专辑地区 flag,返回字符串指针(调用方 Parse 后转 enum)。
// 不在此 Parse——调用方需先注册所有 flag 再统一 Parse 一次。
func albumAreaFlag(h *flagHolder) *string {
	return h.String("area", "ALL", "地区: ALL/ZH/EA/KR/JP")
}

// --- 登录态持久化 ---

// session 是落盘的登录会话。cookie 属于敏感信息:
// 目录 0700、文件 0600,且不再把完整 cookie 打印到终端。
type session struct {
	Cookie  string `json:"cookie"`
	UserID  int64  `json:"user_id,omitempty"`
	SavedAt string `json:"saved_at"`
}

// sessionPath 返回会话文件路径 ~/.musicctl/session.json。
func sessionPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".musicctl", "session.json"), nil
}

// saveSession 把会话写盘(目录 0700 / 文件 0600)。
func saveSession(sess session) error {
	p, err := sessionPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
		return err
	}
	b, err := json.Marshal(sess)
	if err != nil {
		return err
	}
	// 先写临时文件再 rename,避免中断留下半个 JSON。
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, p)
}

// loadSession 读本地会话。文件不存在或损坏时返回 error。
func loadSession() (session, error) {
	var sess session
	p, err := sessionPath()
	if err != nil {
		return sess, err
	}
	b, err := os.ReadFile(p)
	if err != nil {
		return sess, err
	}
	if err := json.Unmarshal(b, &sess); err != nil {
		return sess, err
	}
	if sess.Cookie == "" {
		return sess, fmt.Errorf("会话文件 %s 中没有 cookie", p)
	}
	return sess, nil
}

// clearSession 删除本地会话文件,不存在时不算错误。
func clearSession() error {
	p, err := sessionPath()
	if err != nil {
		return err
	}
	if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// --- 登录流程 ---

// persistLogin 登录成功后落盘会话并打印结果。raw 为登录接口响应(尽力提取用户 ID)。
// 扫码登录和手机号登录共用。
func persistLogin(raw json.RawMessage, setCookie string) {
	if setCookie == "" {
		fmt.Fprintln(os.Stderr, "登录成功但未拿到 cookie")
		os.Exit(1)
	}
	sess := session{
		Cookie:  setCookie,
		SavedAt: time.Now().Format(time.RFC3339),
	}
	// 尝试提取用户信息(可选)。
	if s, err := model.DecodeLoginResponse(raw); err == nil && s.UserId != 0 {
		sess.UserID = s.UserId
	}
	if err := saveSession(sess); err != nil {
		fmt.Fprintf(os.Stderr, "登录成功但保存会话失败: %v\n", err)
		os.Exit(1)
	}
	p, _ := sessionPath()
	fmt.Println("✅ 登录成功!")
	if sess.UserID != 0 {
		fmt.Printf("用户 ID: %d\n", sess.UserID)
	}
	fmt.Printf("会话已保存到 %s,后续命令自动携带登录态。\n", p)
	fmt.Println("(如需临时换号,可设 NETEASE_COOKIE 环境变量,优先级高于会话文件)")
}

// runLogin 扫码登录:取二维码 → 轮询 → cookie 持久化到本地会话文件。
func runLogin() {
	ctx := context.Background()

	// 1. 取二维码 key。
	raw, _, err := eng.RawDoWithCookieAndInput(ctx, authendpoint.LoginQrcode, authendpoint.LoginQrcodeRequest(&mmpb.LoginQrcodeRequest{}))
	exitOnErr(err)
	key, err := model.DecodeQrcodeKey(raw)
	exitOnErr(err)

	fmt.Println("请用网易云 App 扫描下方二维码登录:")
	fmt.Println()
	fmt.Print(renderQR(authendpoint.QrcodeURL(key)))
	fmt.Println()
	fmt.Printf("二维码内容: %s\n", authendpoint.QrcodeURL(key))
	fmt.Println("(如二维码无法识别,把上面 URL 在浏览器打开,用 App 扫浏览器里的码)")
	fmt.Println("轮询登录状态中...")

	// 2. 轮询状态。
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	timeout := time.After(3 * time.Minute)

	for {
		select {
		case <-timeout:
			fmt.Fprintln(os.Stderr, "登录超时(3 分钟)")
			os.Exit(1)
		case <-ticker.C:
			raw, setCookie, err := eng.RawDoWithCookieAndInput(ctx, authendpoint.CheckQrcode, authendpoint.CheckQrcodeRequest(&mmpb.CheckQrcodeRequest{Key: key}))
			if err != nil {
				fmt.Printf("轮询出错(将重试): %v\n", err)
				continue
			}
			code, message, err := model.DecodeQrcodeStatus(raw)
			if err != nil {
				fmt.Printf("解析轮询响应失败(将重试): %v\n", err)
				continue
			}

			switch code {
			case mmpb.QrcodeCode_QRCODE_CODE_WAITING:
				fmt.Printf("等待扫码...\n")
			case mmpb.QrcodeCode_QRCODE_CODE_SCANNED:
				fmt.Printf("已扫描,请在 App 确认登录...\n")
			case mmpb.QrcodeCode_QRCODE_CODE_CONFIRMED:
				persistLogin(raw, setCookie)
				return
			case mmpb.QrcodeCode_QRCODE_CODE_EXPIRED:
				fmt.Fprintln(os.Stderr, "二维码已过期,请重新运行 login")
				os.Exit(1)
			default:
				fmt.Printf("未知状态: code=%d message=%s\n", code, message)
			}
		}
	}
}

// --- 用法 ---

func usage() {
	fmt.Println(`musicctl - mimo-music 接口调试工具

用法: go run cmd/musicctl/main.go <command> [flags]

登录:
  login                                 扫码登录,cookie 持久化到 ~/.musicctl/session.json
  login-status                          查看当前登录态
  logout                                登出并删除本地会话文件

歌曲(匿名):
  song-detail --id <id>
  song-url --id <id> [--level 1]
  lyric --id <id>
  word-lyric --id <id>                  逐字歌词
  check-available --id <id>
  quality-detail --id <id>              音质详情(eapi)
  like-count --id <id>                  红心数(eapi)
  dynamic-cover --id <id>               动态封面(eapi)
  chorus-time --id <id>                 副歌(eapi)
  creator-info --id <id>                创作者(eapi)
  similar-songs --id <id>

歌曲(登录态,需先 login):
  like --id <id> --on|--off             写操作
  trash --id <id>                       写操作
  disallow-recommend --id <id>          写操作
  liked-list --uid <uid>
  is-like --id <id>

专辑:
  new-album-shelf [--area ZH] [--limit 10]
  newest-albums
  all-new-albums [--area ZH] [--limit 10] [--offset 0]
  album-dynamic --id <id>
  album-song-quality --id <id>
  subscribe-album --id <id>             写操作(登录态)
  unsubscribe-album --id <id>           写操作(登录态)
  subscribed-albums [--limit 25]        登录态

歌单/用户/推荐:
  similar-playlists --id <id>
  related-playlist-recommend --id <id>
  similar-users --id <id>
  daily-recommend-playlists             登录态
  recommend-playlists [--limit 10]
  recommend-new-songs [--limit 10]

登录态来源:
  1. 环境变量 NETEASE_COOKIE(优先,用于临时换号调试)
  2. 本地会话文件 ~/.musicctl/session.json(login 命令写入,logout 删除)`)
}

// --- 小工具 ---

// ternary 三元表达式辅助。
func ternary(b bool, t, f string) string {
	if b {
		return t
	}
	return f
}

// parseIDs 把 "1,2,3" 解析成 int64 切片,空串或含非数字时报错。
func parseIDs(s string) ([]int64, error) {
	if strings.TrimSpace(s) == "" {
		return nil, fmt.Errorf("--tracks 不能为空")
	}
	parts := strings.Split(s, ",")
	ids := make([]int64, 0, len(parts))
	for _, p := range parts {
		id, err := strconv.ParseInt(strings.TrimSpace(p), 10, 64)
		if err != nil {
			return nil, fmt.Errorf("无效的歌曲 ID %q", strings.TrimSpace(p))
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// renderQR 把内容渲染成终端二维码字符串。
//
// 自己写渲染层（编码用 go-qrcode 生成像素矩阵,不直接用它的 ToSmallString）:
// 每行输出两个像素行,用 Unicode 半高方块 ▀▄█ 把终端高度压缩一半。
// 外加一圈白色 quiet zone 提升扫码识别率。
func renderQR(content string) string {
	qr, err := qrcode.New(content, qrcode.Medium)
	if err != nil {
		return fmt.Sprintf("(二维码生成失败: %v)\n%s\n", err, content)
	}
	bitmap := qr.Bitmap()

	// 补一圈白边（quiet zone,标准要求 4 模块,这里用 2 够用且不过宽）。
	const quiet = 2
	size := len(bitmap) + quiet*2
	grid := make([][]bool, size)
	for i := range grid {
		grid[i] = make([]bool, size) // true=黑
	}
	for y, row := range bitmap {
		for x, v := range row {
			grid[y+quiet][x+quiet] = v
		}
	}

	var b strings.Builder
	// 两行一组,每个字符表示上/下两像素:上黑下白=▀ 上白下黑=▄ 全黑=█ 全白=空格。
	for y := 0; y < size; y += 2 {
		for x := 0; x < size; x++ {
			upper := grid[y][x]
			lower := y+1 < size && grid[y+1][x]
			switch {
			case upper && lower:
				b.WriteRune('█')
			case upper:
				b.WriteRune('▀')
			case lower:
				b.WriteRune('▄')
			default:
				b.WriteRune(' ')
			}
		}
		b.WriteByte('\n')
	}
	return b.String()
}

func strToArea(s string) mmpb.AlbumArea {
	switch strings.ToUpper(s) {
	case "ZH":
		return mmpb.AlbumArea_ALBUM_AREA_ZH
	case "EA":
		return mmpb.AlbumArea_ALBUM_AREA_EA
	case "KR":
		return mmpb.AlbumArea_ALBUM_AREA_KR
	case "JP":
		return mmpb.AlbumArea_ALBUM_AREA_JP
	default:
		return mmpb.AlbumArea_ALBUM_AREA_ALL
	}
}
