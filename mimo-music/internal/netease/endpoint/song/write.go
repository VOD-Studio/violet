// Package song 的写操作接口声明（cookie override 路径）。
//
// Like / Trash / DisallowRecommend 三个写操作：Cache=nil（不缓存），
// Auth=AuthLoggedIn（需登录态），service 层走 executeOverride（cookie 从 context 取）。
package song

import (
	"encoding/json"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// loggedInWeapiMeta 构造 weapi POST + LoggedIn 的 Meta（歌曲写操作统一参数）。
func loggedInWeapiMeta(path string) engine.Meta {
	return engine.Meta{Path: path, Method: "POST", Crypto: engine.CryptoWeAPI, Auth: session.AuthLoggedIn}
}

// Like 是喜欢/取消喜欢歌曲的接口声明（toggle）。
// 网易云 /weapi/radio/like，params 含 alg（推荐算法标记）、trackId、like（bool）、time。
// 响应只有 code（engine 已统一校验），MapResponse 回填操作后的 liked 状态。
var Like = &engine.Endpoint[*mmpb.LikeRequest, *mmpb.LikeResponse]{
	Meta:    loggedInWeapiMeta("/weapi/radio/like"),
	Cache:   nil,
	NewResp: func() *mmpb.LikeResponse { return &mmpb.LikeResponse{} },
	MapRequest: func(req *mmpb.LikeRequest) (map[string]any, error) {
		return map[string]any{
			"alg":     "itembased",
			"trackId": req.GetSongId(),
			"like":    req.GetLike(),
			"time":    "3",
		}, nil
	},
	MapResponse: func(req *mmpb.LikeRequest, raw json.RawMessage) (*mmpb.LikeResponse, error) {
		// 响应仅 code（engine 校验），回填请求里的 like 作为操作后状态。
		return &mmpb.LikeResponse{Liked: req.GetLike()}, nil
	},
}

// Trash 是把歌曲丢进垃圾桶的接口声明（降低推荐权重）。
var Trash = &engine.Endpoint[*mmpb.TrashRequest, *mmpb.TrashResponse]{
	Meta:    loggedInWeapiMeta("/weapi/radio/trash/add"),
	Cache:   nil,
	NewResp: func() *mmpb.TrashResponse { return &mmpb.TrashResponse{} },
	MapRequest: func(req *mmpb.TrashRequest) (map[string]any, error) {
		return map[string]any{
			"songId": req.GetSongId(),
			"alg":    "RT",
			"time":   25,
		}, nil
	},
	MapResponse: func(req *mmpb.TrashRequest, raw json.RawMessage) (*mmpb.TrashResponse, error) {
		return &mmpb.TrashResponse{}, nil
	},
}

// DisallowRecommend 是标记每日推荐歌曲不感兴趣的接口声明。
// resType=4（歌曲）、sceneType=1（每日推荐）为网易云固定常量。
var DisallowRecommend = &engine.Endpoint[*mmpb.DisallowRecommendRequest, *mmpb.DisallowRecommendResponse]{
	Meta:    loggedInWeapiMeta("/weapi/v2/discovery/recommend/dislike"),
	Cache:   nil,
	NewResp: func() *mmpb.DisallowRecommendResponse { return &mmpb.DisallowRecommendResponse{} },
	MapRequest: func(req *mmpb.DisallowRecommendRequest) (map[string]any, error) {
		return map[string]any{
			"resId":     req.GetSongId(),
			"resType":   4,
			"sceneType": 1,
		}, nil
	},
	MapResponse: func(req *mmpb.DisallowRecommendRequest, raw json.RawMessage) (*mmpb.DisallowRecommendResponse, error) {
		return &mmpb.DisallowRecommendResponse{}, nil
	},
}
