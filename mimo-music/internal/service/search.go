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
	resp, err := engine.Execute(s.eng, ctx, searchendpoint.Search, req)
	return &resp, err
}
