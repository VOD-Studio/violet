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
// MapRequest 透传 type 到上游，MapResponse 按请求 type 分支调对应解析逻辑。
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
	NewResp: func() *mmpb.SearchResponse { return &mmpb.SearchResponse{} },
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

// mapSearchResponse 按请求的 SearchType 分发到对应类型的解析。
//
// 网易云搜索响应外层是 {result: {...}, code: 200}，不同 type 的 result 内部字段不同。
// type 只存在于请求里（响应不回传），因此按请求 type 确定地分发，不做字段嗅探。
func mapSearchResponse(req *mmpb.SearchRequest, raw json.RawMessage) (*mmpb.SearchResponse, error) {
	var r struct {
		Result json.RawMessage `json:"result"`
	}
	if err := json.Unmarshal(raw, &r); err != nil {
		return &mmpb.SearchResponse{}, fmt.Errorf("解析搜索结果失败: %w", err)
	}
	if len(r.Result) == 0 {
		return &mmpb.SearchResponse{}, nil
	}

	resp := &mmpb.SearchResponse{Total: countFromType(req.GetType(), r.Result)}

	// 按请求 type 确定地解析对应字段。
	switch req.GetType() {
	case mmpb.SearchType_SEARCH_TYPE_SONG:
		resp.Songs = parseSearchSongs(jsonPath(r.Result, "songs"))
	case mmpb.SearchType_SEARCH_TYPE_ALBUM:
		resp.Albums = parseSearchAlbums(jsonPath(r.Result, "albums"))
	case mmpb.SearchType_SEARCH_TYPE_ARTIST:
		resp.Artists = parseSearchArtists(jsonPath(r.Result, "artists"))
	case mmpb.SearchType_SEARCH_TYPE_PLAYLIST:
		resp.Playlists = parseSearchPlaylists(jsonPath(r.Result, "playlists"))
	case mmpb.SearchType_SEARCH_TYPE_USER:
		resp.Users = parseSearchUsers(jsonPath(r.Result, "userprofiles"))
	case mmpb.SearchType_SEARCH_TYPE_MV:
		resp.Mvs = parseSearchMVs(jsonPath(r.Result, "mvs"))
	case mmpb.SearchType_SEARCH_TYPE_ALL:
		// 综合搜索：各类型字段都填充。
		resp.Songs = parseSearchSongs(jsonPath(r.Result, "songs"))
		resp.Albums = parseSearchAlbums(jsonPath(r.Result, "albums"))
		resp.Artists = parseSearchArtists(jsonPath(r.Result, "artists"))
		resp.Playlists = parseSearchPlaylists(jsonPath(r.Result, "playlists"))
		resp.Users = parseSearchUsers(jsonPath(r.Result, "userprofiles"))
		resp.Mvs = parseSearchMVs(jsonPath(r.Result, "mvs"))
	}
	return resp, nil
}

// jsonPath 从对象里取出指定字段的 raw JSON，字段缺失返回 nil。
func jsonPath(obj json.RawMessage, key string) json.RawMessage {
	var fields map[string]json.RawMessage
	if json.Unmarshal(obj, &fields) != nil {
		return nil
	}
	return fields[key]
}

// countFromType 按搜索 type 从 result 提取总数。
// 网易云各 type 的计数字段名不同：songCount/albumCount/artistCount/playlistCount/userprofileCount/mvCount。
func countFromType(t mmpb.SearchType, result json.RawMessage) int32 {
	var key string
	switch t {
	case mmpb.SearchType_SEARCH_TYPE_SONG:
		key = "songCount"
	case mmpb.SearchType_SEARCH_TYPE_ALBUM:
		key = "albumCount"
	case mmpb.SearchType_SEARCH_TYPE_ARTIST:
		key = "artistCount"
	case mmpb.SearchType_SEARCH_TYPE_PLAYLIST:
		key = "playlistCount"
	case mmpb.SearchType_SEARCH_TYPE_USER:
		key = "userprofileCount"
	case mmpb.SearchType_SEARCH_TYPE_MV:
		key = "mvCount"
	case mmpb.SearchType_SEARCH_TYPE_ALL:
		// 综合搜索用单曲计数（网易云综合结果 songCount 总存在）。
		key = "songCount"
	default:
		return 0
	}
	raw := jsonPath(result, key)
	if raw == nil {
		return 0
	}
	var n int32
	if json.Unmarshal(raw, &n) == nil {
		return n
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
