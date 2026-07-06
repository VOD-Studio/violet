package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestRedis(t *testing.T) *redis.Client {
	t.Helper()
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	return redis.NewClient(&redis.Options{Addr: mr.Addr()})
}

func sha256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

func TestVerify_AtomicUnderConcurrency(t *testing.T) {
	client := newTestRedis(t)
	store := NewRedisCodeStore(client)

	correct := sha256Hex("123456")
	require.NoError(t, store.Store(context.Background(), "verify", "a@b.c", correct))

	// 并发 20 次错误验证，尝试次数应被严格计数（原子），不应全部看到 attempts<max
	wg := sync.WaitGroup{}
	results := make([]bool, 20)
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			ok, _ := store.Verify(context.Background(), "verify", "a@b.c", sha256Hex("wrong"))
			results[i] = ok
		}(i)
	}
	wg.Wait()

	for _, ok := range results {
		assert.False(t, ok, "错误码不应匹配")
	}

	// 超过 maxAttempt(5) 后 key 应被删除，正确码也不再可验证
	ok, err := store.Verify(context.Background(), "verify", "a@b.c", correct)
	require.NoError(t, err)
	assert.False(t, ok, "超限后正确码也不应通过")
}

func TestVerify_AcceptsCorrectCodeBeforeLimit(t *testing.T) {
	client := newTestRedis(t)
	store := NewRedisCodeStore(client)
	correct := sha256Hex("654321")
	require.NoError(t, store.Store(context.Background(), "verify", "x@y.z", correct))

	ok, err := store.Verify(context.Background(), "verify", "x@y.z", correct)
	require.NoError(t, err)
	assert.True(t, ok)

	// 一次性：验证后 key 应删除
	ok2, _ := store.Verify(context.Background(), "verify", "x@y.z", correct)
	assert.False(t, ok2, "验证码应一次性消费")
}

func TestVerify_AllowsFewWrongThenRejects(t *testing.T) {
	client := newTestRedis(t)
	store := NewRedisCodeStore(client)
	correct := sha256Hex("right")
	require.NoError(t, store.Store(context.Background(), "reset", "u@v.w", correct))

	// 前 maxAttempt 次错误验证返回 false
	for i := 0; i < store.MaxAttempt(); i++ {
		ok, err := store.Verify(context.Background(), "reset", "u@v.w", sha256Hex("wrong"))
		require.NoError(t, err)
		assert.False(t, ok)
	}
	// 超限后正确码也失败
	ok, err := store.Verify(context.Background(), "reset", "u@v.w", correct)
	require.NoError(t, err)
	assert.False(t, ok)
}
