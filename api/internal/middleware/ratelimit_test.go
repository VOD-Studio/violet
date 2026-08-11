package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newTestRedis 启动 miniredis 用于限流测试（无外部依赖）
func newTestRedis(t *testing.T) *redis.Client {
	t.Helper()
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	return redis.NewClient(&redis.Options{Addr: mr.Addr()})
}

func TestRateLimit_BlocksAfterMax(t *testing.T) {
	ipExtractor = newIPExtractor(nil)
	client := newTestRedis(t)
	// 等待 Redis 就绪
	ctx := context.Background()
	require.NoError(t, client.Ping(ctx).Err())

	rl := RateLimit("test", client, time.Minute, 2)
	count := 0
	handler := rl(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count++
		w.WriteHeader(http.StatusOK)
	}))

	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodPost, "/", nil)
		req.RemoteAddr = "1.1.1.1:1234"
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusOK, rr.Code, "第 %d 个请求应放行", i+1)
	}

	// 第 3 个应被限流
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req.RemoteAddr = "1.1.1.1:1234"
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusTooManyRequests, rr.Code, "第 3 个请求应被限流(429)")
	assert.Equal(t, 2, count, "handler 应只被调用 2 次")
}

func TestRateLimit_IsolatesByIP(t *testing.T) {
	ipExtractor = newIPExtractor(nil)
	client := newTestRedis(t)

	rl := RateLimit("iso", client, time.Minute, 1)
	served := 0
	handler := rl(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		served++
		w.WriteHeader(http.StatusOK)
	}))

	// 不同 IP 各自独立计数，都应放行
	for _, addr := range []string{"1.1.1.1:1", "2.2.2.2:2", "3.3.3.3:3"} {
		req := httptest.NewRequest(http.MethodPost, "/", nil)
		req.RemoteAddr = addr
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusOK, rr.Code)
	}
	assert.Equal(t, 3, served)
}

func TestRateLimit_IsolatesByKey(t *testing.T) {
	ipExtractor = newIPExtractor(nil)
	client := newTestRedis(t)

	rlA := RateLimit("keyA", client, time.Minute, 1)
	rlB := RateLimit("keyB", client, time.Minute, 1)
	served := 0
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		served++
		w.WriteHeader(http.StatusOK)
	})

	// 同一 IP，不同限流维度，互不影响
	for _, rl := range []func(http.Handler) http.Handler{rlA, rlB} {
		req := httptest.NewRequest(http.MethodPost, "/", nil)
		req.RemoteAddr = "9.9.9.9:9"
		rr := httptest.NewRecorder()
		rl(next).ServeHTTP(rr, req)
		assert.Equal(t, http.StatusOK, rr.Code)
	}
	assert.Equal(t, 2, served)
}

func TestRateLimitByUser_IsolatesByUser(t *testing.T) {
	ipExtractor = newIPExtractor(nil)
	client := newTestRedis(t)

	rl := RateLimitByUser("tweet_test", client, time.Hour, 1)
	served := 0
	handler := rl(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		served++
		w.WriteHeader(http.StatusOK)
	}))

	// 同一 IP 不同登录用户：各自独立计数，都应放行
	for _, uid := range []string{"user-a", "user-b"} {
		req := httptest.NewRequest(http.MethodPost, "/", nil)
		req.RemoteAddr = "1.1.1.1:1234"
		req = req.WithContext(context.WithValue(req.Context(), UserIDKey, uid))
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusOK, rr.Code, "用户 %s 首次请求应放行", uid)
	}
	assert.Equal(t, 2, served)

	// 同一用户第二次请求：被限流（即使换 IP）
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req.RemoteAddr = "2.2.2.2:5678"
	req = req.WithContext(context.WithValue(req.Context(), UserIDKey, "user-a"))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusTooManyRequests, rr.Code, "同一用户换 IP 也应被限流")
	assert.Equal(t, 2, served)
}

func TestRateLimitByUser_FallsBackToIP(t *testing.T) {
	ipExtractor = newIPExtractor(nil)
	client := newTestRedis(t)

	rl := RateLimitByUser("tweet_fallback", client, time.Hour, 1)
	served := 0
	handler := rl(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		served++
		w.WriteHeader(http.StatusOK)
	}))

	// 无用户上下文（中间件顺序错误）降级为 IP 维度：同 IP 第二次被限流
	for i, want := range []int{http.StatusOK, http.StatusTooManyRequests} {
		req := httptest.NewRequest(http.MethodPost, "/", nil)
		req.RemoteAddr = "3.3.3.3:3"
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		assert.Equal(t, want, rr.Code, "第 %d 个请求状态码不符", i+1)
	}
	assert.Equal(t, 1, served)
}
