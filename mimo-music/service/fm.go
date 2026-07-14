// Package service 提供 mimo-music 的业务编排层。
package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	merrors "github.com/VOD-Studio/mimo-music/errors"
	"github.com/VOD-Studio/mimo-music/observability"
	"github.com/VOD-Studio/mimo-music/provider"
)

// FMService 是私人 FM 业务编排。
//
// 缓存策略：私人 FM 缓存 30 分钟（每次拉取不同歌曲，时效极强）。
// 依赖 Cookie 轮换取登录态注入 provider。
type FMService struct {
	fm      provider.FM
	rotator *SessionRotator
	cache   provider.Cache
	logger  provider.Logger
	metrics *observability.Metrics
}

// NewFMService 创建私人 FM service。
func NewFMService(
	fm provider.FM,
	rotator *SessionRotator,
	cache provider.Cache,
	logger provider.Logger,
	m *observability.Metrics,
) *FMService {
	return &FMService{fm: fm, rotator: rotator, cache: cache, logger: logger, metrics: m}
}

// Personal 获取私人 FM 歌曲。
//
// 先查缓存，未命中时通过 rotator 取可用 Cookie 注入 provider 调用。
// 所有 session 失效时返回 ErrNoAvailableSession（401/503）。
func (s *FMService) Personal(ctx context.Context) ([]provider.SongResult, error) {
	cacheKey := "fm:personal"

	if cached, ok, _ := s.cache.Get(ctx, cacheKey); ok {
		var songs []provider.SongResult
		if err := json.Unmarshal([]byte(cached), &songs); err == nil {
			s.metrics.RecordCacheHit()
			return songs, nil
		}
	}
	s.metrics.RecordCacheMiss()

	userID, cookie, err := s.rotator.NextCookie(ctx)
	if err != nil {
		return nil, err
	}

	start := time.Now()
	songs, err := s.fm.Personal(ctx, cookie)
	s.metrics.ObserveUpstreamLatency("fm_personal", time.Since(start).Seconds())
	if err != nil {
		s.metrics.RecordUpstreamError()
		_ = s.rotator.MarkUnavailable(ctx, userID)
		return nil, fmt.Errorf("%w: %v", merrors.ErrUnauthorized, err)
	}

	if data, err := json.Marshal(songs); err == nil {
		_ = s.cache.Set(ctx, cacheKey, string(data), 1800)
	}
	return songs, nil
}
