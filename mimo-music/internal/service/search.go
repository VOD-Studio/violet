// Package service 的 SearchService impl。
package service

import (
	"context"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	searchendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/search"
)

// SearchServer 实现 SearchServiceServer。
type SearchServer struct {
	mmpb.UnimplementedSearchServiceServer
	eng *engine.Engine
}

// NewSearchServer 创建 SearchServer。
func NewSearchServer(eng *engine.Engine) *SearchServer {
	return &SearchServer{eng: eng}
}

// Search 按关键词搜索。恒一行。
func (s *SearchServer) Search(ctx context.Context, req *mmpb.SearchRequest) (*mmpb.SearchResponse, error) {
	return engine.Execute(s.eng, ctx, searchendpoint.Search, req)
}

// Suggest 获取搜索建议。
func (s *SearchServer) Suggest(ctx context.Context, req *mmpb.SuggestRequest) (*mmpb.SuggestResponse, error) {
	return engine.Execute(s.eng, ctx, searchendpoint.Suggest, req)
}

// Hot 获取热搜词列表（简略）。
func (s *SearchServer) Hot(ctx context.Context, req *mmpb.HotRequest) (*mmpb.HotResponse, error) {
	return engine.Execute(s.eng, ctx, searchendpoint.Hot, req)
}

// HotDetail 获取热搜词列表（详细）。
func (s *SearchServer) HotDetail(ctx context.Context, req *mmpb.HotDetailRequest) (*mmpb.HotDetailResponse, error) {
	return engine.Execute(s.eng, ctx, searchendpoint.HotDetail, req)
}

// DefaultKeyword 获取默认搜索词。
func (s *SearchServer) DefaultKeyword(ctx context.Context, req *mmpb.DefaultKeywordRequest) (*mmpb.DefaultKeywordResponse, error) {
	return engine.Execute(s.eng, ctx, searchendpoint.DefaultKeyword, req)
}
