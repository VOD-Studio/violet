// Package user 定义用户模块接口的声明。
package user

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/model"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// Account 是获取当前登录账号信息的接口声明（需登录态）。
var Account = &engine.Endpoint[*mmpb.AccountRequest, *mmpb.AccountResponse]{
	Meta: engine.Meta{
		Path: "/weapi/w/nuser/account/get", Method: "POST",
		Crypto: engine.CryptoWeAPI, Auth: session.AuthLoggedIn,
	},
	NewResp:    func() *mmpb.AccountResponse { return &mmpb.AccountResponse{} },
	MapRequest: func(*mmpb.AccountRequest) (map[string]any, error) { return map[string]any{}, nil },
	MapResponse: func(_ *mmpb.AccountRequest, raw json.RawMessage) (*mmpb.AccountResponse, error) {
		u, err := model.DecodeUserDetail(raw)
		if err != nil {
			return nil, err
		}
		return &mmpb.AccountResponse{User: u}, nil
	},
}

// Detail 是获取用户详情的接口声明。
var Detail = &engine.Endpoint[*mmpb.DetailRequest, *mmpb.DetailResponse]{
	Meta: engine.Meta{
		Path: "/weapi/v3/user/detail", Method: "POST",
		Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.DetailRequest]{
		Key: func(req *mmpb.DetailRequest) string { return fmt.Sprintf("user:detail:%d", req.GetUserId()) },
		TTL: 24 * time.Hour,
	},
	NewResp: func() *mmpb.DetailResponse { return &mmpb.DetailResponse{} },
	MapRequest: func(req *mmpb.DetailRequest) (map[string]any, error) {
		return map[string]any{"id": fmt.Sprintf("%d", req.GetUserId())}, nil
	},
	MapResponse: func(_ *mmpb.DetailRequest, raw json.RawMessage) (*mmpb.DetailResponse, error) {
		u, err := model.DecodeUserDetail(raw)
		if err != nil {
			return nil, err
		}
		return &mmpb.DetailResponse{User: u}, nil
	},
}

// SubCount 是获取用户数量统计的接口声明。
var SubCount = &engine.Endpoint[*mmpb.SubCountRequest, *mmpb.SubCountResponse]{
	Meta: engine.Meta{
		Path: "/weapi/subcount", Method: "POST",
		Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.SubCountRequest]{
		Key: func(req *mmpb.SubCountRequest) string { return fmt.Sprintf("user:subcount:%d", req.GetUserId()) },
		TTL: 24 * time.Hour,
	},
	NewResp: func() *mmpb.SubCountResponse { return &mmpb.SubCountResponse{} },
	MapRequest: func(req *mmpb.SubCountRequest) (map[string]any, error) {
		// SubCount 需登录态查自己，此处传 userId 给上游。
		return map[string]any{}, nil
	},
	MapResponse: func(_ *mmpb.SubCountRequest, raw json.RawMessage) (*mmpb.SubCountResponse, error) {
		c, err := model.DecodeUserSubCount(raw)
		if err != nil {
			return nil, err
		}
		return &mmpb.SubCountResponse{Count: c}, nil
	},
}

// UserPlaylist 是获取用户歌单列表的接口声明。
//
// filter（ALL/CREATED/SUBSCRIBED）在 MapResponse 内按 creator.userId == 请求 userId 判断，
// ownerUserID 直接取自请求，无需 service 层后置过滤。
var UserPlaylist = &engine.Endpoint[*mmpb.UserPlaylistRequest, *mmpb.UserPlaylistResponse]{
	Meta: engine.Meta{
		Path: "/weapi/user/playlist", Method: "POST",
		Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.UserPlaylistRequest]{
		// cache key 含 filter 维度，不同 filter 不串缓存。
		Key: func(req *mmpb.UserPlaylistRequest) string {
			return fmt.Sprintf("user:playlist:%d:%d:%d:%d", req.GetUserId(), req.GetFilter(), req.GetLimit(), req.GetOffset())
		},
		TTL: 24 * time.Hour,
	},
	NewResp: func() *mmpb.UserPlaylistResponse { return &mmpb.UserPlaylistResponse{} },
	MapRequest: func(req *mmpb.UserPlaylistRequest) (map[string]any, error) {
		limit := int(req.GetLimit())
		if limit <= 0 {
			limit = 30
		}
		return map[string]any{
			"uid":    fmt.Sprintf("%d", req.GetUserId()),
			"limit":  limit,
			"offset": req.GetOffset(),
		}, nil
	},
	MapResponse: func(req *mmpb.UserPlaylistRequest, raw json.RawMessage) (*mmpb.UserPlaylistResponse, error) {
		pls, total, err := model.DecodeUserPlaylists(raw, req.GetUserId(), req.GetFilter())
		if err != nil {
			return nil, err
		}
		return &mmpb.UserPlaylistResponse{Playlists: pls, Total: total}, nil
	},
}
