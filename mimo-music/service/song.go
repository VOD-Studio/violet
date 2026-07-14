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

// SongService 是歌曲业务编排。
//
// 缓存策略：详情/歌词 24 小时，播放 URL 30 分钟（URL 会过期）。
type SongService struct {
	song   provider.Song
	cache  provider.Cache
	logger provider.Logger
	metrics *observability.Metrics
}

// NewSongService 创建歌曲 service。
func NewSongService(song provider.Song, cache provider.Cache, logger provider.Logger, m *observability.Metrics) *SongService {
	return &SongService{song: song, cache: cache, logger: logger, metrics: m}
}

// Detail 获取歌曲详情（缓存 24h）。
func (s *SongService) Detail(ctx context.Context, songID string) (provider.SongResult, error) {
	cacheKey := fmt.Sprintf("song:detail:%s", songID)

	if cached, ok, _ := s.cache.Get(ctx, cacheKey); ok {
		var result provider.SongResult
		if err := json.Unmarshal([]byte(cached), &result); err == nil {
			s.metrics.RecordCacheHit()
			return result, nil
		}
	}
	s.metrics.RecordCacheMiss()

	start := time.Now()
	result, err := s.song.Detail(ctx, songID)
	s.metrics.ObserveUpstreamLatency("song_detail", time.Since(start).Seconds())
	s.logger.Debug("upstream call done",
		slog.Int64(observability.FieldUpstreamLatencyMS, time.Since(start).Milliseconds()))
	if err != nil {
		s.metrics.RecordUpstreamError()
		return provider.SongResult{}, err
	}

	if data, err := json.Marshal(result); err == nil {
		_ = s.cache.Set(ctx, cacheKey, string(data), 24*3600)
	}
	return result, nil
}

// URL 获取播放直链（缓存 30min，URL 会过期）。
func (s *SongService) URL(ctx context.Context, songID, level string) (string, error) {
	cacheKey := fmt.Sprintf("song:url:%s:%s", songID, level)

	if cached, ok, _ := s.cache.Get(ctx, cacheKey); ok && cached != "" {
		s.metrics.RecordCacheHit()
		return cached, nil
	}
	s.metrics.RecordCacheMiss()

	start := time.Now()
	url, err := s.song.URL(ctx, songID, level)
	s.metrics.ObserveUpstreamLatency("song_url", time.Since(start).Seconds())
	s.logger.Debug("upstream call done",
		slog.Int64(observability.FieldUpstreamLatencyMS, time.Since(start).Milliseconds()))
	if err != nil {
		s.metrics.RecordUpstreamError()
		return "", err
	}

	if url != "" {
		_ = s.cache.Set(ctx, cacheKey, url, 30*60)
	}
	return url, nil
}

// Lyric 获取歌词（缓存 24h）。
func (s *SongService) Lyric(ctx context.Context, songID string) (provider.LyricResult, error) {
	cacheKey := fmt.Sprintf("song:lyric:%s", songID)

	if cached, ok, _ := s.cache.Get(ctx, cacheKey); ok {
		var result provider.LyricResult
		if err := json.Unmarshal([]byte(cached), &result); err == nil {
			s.metrics.RecordCacheHit()
			return result, nil
		}
	}
	s.metrics.RecordCacheMiss()

	start := time.Now()
	result, err := s.song.Lyric(ctx, songID)
	s.metrics.ObserveUpstreamLatency("song_lyric", time.Since(start).Seconds())
	s.logger.Debug("upstream call done",
		slog.Int64(observability.FieldUpstreamLatencyMS, time.Since(start).Milliseconds()))
	if err != nil {
		s.metrics.RecordUpstreamError()
		return provider.LyricResult{}, err
	}

	if data, err := json.Marshal(result); err == nil {
		_ = s.cache.Set(ctx, cacheKey, string(data), 24*3600)
	}
	return result, nil
}
