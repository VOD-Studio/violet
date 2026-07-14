// Package service 提供 mimo-music 的业务编排层。
package service

import (
	"context"
	"errors"
	"testing"

	"github.com/VOD-Studio/mimo-music/observability"
	"github.com/VOD-Studio/mimo-music/provider"
)

// fmMock 是 provider.FM 的测试 mock。
type fmMock struct {
	songs []provider.SongResult
	err   error
}

func (m *fmMock) Personal(ctx context.Context, cookie string) ([]provider.SongResult, error) {
	return m.songs, m.err
}

// TestFMPersonal_CacheMissCallsProvider 验证缓存未命中时调 provider。
func TestFMPersonal_CacheMissCallsProvider(t *testing.T) {
	fm := &fmMock{songs: []provider.SongResult{{ID: "1", Name: "fm-song"}}}
	cache := &ttlCaptureCache{}
	store := &mockRotatorStore{sessions: map[string]string{"user1": "cookie1"}}
	avail := &mockAvailStore{unavail: map[string]bool{}}
	rotator := NewSessionRotator(store, avail)

	svc := NewFMService(fm, rotator, cache, provider.NoopLogger{}, observability.NewTestMetrics())
	songs, err := svc.Personal(context.Background())
	if err != nil {
		t.Fatalf("失败: %v", err)
	}
	if len(songs) != 1 || songs[0].ID != "1" {
		t.Errorf("songs = %v, want [fm-song]", songs)
	}
	// FM TTL 应为 30 分钟
	if cache.setTTL != 1800 {
		t.Errorf("FM cache TTL = %d, want 1800", cache.setTTL)
	}
}

// TestFMPersonal_NoAvailableSession 验证所有 session 失效时返回明确错误。
func TestFMPersonal_NoAvailableSession(t *testing.T) {
	fm := &fmMock{}
	cache := &ttlCaptureCache{}
	store := &mockRotatorStore{sessions: map[string]string{"user1": "cookie1"}}
	avail := &mockAvailStore{unavail: map[string]bool{"user1": true}}
	rotator := NewSessionRotator(store, avail)

	svc := NewFMService(fm, rotator, cache, provider.NoopLogger{}, observability.NewTestMetrics())
	_, err := svc.Personal(context.Background())
	if err != ErrNoAvailableSession {
		t.Errorf("错误 = %v, want ErrNoAvailableSession", err)
	}
}

// TestFMPersonal_PropagatesProviderError 验证 provider 错误传播并标记 session。
func TestFMPersonal_PropagatesProviderError(t *testing.T) {
	fm := &fmMock{err: errors.New("upstream down")}
	cache := &ttlCaptureCache{}
	store := &mockRotatorStore{sessions: map[string]string{"user1": "cookie1"}}
	avail := &mockAvailStore{unavail: map[string]bool{}}
	rotator := NewSessionRotator(store, avail)

	svc := NewFMService(fm, rotator, cache, provider.NoopLogger{}, observability.NewTestMetrics())
	_, err := svc.Personal(context.Background())
	if err == nil {
		t.Fatal("期望返回错误")
	}
	if !avail.unavail["user1"] {
		t.Error("provider 失败后应标记 session 不可用")
	}
}
