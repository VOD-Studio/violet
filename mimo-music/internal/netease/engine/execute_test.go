// Package engine 的 Execute 与缓存集成测试。
//
// Execute 的缓存命中/回填逻辑需要 proto.Message 类型的 Resp 才能走通序列化路径。
// 地基阶段 issue 0002 只验证引擎基础设施（crypto/transport/retry/breaker），
// Execute 的端到端缓存测试在 issue 0005 迁移第一个真实接口时用生成的 pb 类型做。
package engine

import (
	"context"
	"fmt"
	"testing"
	"time"

	merrors "github.com/VOD-Studio/mimo-music/errors"
)

// fakeCache 是测试用的内存 Cache，记录 hits/sets 计数。
type fakeCache struct {
	data map[string][]byte
	hits int
	sets int
}

func newFakeCache() *fakeCache {
	return &fakeCache{data: make(map[string][]byte)}
}

func (c *fakeCache) Get(_ context.Context, key string) ([]byte, bool, error) {
	c.hits++
	v, ok := c.data[key]
	return v, ok, nil
}

func (c *fakeCache) Set(_ context.Context, key string, value []byte, _ time.Duration) error {
	c.sets++
	c.data[key] = value
	return nil
}

func (c *fakeCache) Delete(_ context.Context, key string) error {
	delete(c.data, key)
	return nil
}

// TestFakeCache 验证测试桩本身工作正常。
func TestFakeCache(t *testing.T) {
	ctx := context.Background()
	c := newFakeCache()

	// 未命中。
	_, ok, _ := c.Get(ctx, "k")
	if ok {
		t.Fatal("新 cache 应未命中")
	}

	// 写入后命中。
	_ = c.Set(ctx, "k", []byte("v"), time.Minute)
	got, ok, _ := c.Get(ctx, "k")
	if !ok || string(got) != "v" {
		t.Fatalf("写入后应命中 v，得到 %s/%v", got, ok)
	}

	if c.hits != 2 {
		t.Errorf("hits = %d, 期望 2", c.hits)
	}
	if c.sets != 1 {
		t.Errorf("sets = %d, 期望 1", c.sets)
	}
}

// TestCircuitBreaker 验证熔断器连续失败后打开。
func TestCircuitBreaker(t *testing.T) {
	cb := newCircuitBreaker(2, 30*time.Second)

	// 初始 Closed，放行。
	if cb.State() != stateClosed {
		t.Fatal("新熔断器应 Closed")
	}

	// 连续 2 次失败（threshold=2）应 Open。
	cb.recordFailure()
	if cb.State() != stateClosed {
		t.Fatal("1 次失败应仍 Closed")
	}
	cb.recordFailure()
	if cb.State() != stateOpen {
		t.Fatal("2 次失败（threshold=2）应 Open")
	}

	// Open 时 allow 返回 false。
	if cb.allow() {
		t.Fatal("Open 状态应短路")
	}
}

// TestWithRetry 验证可重试错误会被重试。
func TestWithRetry(t *testing.T) {
	ctx := context.Background()
	policy := retryPolicy{maxRetries: 3, baseDelay: time.Millisecond}

	calls := 0
	err := withRetry(ctx, policy, func() error {
		calls++
		if calls < 3 {
			// 包装 ErrUpstreamUnavailable 使其可重试。
			return fmt.Errorf("%w: retry %d", merrors.ErrUpstreamUnavailable, calls)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("第 3 次成功应返回 nil: %v", err)
	}
	if calls != 3 {
		t.Errorf("应调用 3 次，实际 %d", calls)
	}
}

// TestWithRetry_NotRetryable 验证确定性错误不重试。
func TestWithRetry_NotRetryable(t *testing.T) {
	ctx := context.Background()
	policy := retryPolicy{maxRetries: 3, baseDelay: time.Millisecond}

	calls := 0
	_ = withRetry(ctx, policy, func() error {
		calls++
		// ErrNotFound 是确定性错误，不应重试。
		return merrors.ErrNotFound
	})
	if calls != 1 {
		t.Errorf("确定性错误应只调 1 次，实际 %d", calls)
	}
}
