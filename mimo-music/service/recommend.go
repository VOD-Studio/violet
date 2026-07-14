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

// RecommendService 是每日推荐业务编排。
//
// 缓存策略：每日推荐缓存 1 小时（内容时效性强）。
// 依赖 Cookie 轮换取登录态注入 provider。
type RecommendService struct {
	recommend provider.Recommend
	rotator   *SessionRotator
	cache     provider.Cache
	logger    provider.Logger
	metrics   *observability.Metrics
}

// NewRecommendService 创建每日推荐 service。
func NewRecommendService(
	recommend provider.Recommend,
	rotator *SessionRotator,
	cache provider.Cache,
	logger provider.Logger,
	m *observability.Metrics,
) *RecommendService {
	return &RecommendService{recommend: recommend, rotator: rotator, cache: cache, logger: logger, metrics: m}
}

// Daily 获取每日推荐歌曲。
//
// 先查缓存，未命中时通过 rotator 取可用 Cookie 注入 provider 调用。
// 所有 session 失效时返回 ErrNoAvailableSession（401/503）。
func (s *RecommendService) Daily(ctx context.Context) ([]provider.SongResult, error) {
	cacheKey := "recommend:daily"

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
	songs, err := s.recommend.Daily(ctx, cookie)
	s.metrics.ObserveUpstreamLatency("recommend_daily", time.Since(start).Seconds())
	if err != nil {
		s.metrics.RecordUpstreamError()
		// Cookie 失效则标记不可用
		_ = s.rotator.MarkUnavailable(ctx, userID)
		return nil, fmt.Errorf("%w: %v", merrors.ErrUnauthorized, err)
	}

	if data, err := json.Marshal(songs); err == nil {
		_ = s.cache.Set(ctx, cacheKey, string(data), 3600)
	}
	return songs, nil
}
