// Package album 的收藏专辑写操作接口声明（cookie override 路径）。
//
// 网易云用 path 区分收藏/取消：/album/sub 收藏、/album/unsub 取消。
// 拆成 Subscribe / Unsubscribe 两份端点（path 是 Meta 的固定字段，不能按请求动态派生），
// service 的 SubscribeAlbum 方法按请求的 subscribe 标志分派到对应端点。
package album

import (
	"encoding/json"
	"fmt"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// Subscribe 是收藏专辑的接口声明（cookie override）。
var Subscribe = &engine.Endpoint[*mmpb.SubscribeAlbumRequest, *mmpb.SubscribeAlbumResponse]{
	Meta: engine.Meta{
		Path: "/weapi/album/sub", Method: "POST",
		Crypto: engine.CryptoWeAPI, Auth: session.AuthLoggedIn,
	},
	Cache:   nil,
	NewResp: func() *mmpb.SubscribeAlbumResponse { return &mmpb.SubscribeAlbumResponse{} },
	MapRequest: func(req *mmpb.SubscribeAlbumRequest) (map[string]any, error) {
		return map[string]any{"id": fmt.Sprintf("%d", req.GetAlbumId())}, nil
	},
	MapResponse: func(req *mmpb.SubscribeAlbumRequest, raw json.RawMessage) (*mmpb.SubscribeAlbumResponse, error) {
		// 响应只有 code（engine 校验），回填操作后状态。
		return &mmpb.SubscribeAlbumResponse{Subscribed: true}, nil
	},
}

// Unsubscribe 是取消收藏专辑的接口声明（cookie override）。
var Unsubscribe = &engine.Endpoint[*mmpb.SubscribeAlbumRequest, *mmpb.SubscribeAlbumResponse]{
	Meta: engine.Meta{
		Path: "/weapi/album/unsub", Method: "POST",
		Crypto: engine.CryptoWeAPI, Auth: session.AuthLoggedIn,
	},
	Cache:   nil,
	NewResp: func() *mmpb.SubscribeAlbumResponse { return &mmpb.SubscribeAlbumResponse{} },
	MapRequest: func(req *mmpb.SubscribeAlbumRequest) (map[string]any, error) {
		return map[string]any{"id": fmt.Sprintf("%d", req.GetAlbumId())}, nil
	},
	MapResponse: func(req *mmpb.SubscribeAlbumRequest, raw json.RawMessage) (*mmpb.SubscribeAlbumResponse, error) {
		return &mmpb.SubscribeAlbumResponse{Subscribed: false}, nil
	},
}
