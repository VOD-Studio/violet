package provider_test

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	merrors "github.com/VOD-Studio/mimo-music/errors"
	"github.com/VOD-Studio/mimo-music/provider"
)

// mockPlaylist 是 Playlist 接口的测试 mock，可配置返回值和调用计数。
type mockPlaylist struct {
	result  provider.PlaylistResult
	err     error
	calls   int32
	failN   int32 // 前 N 次返回 err
	errToRt error // 失败时返回的错误
}

func (m *mockPlaylist) Detail(ctx context.Context, playlistID string) (provider.PlaylistResult, error) {
	n := atomic.AddInt32(&m.calls, 1)
	if m.failN > 0 && n <= m.failN {
		return provider.PlaylistResult{}, m.errToRt
	}
	return m.result, m.err
}

// mockProvider 是 Provider 接口的测试 mock。
type mockProvider struct {
	pl provider.Playlist
}

func (m *mockProvider) Platform() string                  { return "test" }
func (m *mockProvider) Auth() provider.Auth               { return nil }
func (m *mockProvider) Playlist() provider.Playlist       { return m.pl }
func (m *mockProvider) Song() provider.Song               { return nil }
func (m *mockProvider) Search() provider.Search           { return nil }

// --- 重试装饰器测试 ---

// TestRetry_RetriesOnRetryableError 验证可重试错误触发重试。
func TestRetry_RetriesOnRetryableError(t *testing.T) {
	pl := &mockPlaylist{
		result:  provider.PlaylistResult{ID: "1", Title: "ok"},
		failN:   2,
		errToRt: merrors.ErrUpstreamUnavailable,
	}
	p := &mockProvider{pl: pl}

	rp := provider.NewRetryProvider(p,
		provider.WithRetryMaxRetries(3),
		provider.WithRetryBaseDelay(1*time.Millisecond),
	)

	result, err := rp.Playlist().Detail(context.Background(), "1")
	if err != nil {
		t.Fatalf("期望重试后成功，实际: %v", err)
	}
	if result.ID != "1" {
		t.Errorf("result.ID = %q, want 1", result.ID)
	}
	if calls := atomic.LoadInt32(&pl.calls); calls != 3 {
		t.Errorf("调用 %d 次, want 3", calls)
	}
}

// TestRetry_DoesNotRetryDeterministicError 验证确定性错误不重试。
func TestRetry_DoesNotRetryDeterministicError(t *testing.T) {
	pl := &mockPlaylist{
		failN:   1,
		errToRt: merrors.ErrNotFound,
	}
	p := &mockProvider{pl: pl}

	rp := provider.NewRetryProvider(p,
		provider.WithRetryMaxRetries(3),
		provider.WithRetryBaseDelay(1*time.Millisecond),
	)

	_, err := rp.Playlist().Detail(context.Background(), "1")
	if err == nil {
		t.Fatal("期望返回 NotFound 错误")
	}
	if calls := atomic.LoadInt32(&pl.calls); calls != 1 {
		t.Errorf("确定性错误不应重试，调用 %d 次, want 1", calls)
	}
}

// TestRetry_ExhaustsRetries 验证重试耗尽后返回最后一次错误。
func TestRetry_ExhaustsRetries(t *testing.T) {
	pl := &mockPlaylist{
		failN:   100,
		errToRt: merrors.ErrRateLimited,
	}
	p := &mockProvider{pl: pl}

	rp := provider.NewRetryProvider(p,
		provider.WithRetryMaxRetries(2),
		provider.WithRetryBaseDelay(1*time.Millisecond),
	)

	_, err := rp.Playlist().Detail(context.Background(), "1")
	if err == nil {
		t.Fatal("期望返回限流错误")
	}
	// 1 次初始 + 2 次重试 = 3 次
	if calls := atomic.LoadInt32(&pl.calls); calls != 3 {
		t.Errorf("调用 %d 次, want 3", calls)
	}
}

// TestRetry_ContextCancel 验证 context 取消时停止重试。
func TestRetry_ContextCancel(t *testing.T) {
	pl := &mockPlaylist{
		failN:   100,
		errToRt: merrors.ErrUpstreamUnavailable,
	}
	p := &mockProvider{pl: pl}

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // 立即取消

	rp := provider.NewRetryProvider(p,
		provider.WithRetryMaxRetries(5),
		provider.WithRetryBaseDelay(100*time.Millisecond),
	)

	_, err := rp.Playlist().Detail(ctx, "1")
	if err == nil {
		t.Fatal("期望返回 context 取消错误")
	}
}

// --- 熔断器测试 ---

// TestCircuitBreaker_OpensAfterThreshold 验证连续失败达阈值后打开。
func TestCircuitBreaker_OpensAfterThreshold(t *testing.T) {
	pl := &mockPlaylist{
		failN:   100,
		errToRt: merrors.ErrUpstreamUnavailable,
	}
	p := &mockProvider{pl: pl}

	cb := provider.NewCircuitBreaker(3, 1*time.Hour)
	bp := provider.NewBreakerProvider(p, cb)

	// 前 3 次调用 provider（失败）
	for i := 0; i < 3; i++ {
		_, err := bp.Playlist().Detail(context.Background(), "1")
		if err == nil {
			t.Fatalf("第 %d 次调用应失败", i+1)
		}
	}

	// 熔断器应已打开，第 4 次短路
	callsBefore := atomic.LoadInt32(&pl.calls)
	_, err := bp.Playlist().Detail(context.Background(), "1")
	if !errors.Is(err, provider.ErrCircuitOpen) {
		t.Errorf("期望 ErrCircuitOpen，实际: %v", err)
	}
	callsAfter := atomic.LoadInt32(&pl.calls)
	if callsAfter != callsBefore {
		t.Errorf("熔断打开时不应调用 provider，调用数 %d → %d", callsBefore, callsAfter)
	}
}

// TestCircuitBreaker_HalfOpenAfterTimeout 验证超时后进入半开探测。
func TestCircuitBreaker_HalfOpenAfterTimeout(t *testing.T) {
	// 用一个成功 mock
	pl := &mockPlaylist{
		result: provider.PlaylistResult{ID: "1", Title: "ok"},
	}
	p := &mockProvider{pl: pl}

	cb := provider.NewCircuitBreaker(2, 50*time.Millisecond)
	bp := provider.NewBreakerProvider(p, cb)

	// 先连续失败 2 次打开熔断
	pl.err = merrors.ErrUpstreamUnavailable
	bp.Playlist().Detail(context.Background(), "1")
	bp.Playlist().Detail(context.Background(), "1")

	if cb.State() != provider.StateOpen {
		t.Fatalf("期望 StateOpen，实际 %v", cb.State())
	}

	// 等待超时
	time.Sleep(60 * time.Millisecond)

	// 修复 mock 让下次成功
	pl.err = nil

	// 半开放行一次，成功后关闭
	_, err := bp.Playlist().Detail(context.Background(), "1")
	if err != nil {
		t.Fatalf("半开探测应成功，实际: %v", err)
	}
	if cb.State() != provider.StateClosed {
		t.Errorf("探测成功后应 Closed，实际 %v", cb.State())
	}
}

// TestCircuitBreaker_SuccessResetsFailures 验证成功重置失败计数。
func TestCircuitBreaker_SuccessResetsFailures(t *testing.T) {
	pl := &mockPlaylist{
		result: provider.PlaylistResult{ID: "1"},
	}
	p := &mockProvider{pl: pl}

	cb := provider.NewCircuitBreaker(3, 1*time.Hour)
	bp := provider.NewBreakerProvider(p, cb)

	// 失败 2 次（未达阈值 3）
	pl.err = merrors.ErrUpstreamUnavailable
	bp.Playlist().Detail(context.Background(), "1")
	bp.Playlist().Detail(context.Background(), "1")

	// 成功一次，重置计数
	pl.err = nil
	bp.Playlist().Detail(context.Background(), "1")

	// 再失败 2 次，不应打开（因为计数已重置）
	pl.err = merrors.ErrUpstreamUnavailable
	bp.Playlist().Detail(context.Background(), "1")
	bp.Playlist().Detail(context.Background(), "1")

	if cb.State() != provider.StateClosed {
		t.Errorf("成功重置后 2 次失败不应打开熔断，实际 %v", cb.State())
	}
}

// TestCircuitBreaker_HalfOpenFailReopens 验证半开探测失败后重新打开。
func TestCircuitBreaker_HalfOpenFailReopens(t *testing.T) {
	pl := &mockPlaylist{
		failN:   100,
		errToRt: merrors.ErrUpstreamUnavailable,
	}
	p := &mockProvider{pl: pl}

	cb := provider.NewCircuitBreaker(2, 30*time.Millisecond)
	bp := provider.NewBreakerProvider(p, cb)

	// 连续失败打开熔断
	bp.Playlist().Detail(context.Background(), "1")
	bp.Playlist().Detail(context.Background(), "1")

	// 等待超时进入半开
	time.Sleep(40 * time.Millisecond)

	// 半开探测失败，应重新打开
	bp.Playlist().Detail(context.Background(), "1")

	if cb.State() != provider.StateOpen {
		t.Errorf("半开探测失败应重新 Open，实际 %v", cb.State())
	}
}
