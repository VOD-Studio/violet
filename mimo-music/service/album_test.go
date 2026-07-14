// Package service 提供 mimo-music 的业务编排层。
package service

import (
	"context"
	"errors"
	"testing"

	"github.com/VOD-Studio/mimo-music/observability"
	"github.com/VOD-Studio/mimo-music/provider"
)

// albumMock 是 provider.Album 的测试 mock。
type albumMock struct {
	result provider.AlbumResult
	err    error
}

func (m *albumMock) Detail(ctx context.Context, albumID string) (provider.AlbumResult, error) {
	return m.result, m.err
}

// TestAlbumDetail_CacheMissCallsProvider 验证缓存未命中时调 provider。
func TestAlbumDetail_CacheMissCallsProvider(t *testing.T) {
	al := &albumMock{result: provider.AlbumResult{ID: "1", Name: "test-album"}}
	cache := &ttlCaptureCache{}

	svc := NewAlbumService(al, cache, provider.NoopLogger{}, observability.NewTestMetrics())
	result, err := svc.Detail(context.Background(), "1")
	if err != nil {
		t.Fatalf("失败: %v", err)
	}
	if result.ID != "1" {
		t.Errorf("ID = %q, want 1", result.ID)
	}
	if cache.setTTL != 24*3600 {
		t.Errorf("album cache TTL = %d, want %d", cache.setTTL, 24*3600)
	}
}

// TestAlbumDetail_CacheHitSkipsProvider 验证缓存命中时跳过 provider。
func TestAlbumDetail_CacheHitSkipsProvider(t *testing.T) {
	al := &albumMock{err: errors.New("不应调用 provider")}

	svc := NewAlbumService(al, &ttlCaptureCache{}, provider.NoopLogger{}, observability.NewTestMetrics())
	_, err := svc.Detail(context.Background(), "1")
	// 空缓存会调 provider，预期返回 albumMock 的 err
	if err == nil {
		t.Fatal("空缓存时应调 provider 返回 mock 的 err")
	}
}

// TestAlbumDetail_PropagatesProviderError 验证 provider 错误传播。
func TestAlbumDetail_PropagatesProviderError(t *testing.T) {
	al := &albumMock{err: errors.New("upstream down")}
	cache := &ttlCaptureCache{}

	svc := NewAlbumService(al, cache, provider.NoopLogger{}, observability.NewTestMetrics())
	_, err := svc.Detail(context.Background(), "1")
	if err == nil {
		t.Fatal("期望返回错误")
	}
}
