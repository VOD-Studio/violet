// Package service 提供 mimo-music 的业务编排层。
package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/VOD-Studio/mimo-music/observability"
	"github.com/VOD-Studio/mimo-music/provider"
)

// SearchService 是搜索业务编排。
//
// 缓存策略：搜索结果缓存 10 分钟。
type SearchService struct {
	search provider.Search
	cache  provider.Cache
	logger provider.Logger
}

// NewSearchService 创建搜索 service。
func NewSearchService(search provider.Search, cache provider.Cache, logger provider.Logger) *SearchService {
	return &SearchService{search: search, cache: cache, logger: logger}
}

// Search 按关键词搜索（缓存 10min）。
func (s *SearchService) Search(ctx context.Context, keyword string, limit int) (provider.SearchResult, error) {
	cacheKey := fmt.Sprintf("search:%s:%d", keyword, limit)

	if cached, ok, _ := s.cache.Get(ctx, cacheKey); ok {
		var result provider.SearchResult
		if err := json.Unmarshal([]byte(cached), &result); err == nil {
			return result, nil
		}
	}

	start := time.Now()
	result, err := s.search.Search(ctx, keyword, limit)
	s.logger.Debug("upstream call done",
		slog.Int64(observability.FieldUpstreamLatencyMS, time.Since(start).Milliseconds()))
	if err != nil {
		return provider.SearchResult{}, err
	}

	if data, err := json.Marshal(result); err == nil {
		_ = s.cache.Set(ctx, cacheKey, string(data), 10*60)
	}
	return result, nil
}
