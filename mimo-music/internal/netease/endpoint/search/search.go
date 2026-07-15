// Package search 定义搜索接口的声明。
//
// 支持网易云 9 种搜索类型（type 参数）。MapResponse 按 type 分支解析不同返回结构。
// 搜索单曲/专辑/歌手复用 model 层 map 函数，歌单/用户/MV 用独立的精简结构。
package search

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// Search 是搜索接口的声明。
//
// MapRequest 透传 type 到上游，MapResponse 按 type 分支调对应解析逻辑。
// cache key 含 type 维度，不同 type 不串缓存。
var Search = &engine.Endpoint[*mmpb.SearchRequest, *mmpb.SearchResponse]{
	Meta: engine.Meta{
		Path:   "/api/search/get",
		Method: "GET",
		Crypto: engine.CryptoNone,
		Auth:   session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.SearchRequest]{
		Key: func(req *mmpb.SearchRequest) string {
			return fmt.Sprintf("search:%d:%s:%d:%d", req.GetType(), req.GetKeyword(), req.GetLimit(), req.GetOffset())
		},
		TTL: 10 * time.Minute,
	},
	MapRequest: func(req *mmpb.SearchRequest) (map[string]any, error) {
		limit := int(req.GetLimit())
		if limit <= 0 {
			limit = 10
		}
		// 透传 type 到上游。默认单曲。
		searchType := int32(req.GetType())
		if searchType == 0 {
			searchType = 1
		}
		return map[string]any{
			"s":      req.GetKeyword(),
			"type":   searchType,
			"limit":  limit,
			"offset": req.GetOffset(),
		}, nil
	},
	MapResponse: mapSearchResponse,
}

// mapSearchResponse 按 SearchType 分支解析网易云搜索响应。
func mapSearchResponse(raw json.RawMessage) (*mmpb.SearchResponse, error) {
	// 网易云搜索响应外层是 {result: {...}, code: 200}。
	// 不同 type 的 result 内部字段不同，需要先解析出 type 再分支。
	// 但 result 里有 type 字段吗？没有——type 只在请求里。所以我们从 raw 里无法得知 type。
	// 解决：endpoint 的 MapResponse 签名不带 type，但我们可以从 result 的字段存在性推断。
	// 网易云单曲搜返回 result.songs，专辑搜返回 result.albums，以此类推。
	resp := &mmpb.SearchResponse{}

	var r struct {
		Result json.RawMessage `json:"result"`
	}
	if err := json.Unmarshal(raw, &r); err != nil {
		return resp, fmt.Errorf("解析搜索结果失败: %w", err)
	}
	if len(r.Result) == 0 {
		return resp, nil
	}

	// 把 result 解析成 map 判断哪些字段存在。
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(r.Result, &fields); err != nil {
		return resp, fmt.Errorf("解析搜索结果字段失败: %w", err)
	}

	resp.Total = countFromFields(fields)

	// 按存在的字段填充对应类型。
	if songs, ok := fields["songs"]; ok {
		resp.Songs = parseSearchSongs(songs)
	}
	if albums, ok := fields["albums"]; ok {
		resp.Albums = parseSearchAlbums(albums)
	}
	if artists, ok := fields["artists"]; ok {
		resp.Artists = parseSearchArtists(artists)
	}
	if playlists, ok := fields["playlists"]; ok {
		resp.Playlists = parseSearchPlaylists(playlists)
	}
	if users, ok := fields["userprofiles"]; ok {
		resp.Users = parseSearchUsers(users)
	}
	if mvs, ok := fields["mvs"]; ok {
		resp.Mvs = parseSearchMVs(mvs)
	}

	return resp, nil
}

// countFromFields 从 result 提取总数（不同 type 字段名不同：songCount/albumCount/artistCount）。
func countFromFields(fields map[string]json.RawMessage) int32 {
	for _, key := range []string{"songCount", "albumCount", "artistCount", "playlistCount", "userprofileCount", "mvCount"} {
		if raw, ok := fields[key]; ok {
			var n int32
			if json.Unmarshal(raw, &n) == nil {
				return n
			}
		}
	}
	return 0
}

// parseSearchSongs 解析单曲搜索结果。
func parseSearchSongs(raw json.RawMessage) []*mmpb.Song {
	var songs []struct {
		ID       int64  `json:"id"`
		Name     string `json:"name"`
		Artists  []struct {
			ID   int64  `json:"id"`
			Name string `json:"name"`
		} `json:"artists"`
		Album struct {
			ID     int64  `json:"id"`
			Name   string `json:"name"`
			PicUrl string `json:"img1v1Url"`
		} `json:"album"`
		Duration int64 `json:"duration"`
	}
	if json.Unmarshal(raw, &songs) != nil {
		return nil
	}
	out := make([]*mmpb.Song, 0, len(songs))
	for _, s := range songs {
		artists := make([]*mmpb.Artist, 0, len(s.Artists))
		for _, a := range s.Artists {
			artists = append(artists, &mmpb.Artist{Id: a.ID, Name: a.Name})
		}
		out = append(out, &mmpb.Song{
			Id: s.ID, Name: s.Name, Artists: artists,
			Album: &mmpb.Album{Id: s.Album.ID, Name: s.Album.Name, PicUrl: s.Album.PicUrl},
			DurationMs: s.Duration,
		})
	}
	return out
}

// parseSearchAlbums 解析专辑搜索结果。
func parseSearchAlbums(raw json.RawMessage) []*mmpb.Album {
	var albums []struct {
		ID          int64  `json:"id"`
		Name        string `json:"name"`
		PicUrl      string `json:"img1v1Url"`
		Artist      struct {
			ID   int64  `json:"id"`
			Name string `json:"name"`
		} `json:"artist"`
	}
	if json.Unmarshal(raw, &albums) != nil {
		return nil
	}
	out := make([]*mmpb.Album, 0, len(albums))
	for _, a := range albums {
		out = append(out, &mmpb.Album{
			Id: a.ID, Name: a.Name, PicUrl: a.PicUrl,
			Artist: &mmpb.Artist{Id: a.Artist.ID, Name: a.Artist.Name},
		})
	}
	return out
}

// parseSearchArtists 解析歌手搜索结果。
func parseSearchArtists(raw json.RawMessage) []*mmpb.Artist {
	var artists []struct {
		ID       int64  `json:"id"`
		Name     string `json:"name"`
		PicUrl   string `json:"img1v1Url"`
		Alias    []string `json:"alias"`
	}
	if json.Unmarshal(raw, &artists) != nil {
		return nil
	}
	out := make([]*mmpb.Artist, 0, len(artists))
	for _, a := range artists {
		out = append(out, &mmpb.Artist{Id: a.ID, Name: a.Name, PicUrl: a.PicUrl, Alias: a.Alias})
	}
	return out
}

// parseSearchPlaylists 解析歌单搜索结果。
func parseSearchPlaylists(raw json.RawMessage) []*mmpb.SearchPlaylist {
	var pls []struct {
		ID         int64  `json:"id"`
		Name       string `json:"name"`
		CoverImgUrl string `json:"coverImgUrl"`
		PlayCount  int64  `json:"playCount"`
		TrackCount int    `json:"trackCount"`
		Creator    struct {
			Nickname string `json:"nickname"`
		} `json:"creator"`
	}
	if json.Unmarshal(raw, &pls) != nil {
		return nil
	}
	out := make([]*mmpb.SearchPlaylist, 0, len(pls))
	for _, p := range pls {
		out = append(out, &mmpb.SearchPlaylist{
			Id: p.ID, Name: p.Name, CoverUrl: p.CoverImgUrl,
			PlayCount: p.PlayCount, TrackCount: int32(p.TrackCount),
			Creator: p.Creator.Nickname,
		})
	}
	return out
}

// parseSearchUsers 解析用户搜索结果。
func parseSearchUsers(raw json.RawMessage) []*mmpb.SearchUser {
	var users []struct {
		UserID    int64  `json:"userId"`
		Nickname  string `json:"nickname"`
		AvatarURL string `json:"avatarUrl"`
	}
	if json.Unmarshal(raw, &users) != nil {
		return nil
	}
	out := make([]*mmpb.SearchUser, 0, len(users))
	for _, u := range users {
		out = append(out, &mmpb.SearchUser{Id: u.UserID, Nickname: u.Nickname, AvatarUrl: u.AvatarURL})
	}
	return out
}

// parseSearchMVs 解析 MV 搜索结果。
func parseSearchMVs(raw json.RawMessage) []*mmpb.SearchMV {
	var mvs []struct {
		ID      int64  `json:"id"`
		Name    string `json:"name"`
		Cover   string `json:"cover"`
		ArtistName string `json:"artistName"`
	}
	if json.Unmarshal(raw, &mvs) != nil {
		return nil
	}
	out := make([]*mmpb.SearchMV, 0, len(mvs))
	for _, m := range mvs {
		out = append(out, &mmpb.SearchMV{Id: m.ID, Name: m.Name, CoverUrl: m.Cover, Artist: m.ArtistName})
	}
	return out
}
