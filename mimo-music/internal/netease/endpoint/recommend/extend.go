// Package recommend 的推荐扩展接口声明。
//
// DailyRecommendPlaylists（每日推荐歌单，需登录）/ RecommendPlaylists（推荐歌单）
// / RecommendNewSongs（推荐新音乐）三个接口。
package recommend

import (
	"encoding/json"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/model"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// DailyRecommendPlaylists 是获取每日推荐歌单的接口声明（需登录态）。
//
// 结果按调用方（登录用户）而异，不缓存（与 song.IsLike / album.SubscribedAlbums 同理）。
var DailyRecommendPlaylists = &engine.Endpoint[*mmpb.DailyRecommendPlaylistsRequest, *mmpb.DailyRecommendPlaylistsResponse]{
	Meta: engine.Meta{
		Path: "/weapi/v1/discovery/recommend/resource", Method: "POST",
		Crypto: engine.CryptoWeAPI, Auth: session.AuthLoggedIn,
	},
	Cache:   nil,
	NewResp: func() *mmpb.DailyRecommendPlaylistsResponse { return &mmpb.DailyRecommendPlaylistsResponse{} },
	MapRequest: func(req *mmpb.DailyRecommendPlaylistsRequest) (map[string]any, error) {
		return map[string]any{}, nil
	},
	MapResponse: func(req *mmpb.DailyRecommendPlaylistsRequest, raw json.RawMessage) (*mmpb.DailyRecommendPlaylistsResponse, error) {
		playlists, err := model.DecodeRecommendPlaylists(raw)
		if err != nil {
			return nil, err
		}
		return &mmpb.DailyRecommendPlaylistsResponse{Playlists: playlists}, nil
	},
}

// RecommendPlaylists 是获取推荐歌单的接口声明（匿名，1h 缓存）。
var RecommendPlaylists = &engine.Endpoint[*mmpb.RecommendPlaylistsRequest, *mmpb.RecommendPlaylistsResponse]{
	Meta: engine.Meta{
		Path: "/weapi/personalized/playlist", Method: "POST",
		Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.RecommendPlaylistsRequest]{
		Key: func(req *mmpb.RecommendPlaylistsRequest) string {
			return "recommend:playlists"
		},
		TTL: time.Hour,
	},
	NewResp: func() *mmpb.RecommendPlaylistsResponse { return &mmpb.RecommendPlaylistsResponse{} },
	MapRequest: func(req *mmpb.RecommendPlaylistsRequest) (map[string]any, error) {
		limit := req.GetLimit()
		if limit <= 0 {
			limit = 30
		}
		return map[string]any{"limit": limit, "total": true, "n": 1000}, nil
	},
	MapResponse: func(req *mmpb.RecommendPlaylistsRequest, raw json.RawMessage) (*mmpb.RecommendPlaylistsResponse, error) {
		playlists, err := model.DecodeRecommendPlaylists(raw)
		if err != nil {
			return nil, err
		}
		return &mmpb.RecommendPlaylistsResponse{Playlists: playlists}, nil
	},
}

// RecommendNewSongs 是获取推荐新音乐的接口声明（匿名，1h 缓存）。
var RecommendNewSongs = &engine.Endpoint[*mmpb.RecommendNewSongsRequest, *mmpb.RecommendNewSongsResponse]{
	Meta: engine.Meta{
		Path: "/weapi/personalized/newsong", Method: "POST",
		Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.RecommendNewSongsRequest]{
		Key: func(req *mmpb.RecommendNewSongsRequest) string {
			return "recommend:newSongs"
		},
		TTL: time.Hour,
	},
	NewResp: func() *mmpb.RecommendNewSongsResponse { return &mmpb.RecommendNewSongsResponse{} },
	MapRequest: func(req *mmpb.RecommendNewSongsRequest) (map[string]any, error) {
		limit := req.GetLimit()
		if limit <= 0 {
			limit = 10
		}
		return map[string]any{"type": "recommend", "limit": limit, "areaId": 0}, nil
	},
	MapResponse: func(req *mmpb.RecommendNewSongsRequest, raw json.RawMessage) (*mmpb.RecommendNewSongsResponse, error) {
		songs, err := model.DecodeRecommendNewSongs(raw)
		if err != nil {
			return nil, err
		}
		return &mmpb.RecommendNewSongsResponse{Songs: songs}, nil
	},
}
