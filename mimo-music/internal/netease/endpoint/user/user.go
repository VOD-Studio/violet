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
	MapRequest: func(*mmpb.AccountRequest) (map[string]any, error) { return map[string]any{}, nil },
	MapResponse: func(raw json.RawMessage) (*mmpb.AccountResponse, error) {
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
	MapRequest: func(req *mmpb.DetailRequest) (map[string]any, error) {
		return map[string]any{"id": fmt.Sprintf("%d", req.GetUserId())}, nil
	},
	MapResponse: func(raw json.RawMessage) (*mmpb.DetailResponse, error) {
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
		Path: "/weapi/user/subcount", Method: "POST",
		Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.SubCountRequest]{
		Key: func(req *mmpb.SubCountRequest) string { return fmt.Sprintf("user:subcount:%d", req.GetUserId()) },
		TTL: 24 * time.Hour,
	},
	MapRequest: func(req *mmpb.SubCountRequest) (map[string]any, error) {
		// SubCount 需登录态查自己，此处传 userId 给上游。
		return map[string]any{}, nil
	},
	MapResponse: func(raw json.RawMessage) (*mmpb.SubCountResponse, error) {
		c, err := model.DecodeUserSubCount(raw)
		if err != nil {
			return nil, err
		}
		return &mmpb.SubCountResponse{Count: c}, nil
	},
}

// UserPlaylist 是获取用户歌单列表的接口声明。
var UserPlaylist = &engine.Endpoint[*mmpb.UserPlaylistRequest, *mmpb.UserPlaylistResponse]{
	Meta: engine.Meta{
		Path: "/weapi/user/playlist", Method: "POST",
		Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.UserPlaylistRequest]{
		Key: func(req *mmpb.UserPlaylistRequest) string {
			return fmt.Sprintf("user:playlist:%d:%d:%d", req.GetUserId(), req.GetLimit(), req.GetOffset())
		},
		TTL: 24 * time.Hour,
	},
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
	MapResponse: func(raw json.RawMessage) (*mmpb.UserPlaylistResponse, error) {
		// filter 在 MapResponse 里应用——但 DecodeUserPlaylists 需要 ownerUserID。
		// 网易云返回的歌单里带 creator.userId，DecodeUserPlaylists 内部用它判断。
		// 此处 ownerUserID 传 0（无法从响应外得知），filter 在 service 层做。
		pls, total, err := model.DecodeUserPlaylists(raw, 0, mmpb.PlaylistFilter_PLAYLIST_FILTER_ALL)
		if err != nil {
			return nil, err
		}
		return &mmpb.UserPlaylistResponse{Playlists: pls, Total: total}, nil
	},
}
