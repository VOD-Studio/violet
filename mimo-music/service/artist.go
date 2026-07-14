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

// ArtistService 是歌手业务编排。
//
// 缓存策略：歌手信息缓存 24 小时。
type ArtistService struct {
	artist  provider.Artist
	cache   provider.Cache
	logger  provider.Logger
	metrics *observability.Metrics
}

// NewArtistService 创建歌手 service。
func NewArtistService(artist provider.Artist, cache provider.Cache, logger provider.Logger, m *observability.Metrics) *ArtistService {
	return &ArtistService{artist: artist, cache: cache, logger: logger, metrics: m}
}

// Info 获取歌手信息及热门歌曲（含缓存）。
func (s *ArtistService) Info(ctx context.Context, artistID string) (provider.ArtistResult, error) {
	cacheKey := fmt.Sprintf("artist:info:%s", artistID)

	if cached, ok, _ := s.cache.Get(ctx, cacheKey); ok {
		var result provider.ArtistResult
		if err := json.Unmarshal([]byte(cached), &result); err == nil {
			s.metrics.RecordCacheHit()
			return result, nil
		}
	}
	s.metrics.RecordCacheMiss()

	start := time.Now()
	result, err := s.artist.Info(ctx, artistID)
	s.metrics.ObserveUpstreamLatency("artist_info", time.Since(start).Seconds())
	if err != nil {
		s.metrics.RecordUpstreamError()
		return provider.ArtistResult{}, err
	}

	if data, err := json.Marshal(result); err == nil {
		_ = s.cache.Set(ctx, cacheKey, string(data), 24*3600)
	}
	return result, nil
}
