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

// PlaylistService 是歌单业务编排。
//
// 缓存策略：歌单详情缓存 24 小时。先查缓存，未命中调 provider 并写入缓存。
type PlaylistService struct {
	playlist provider.Playlist
	cache    provider.Cache
	logger   provider.Logger
	metrics  *observability.Metrics
}

// NewPlaylistService 创建歌单 service。
func NewPlaylistService(p provider.Playlist, cache provider.Cache, logger provider.Logger, m *observability.Metrics) *PlaylistService {
	return &PlaylistService{playlist: p, cache: cache, logger: logger, metrics: m}
}

// Detail 获取歌单详情（含缓存）。
func (s *PlaylistService) Detail(ctx context.Context, playlistID string) (provider.PlaylistResult, error) {
	cacheKey := fmt.Sprintf("playlist:detail:%s", playlistID)

	// 查缓存
	if cached, ok, _ := s.cache.Get(ctx, cacheKey); ok {
		var result provider.PlaylistResult
		if err := json.Unmarshal([]byte(cached), &result); err == nil {
			s.metrics.RecordCacheHit()
			s.logger.Debug("cache hit", slog.String(observability.FieldCacheHit, "true"),
				slog.String("cache_key", cacheKey))
			return result, nil
		}
	}
	s.metrics.RecordCacheMiss()

	// 调 provider
	start := time.Now()
	result, err := s.playlist.Detail(ctx, playlistID)
	elapsed := time.Since(start).Seconds()
	s.metrics.ObserveUpstreamLatency("playlist_detail", elapsed)
	if err != nil {
		s.metrics.RecordUpstreamError()
		return provider.PlaylistResult{}, err
	}
	s.logger.Debug("upstream call done",
		slog.Int64(observability.FieldUpstreamLatencyMS, time.Since(start).Milliseconds()),
		slog.String(observability.FieldCacheHit, "false"))

	// 写缓存（24 小时）
	if data, err := json.Marshal(result); err == nil {
		_ = s.cache.Set(ctx, cacheKey, string(data), 24*3600)
	}

	return result, nil
}
