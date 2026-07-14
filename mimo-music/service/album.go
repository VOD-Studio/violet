// Package service 提供 mimo-music 的业务编排层。
package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/VOD-Studio/mimo-music/observability"
	"github.com/VOD-Studio/mimo-music/provider"
)

// AlbumService 是专辑业务编排。
//
// 缓存策略：专辑详情缓存 24 小时。
type AlbumService struct {
	album   provider.Album
	cache   provider.Cache
	logger  provider.Logger
	metrics *observability.Metrics
}

// NewAlbumService 创建专辑 service。
func NewAlbumService(album provider.Album, cache provider.Cache, logger provider.Logger, m *observability.Metrics) *AlbumService {
	return &AlbumService{album: album, cache: cache, logger: logger, metrics: m}
}

// Detail 获取专辑详情（含缓存）。
func (s *AlbumService) Detail(ctx context.Context, albumID string) (provider.AlbumResult, error) {
	cacheKey := fmt.Sprintf("album:detail:%s", albumID)

	if cached, ok, _ := s.cache.Get(ctx, cacheKey); ok {
		var result provider.AlbumResult
		if err := json.Unmarshal([]byte(cached), &result); err == nil {
			s.metrics.RecordCacheHit()
			return result, nil
		}
	}
	s.metrics.RecordCacheMiss()

	start := time.Now()
	result, err := s.album.Detail(ctx, albumID)
	s.metrics.ObserveUpstreamLatency("album_detail", time.Since(start).Seconds())
	if err != nil {
		s.metrics.RecordUpstreamError()
		return provider.AlbumResult{}, err
	}

	if data, err := json.Marshal(result); err == nil {
		_ = s.cache.Set(ctx, cacheKey, string(data), 24*3600)
	}
	return result, nil
}
