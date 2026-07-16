// Package service 的 RecommendService impl。
package service

import (
	"context"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	recommendendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/recommend"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
)

// RecommendServer 实现 RecommendServiceServer。
type RecommendServer struct {
	mmpb.UnimplementedRecommendServiceServer
	eng *engine.Engine
}

// NewRecommendServer 创建 RecommendServer。
func NewRecommendServer(eng *engine.Engine) *RecommendServer {
	return &RecommendServer{eng: eng}
}

// GetDailyRecommend 获取每日推荐。恒一行。
func (s *RecommendServer) GetDailyRecommend(ctx context.Context, req *mmpb.GetDailyRecommendRequest) (*mmpb.GetDailyRecommendResponse, error) {
	resp, err := engine.Execute(s.eng, ctx, recommendendpoint.GetDailyRecommend, req)
	return resp, err
}

// DailyRecommendPlaylists 获取每日推荐歌单（结果按调用方而异，走 cookie override）。
func (s *RecommendServer) DailyRecommendPlaylists(ctx context.Context, req *mmpb.DailyRecommendPlaylistsRequest) (*mmpb.DailyRecommendPlaylistsResponse, error) {
	return executeOverride(s.eng, ctx, recommendendpoint.DailyRecommendPlaylists, req)
}

// RecommendPlaylists 获取推荐歌单。
func (s *RecommendServer) RecommendPlaylists(ctx context.Context, req *mmpb.RecommendPlaylistsRequest) (*mmpb.RecommendPlaylistsResponse, error) {
	return engine.Execute(s.eng, ctx, recommendendpoint.RecommendPlaylists, req)
}

// RecommendNewSongs 获取推荐新音乐。
func (s *RecommendServer) RecommendNewSongs(ctx context.Context, req *mmpb.RecommendNewSongsRequest) (*mmpb.RecommendNewSongsResponse, error) {
	return engine.Execute(s.eng, ctx, recommendendpoint.RecommendNewSongs, req)
}
