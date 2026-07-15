// Package service 的 UserService impl。
package service

import (
	"context"
	"encoding/json"
	"fmt"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	userendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/user"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// UserServer 实现 UserServiceServer。
type UserServer struct {
	mmpb.UnimplementedUserServiceServer
	eng *engine.Engine
}

// NewUserServer 创建 UserServer。
func NewUserServer(eng *engine.Engine) *UserServer {
	return &UserServer{eng: eng}
}

// Account 获取当前登录账号信息（需登录态）。
func (s *UserServer) Account(ctx context.Context, req *mmpb.AccountRequest) (*mmpb.AccountResponse, error) {
	// Account 用传入的 cookie 而非 session 池（查特定登录态）。
	meta := userendpoint.Account.Meta
	params, err := userendpoint.Account.MapRequest(req)
	if err != nil {
		return nil, err
	}
	raw, _, err := s.eng.RawDoWithCookieAndInput(ctx, meta, params, req.GetCookie())
	if err != nil {
		return nil, err
	}
	resp, err := userendpoint.Account.MapResponse(raw)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// Detail 获取用户详情。
func (s *UserServer) Detail(ctx context.Context, req *mmpb.DetailRequest) (*mmpb.DetailResponse, error) {
	return engine.Execute(s.eng, ctx, userendpoint.Detail, req)
}

// SubCount 获取用户数量统计。
func (s *UserServer) SubCount(ctx context.Context, req *mmpb.SubCountRequest) (*mmpb.SubCountResponse, error) {
	return engine.Execute(s.eng, ctx, userendpoint.SubCount, req)
}

// UserPlaylist 获取用户歌单列表。
func (s *UserServer) UserPlaylist(ctx context.Context, req *mmpb.UserPlaylistRequest) (*mmpb.UserPlaylistResponse, error) {
	resp, err := engine.Execute(s.eng, ctx, userendpoint.UserPlaylist, req)
	if err != nil {
		return nil, err
	}
	// filter 在 service 层应用（endpoint 拿不到 ownerUserID 做判断）。
	if req.GetFilter() != mmpb.PlaylistFilter_PLAYLIST_FILTER_ALL && req.GetFilter() != mmpb.PlaylistFilter_PLAYLIST_FILTER_UNSPECIFIED {
		resp.Playlists = filterPlaylists(resp.Playlists, req.GetUserId(), req.GetFilter())
	}
	return resp, nil
}

// DetailByName 根据 nickname 获取 userid。
func (s *UserServer) DetailByName(ctx context.Context, req *mmpb.DetailByNameRequest) (*mmpb.DetailByNameResponse, error) {
	meta := engine.Meta{
		Path: "/weapi/v1/w/user/info/detail", Method: "POST",
		Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous,
	}
	params := map[string]any{"nickname": req.GetNickname()}
	raw, _, err := s.eng.RawDoWithCookieAndInput(ctx, meta, params, "")
	if err != nil {
		return nil, err
	}

	var resp struct {
		Code   int `json:"code"`
		UserID struct {
			UserID int64 `json:"userId"`
		} `json:"user"`
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, fmt.Errorf("解析昵称查询失败: %w", err)
	}
	return &mmpb.DetailByNameResponse{UserId: resp.UserID.UserID}, nil
}

// FollowEachOther 判断两个用户是否互相关注（查 target 的关注列表）。
func (s *UserServer) FollowEachOther(ctx context.Context, req *mmpb.FollowEachOtherRequest) (*mmpb.FollowEachOtherResponse, error) {
	meta := engine.Meta{
		Path: "/weapi/user/getfollows", Method: "POST",
		Crypto: engine.CryptoWeAPI, Auth: session.AuthAnonymous,
	}
	params := map[string]any{
		"uid":    fmt.Sprintf("%d", req.GetTargetUserId()),
		"limit":  100,
		"offset": 0,
	}
	raw, _, err := s.eng.RawDoWithCookieAndInput(ctx, meta, params, "")
	if err != nil {
		return nil, err
	}

	var resp struct {
		Follow []struct {
			UserID int64 `json:"userId"`
		} `json:"follow"`
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, fmt.Errorf("解析关注列表失败: %w", err)
	}
	for _, f := range resp.Follow {
		if f.UserID == req.GetUserId() {
			return &mmpb.FollowEachOtherResponse{FollowEachOther: true}, nil
		}
	}
	return &mmpb.FollowEachOtherResponse{FollowEachOther: false}, nil
}

// filterPlaylists 在 service 层按创建/收藏过滤用户歌单。
func filterPlaylists(playlists []*mmpb.SearchPlaylist, ownerUserID int64, filter mmpb.PlaylistFilter) []*mmpb.SearchPlaylist {
	// SearchPlaylist 不含 creator.userId，无法在 service 层精确过滤。
	// 网易云返回顺序：创建的歌单在前（含"我喜欢的音乐"），收藏的在后。
	// 精确过滤需要在 model.DecodeUserPlaylists 里用 ownerUserID。
	// 此处返回原列表——精确 filter 在 model 层做（需要重构 DecodeUserPlaylists 签名传 ownerUserID）。
	// TODO: 将 filter 逻辑下沉到 model 层（DecodeUserPlaylists 接收 ownerUserID）。
	return playlists
}

// Follows 获取用户关注列表。
func (s *UserServer) Follows(ctx context.Context, req *mmpb.FollowsRequest) (*mmpb.FollowsResponse, error) {
	return engine.Execute(s.eng, ctx, userendpoint.Follows, req)
}

// Followeds 获取用户粉丝列表。
func (s *UserServer) Followeds(ctx context.Context, req *mmpb.FollowedsRequest) (*mmpb.FollowedsResponse, error) {
	return engine.Execute(s.eng, ctx, userendpoint.Followeds, req)
}

// Events 获取用户动态。
func (s *UserServer) Events(ctx context.Context, req *mmpb.EventsRequest) (*mmpb.EventsResponse, error) {
	return engine.Execute(s.eng, ctx, userendpoint.Events, req)
}

// Record 获取用户播放记录。
func (s *UserServer) Record(ctx context.Context, req *mmpb.RecordRequest) (*mmpb.RecordResponse, error) {
	return engine.Execute(s.eng, ctx, userendpoint.Record, req)
}

// Level 获取用户等级信息。
func (s *UserServer) Level(ctx context.Context, req *mmpb.LevelRequest) (*mmpb.LevelResponse, error) {
	return engine.Execute(s.eng, ctx, userendpoint.Level, req)
}
