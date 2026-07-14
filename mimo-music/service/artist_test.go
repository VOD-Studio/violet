// Package service 提供 mimo-music 的业务编排层。
package service

import (
	"context"
	"errors"
	"testing"

	"github.com/VOD-Studio/mimo-music/observability"
	"github.com/VOD-Studio/mimo-music/provider"
)

// artistMock 是 provider.Artist 的测试 mock。
type artistMock struct {
	result provider.ArtistResult
	err    error
}

func (m *artistMock) Info(ctx context.Context, artistID string) (provider.ArtistResult, error) {
	return m.result, m.err
}

// TestArtistInfo_CacheMissCallsProvider 验证缓存未命中时调 provider。
func TestArtistInfo_CacheMissCallsProvider(t *testing.T) {
	ar := &artistMock{result: provider.ArtistResult{ID: "1", Name: "test-artist"}}
	cache := &ttlCaptureCache{}

	svc := NewArtistService(ar, cache, provider.NoopLogger{}, observability.NewTestMetrics())
	result, err := svc.Info(context.Background(), "1")
	if err != nil {
		t.Fatalf("失败: %v", err)
	}
	if result.ID != "1" {
		t.Errorf("ID = %q, want 1", result.ID)
	}
	if cache.setTTL != 24*3600 {
		t.Errorf("artist cache TTL = %d, want %d", cache.setTTL, 24*3600)
	}
}

// TestArtistInfo_PropagatesProviderError 验证 provider 错误传播。
func TestArtistInfo_PropagatesProviderError(t *testing.T) {
	ar := &artistMock{err: errors.New("upstream down")}
	cache := &ttlCaptureCache{}

	svc := NewArtistService(ar, cache, provider.NoopLogger{}, observability.NewTestMetrics())
	_, err := svc.Info(context.Background(), "1")
	if err == nil {
		t.Fatal("期望返回错误")
	}
}
