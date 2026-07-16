// Package service 的 UserService impl。
package service

import (
	"context"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	userendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/user"
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

// Account 获取当前登录账号信息（需登录态，cookie 由调用方传入）。
func (s *UserServer) Account(ctx context.Context, req *mmpb.AccountRequest) (*mmpb.AccountResponse, error) {
	return executeOverride(s.eng, ctx, userendpoint.Account, req)
}

// Detail 获取用户详情。
func (s *UserServer) Detail(ctx context.Context, req *mmpb.DetailRequest) (*mmpb.DetailResponse, error) {
	return engine.Execute(s.eng, ctx, userendpoint.Detail, req)
}

// SubCount 获取用户数量统计。
func (s *UserServer) SubCount(ctx context.Context, req *mmpb.SubCountRequest) (*mmpb.SubCountResponse, error) {
	return engine.Execute(s.eng, ctx, userendpoint.SubCount, req)
}

// UserPlaylist 获取用户歌单列表。filter 在 endpoint 的 MapResponse 内按 creator.userId 判断。
func (s *UserServer) UserPlaylist(ctx context.Context, req *mmpb.UserPlaylistRequest) (*mmpb.UserPlaylistResponse, error) {
	return engine.Execute(s.eng, ctx, userendpoint.UserPlaylist, req)
}

// DetailByName 根据 nickname 获取 userid（匿名 cookie 直接调用）。
func (s *UserServer) DetailByName(ctx context.Context, req *mmpb.DetailByNameRequest) (*mmpb.DetailByNameResponse, error) {
	return executeOverride(s.eng, ctx, userendpoint.DetailByName, req)
}

// FollowEachOther 判断两个用户是否互相关注（查 target 的关注列表，匿名 cookie）。
func (s *UserServer) FollowEachOther(ctx context.Context, req *mmpb.FollowEachOtherRequest) (*mmpb.FollowEachOtherResponse, error) {
	return executeOverride(s.eng, ctx, userendpoint.FollowEachOther, req)
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

// SimilarUsers 基于歌曲获取听歌的人。
func (s *UserServer) SimilarUsers(ctx context.Context, req *mmpb.SimilarUsersRequest) (*mmpb.SimilarUsersResponse, error) {
	return engine.Execute(s.eng, ctx, userendpoint.SimilarUsers, req)
}
