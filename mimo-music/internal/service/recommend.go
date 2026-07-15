// Package service 的 RecommendService impl。
package service

import (
	"context"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	recommendendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/recommend"
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
