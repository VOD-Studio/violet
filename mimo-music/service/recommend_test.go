// Package service 提供 mimo-music 的业务编排层。
package service

import (
	"context"
	"errors"
	"testing"

	"github.com/VOD-Studio/mimo-music/observability"
	"github.com/VOD-Studio/mimo-music/provider"
)

// recommendMock 是 provider.Recommend 的测试 mock。
type recommendMock struct {
	songs []provider.SongResult
	err   error
}

func (m *recommendMock) Daily(ctx context.Context, cookie string) ([]provider.SongResult, error) {
	return m.songs, m.err
}

// TestRecommendDaily_CacheMissCallsProvider 验证缓存未命中时调 provider。
func TestRecommendDaily_CacheMissCallsProvider(t *testing.T) {
	rec := &recommendMock{songs: []provider.SongResult{{ID: "1", Name: "song1"}}}
	cache := &ttlCaptureCache{}
	store := &mockRotatorStore{sessions: map[string]string{"user1": "cookie1"}}
	avail := &mockAvailStore{unavail: map[string]bool{}}
	rotator := NewSessionRotator(store, avail)

	svc := NewRecommendService(rec, rotator, cache, provider.NoopLogger{}, observability.NewTestMetrics())
	songs, err := svc.Daily(context.Background())
	if err != nil {
		t.Fatalf("失败: %v", err)
	}
	if len(songs) != 1 || songs[0].ID != "1" {
		t.Errorf("songs = %v, want [song1]", songs)
	}
	// recommend TTL 应为 1 小时
	if cache.setTTL != 3600 {
		t.Errorf("recommend cache TTL = %d, want 3600", cache.setTTL)
	}
}

// TestRecommendDaily_NoAvailableSession 验证所有 session 失效时返回明确错误。
func TestRecommendDaily_NoAvailableSession(t *testing.T) {
	rec := &recommendMock{}
	cache := &ttlCaptureCache{}
	store := &mockRotatorStore{sessions: map[string]string{"user1": "cookie1"}}
	avail := &mockAvailStore{unavail: map[string]bool{"user1": true}}
	rotator := NewSessionRotator(store, avail)

	svc := NewRecommendService(rec, rotator, cache, provider.NoopLogger{}, observability.NewTestMetrics())
	_, err := svc.Daily(context.Background())
	if err == nil {
		t.Fatal("期望返回错误")
	}
	if err != ErrNoAvailableSession {
		t.Errorf("错误 = %v, want ErrNoAvailableSession", err)
	}
}

// TestRecommendDaily_PropagatesProviderError 验证 provider 错误传播并标记 session 不可用。
func TestRecommendDaily_PropagatesProviderError(t *testing.T) {
	rec := &recommendMock{err: errors.New("upstream down")}
	cache := &ttlCaptureCache{}
	store := &mockRotatorStore{sessions: map[string]string{"user1": "cookie1"}}
	avail := &mockAvailStore{unavail: map[string]bool{}}
	rotator := NewSessionRotator(store, avail)

	svc := NewRecommendService(rec, rotator, cache, provider.NoopLogger{}, observability.NewTestMetrics())
	_, err := svc.Daily(context.Background())
	if err == nil {
		t.Fatal("期望返回错误")
	}
	// session 应被标记为不可用
	if !avail.unavail["user1"] {
		t.Error("provider 失败后应标记 session 不可用")
	}
}
