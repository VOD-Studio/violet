package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type ratePolicyFixture struct {
	policy  shared.RateLimitPolicy
	version uint64
	entries map[string]domainsettings.RateLimitMetadata
}

func (f *ratePolicyFixture) RateLimits() shared.RateLimitSnapshot {
	rules := make(map[string]shared.RateLimitPolicy, len(f.entries))
	for id := range f.entries {
		rules[id] = f.policy
	}
	return shared.NewRateLimitSnapshot(rules, f.version)
}

func (f *ratePolicyFixture) RegisterRateLimit(id string, _ shared.RateLimitPolicy, metadata domainsettings.RateLimitMetadata) error {
	if f.entries == nil {
		f.entries = make(map[string]domainsettings.RateLimitMetadata)
	}
	f.entries[id] = metadata
	return nil
}

func rateFixture(t *testing.T, policy shared.RateLimitPolicy) (*miniredis.Miniredis, *redis.Client, *ratePolicyFixture, *RateLimiter) {
	t.Helper()
	ipExtractor = newIPExtractor(nil)
	server := miniredis.RunT(t)
	server.SetTime(time.Date(2026, 10, 22, 12, 0, 0, 0, time.UTC))
	client := redis.NewClient(&redis.Options{Addr: server.Addr(), MaxRetries: -1})
	t.Cleanup(func() { _ = client.Close() })
	provider := &ratePolicyFixture{policy: policy, version: 1}
	return server, client, provider, NewRateLimiter(client, provider)
}

func rateHandler(limiter *RateLimiter, policy shared.RateLimitPolicy, id string, identity func(*http.Request) string) http.Handler {
	return limiter.Bind(id, policy, domainsettings.RateLimitMetadata{Title: "测试", Identity: "ip", Endpoints: []string{"POST /test"}}, identity)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
}

func rateRequest(handler http.Handler, ip, user string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(http.MethodPost, "/test", nil)
	r.RemoteAddr = ip
	if user != "" {
		r = r.WithContext(context.WithValue(r.Context(), UserIDKey, user))
	}
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	return w
}

func defaultRatePolicy() shared.RateLimitPolicy {
	return shared.RateLimitPolicy{Enabled: true, WindowSeconds: 60, MaxRequests: 2, FailureMode: "deny"}
}

func TestRateLimiterAtomicLastAdmission(t *testing.T) {
	policy := defaultRatePolicy()
	policy.MaxRequests = 1
	_, _, _, limiter := rateFixture(t, policy)
	handler := rateHandler(limiter, policy, "atomic", IPIdentity)
	var group sync.WaitGroup
	codes := make(chan int, 32)
	for range 32 {
		group.Go(func() { codes <- rateRequest(handler, "192.0.2.1:1234", "").Code })
	}
	group.Wait()
	close(codes)
	allowed := 0
	for code := range codes {
		if code == http.StatusNoContent {
			allowed++
		} else {
			assert.Equal(t, http.StatusTooManyRequests, code)
		}
	}
	assert.Equal(t, 1, allowed)
}

func TestRateLimiterRejectionsDoNotExtendWindowOrTTL(t *testing.T) {
	policy := defaultRatePolicy()
	policy.MaxRequests = 1
	server, client, _, limiter := rateFixture(t, policy)
	start := time.Date(2026, 10, 22, 12, 0, 0, 0, time.UTC)
	handler := rateHandler(limiter, policy, "window", IPIdentity)
	require.Equal(t, http.StatusNoContent, rateRequest(handler, "192.0.2.1:1", "").Code)
	server.FastForward(40 * time.Second)
	server.SetTime(start.Add(40 * time.Second))
	for range 10 {
		response := rateRequest(handler, "192.0.2.1:1", "")
		require.Equal(t, http.StatusTooManyRequests, response.Code)
		assert.Equal(t, "20", response.Header().Get("Retry-After"))
		assert.Equal(t, "window", response.Header().Get("X-RateLimit-Reason"))
		var body struct {
			ResetAt    time.Time `json:"reset_at"`
			RetryAfter int64     `json:"retry_after"`
		}
		require.NoError(t, json.Unmarshal(response.Body.Bytes(), &body))
		assert.Equal(t, start.Add(time.Minute), body.ResetAt)
		assert.EqualValues(t, 20, body.RetryAfter)
	}
	keys, err := client.Keys(context.Background(), "*:events").Result()
	require.NoError(t, err)
	require.Len(t, keys, 1)
	assert.EqualValues(t, 1, client.ZCard(context.Background(), keys[0]).Val())
	assert.Equal(t, 24*time.Hour-40*time.Second, client.TTL(context.Background(), keys[0]).Val())
	server.SetTime(start.Add(time.Minute))
	assert.Equal(t, http.StatusNoContent, rateRequest(handler, "192.0.2.1:1", "").Code)
}

func TestRateLimiterBurstAndUTCQuotaAreAtomic(t *testing.T) {
	policy := defaultRatePolicy()
	policy.MaxRequests = 100
	policy.BurstRequests = 1
	policy.DailyQuota = 2
	server, _, _, limiter := rateFixture(t, policy)
	start := time.Date(2026, 10, 22, 23, 59, 57, 0, time.UTC)
	server.SetTime(start)
	handler := rateHandler(limiter, policy, "quota", IPIdentity)
	require.Equal(t, http.StatusNoContent, rateRequest(handler, "192.0.2.1:1", "").Code)
	blocked := rateRequest(handler, "192.0.2.1:1", "")
	assert.Equal(t, "burst", blocked.Header().Get("X-RateLimit-Reason"))
	assert.Equal(t, "1", blocked.Header().Get("Retry-After"))
	server.SetTime(start.Add(time.Second))
	require.Equal(t, http.StatusNoContent, rateRequest(handler, "192.0.2.1:1", "").Code)
	blocked = rateRequest(handler, "192.0.2.1:1", "")
	assert.Equal(t, "daily", blocked.Header().Get("X-RateLimit-Reason"))
	assert.Equal(t, "2", blocked.Header().Get("Retry-After"))
	server.SetTime(start.Add(3 * time.Second))
	assert.Equal(t, http.StatusNoContent, rateRequest(handler, "192.0.2.1:1", "").Code)
}

func TestRateLimiterPolicyChangesPreserveHistory(t *testing.T) {
	policy := defaultRatePolicy()
	server, _, provider, limiter := rateFixture(t, policy)
	start := time.Date(2026, 10, 22, 12, 0, 0, 0, time.UTC)
	handler := rateHandler(limiter, policy, "history", IPIdentity)
	require.Equal(t, http.StatusNoContent, rateRequest(handler, "192.0.2.1:1", "").Code)
	server.SetTime(start.Add(20 * time.Second))
	require.Equal(t, http.StatusNoContent, rateRequest(handler, "192.0.2.1:1", "").Code)
	provider.version++
	provider.policy.MaxRequests = 1
	blocked := rateRequest(handler, "192.0.2.1:1", "")
	assert.Equal(t, "60", blocked.Header().Get("Retry-After"))
	provider.policy.WindowSeconds = 1
	server.SetTime(start.Add(22 * time.Second))
	require.Equal(t, http.StatusNoContent, rateRequest(handler, "192.0.2.1:1", "").Code)
	provider.policy.WindowSeconds = 3600
	server.SetTime(start.Add(90 * time.Second))
	assert.Equal(t, "3532", rateRequest(handler, "192.0.2.1:1", "").Header().Get("Retry-After"))
	provider.policy.MaxRequests = 100
	provider.policy.DailyQuota = 3
	assert.Equal(t, "daily", rateRequest(handler, "192.0.2.1:1", "").Header().Get("X-RateLimit-Reason"))
	provider.policy.DailyQuota = 0
	server.SetTime(start.Add(24 * time.Hour))
	assert.Equal(t, http.StatusNoContent, rateRequest(handler, "192.0.2.1:1", "").Code)
}

func TestRateLimiterIdentityAndRuleIsolation(t *testing.T) {
	for _, tc := range []struct {
		name                                     string
		identity                                 func(*http.Request) string
		firstIP, secondIP, firstUser, secondUser string
		secondStatus                             int
	}{
		{"不同IP", IPIdentity, "192.0.2.1:1", "192.0.2.2:1", "", "", http.StatusNoContent},
		{"同IP不同用户", UserIdentity, "192.0.2.1:1", "192.0.2.1:1", "a", "b", http.StatusNoContent},
		{"用户换IP", UserIdentity, "192.0.2.1:1", "192.0.2.2:1", "a", "a", http.StatusTooManyRequests},
		{"缺失用户回退IP", UserIdentity, "192.0.2.1:1", "192.0.2.1:2", "", "", http.StatusTooManyRequests},
		{"共享站点", SharedIdentity, "192.0.2.1:1", "192.0.2.2:1", "a", "b", http.StatusTooManyRequests},
		{"unknown固定桶", func(*http.Request) string { return "" }, "", "", "", "", http.StatusTooManyRequests},
	} {
		t.Run(tc.name, func(t *testing.T) {
			policy := defaultRatePolicy()
			policy.MaxRequests = 1
			_, _, _, limiter := rateFixture(t, policy)
			handler := rateHandler(limiter, policy, "identity", tc.identity)
			require.Equal(t, http.StatusNoContent, rateRequest(handler, tc.firstIP, tc.firstUser).Code)
			assert.Equal(t, tc.secondStatus, rateRequest(handler, tc.secondIP, tc.secondUser).Code)
			other := rateHandler(limiter, policy, "other", tc.identity)
			assert.Equal(t, http.StatusNoContent, rateRequest(other, tc.firstIP, tc.firstUser).Code)
		})
	}
}

func TestRateLimiterHashedIdentityAndFiniteRetention(t *testing.T) {
	policy := defaultRatePolicy()
	server, client, _, limiter := rateFixture(t, policy)
	handler := rateHandler(limiter, policy, "site-impressions", HashedIPIdentity([]byte("independent-key")))
	require.Equal(t, http.StatusNoContent, rateRequest(handler, "198.51.100.42:1234", "").Code)
	keys, err := client.Keys(context.Background(), "*").Result()
	require.NoError(t, err)
	require.Len(t, keys, 2)
	for _, key := range keys {
		assert.NotContains(t, key, "198.51.100.42")
		assert.Positive(t, client.TTL(context.Background(), key).Val())
	}
	server.FastForward(24*time.Hour + 2*time.Second)
	assert.Empty(t, server.Keys())
}

func TestRateLimiterStorageFailurePolicyAndDisabledState(t *testing.T) {
	for _, mode := range []string{"allow", "deny"} {
		t.Run(mode, func(t *testing.T) {
			policy := defaultRatePolicy()
			policy.FailureMode = mode
			_, client, provider, limiter := rateFixture(t, policy)
			require.NoError(t, client.Close())
			handler := rateHandler(limiter, policy, "failure", IPIdentity)
			response := rateRequest(handler, "192.0.2.1:1", "")
			if mode == "allow" {
				assert.Equal(t, http.StatusNoContent, response.Code)
			} else {
				assert.Equal(t, http.StatusServiceUnavailable, response.Code)
				assert.Equal(t, "storage_unavailable", response.Header().Get("X-RateLimit-Reason"))
			}
			provider.policy.Enabled = false
			assert.Equal(t, http.StatusNoContent, rateRequest(handler, "192.0.2.1:1", "").Code)
		})
	}
}

func TestRateLimiterGroupDoesNotSpendOtherRuleOnRejection(t *testing.T) {
	policy := defaultRatePolicy()
	policy.MaxRequests = 1
	server, client, _, _ := rateFixture(t, policy)
	limiter := NewRateLimiter(client, nil)
	first := RateLimitBinding{ID: "per-user", Defaults: policy, Identity: UserIdentity}
	second := RateLimitBinding{ID: "site", Defaults: policy, Identity: SharedIdentity}
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	handler := limiter.BindGroup(first, second)(next)
	require.Equal(t, http.StatusNoContent, rateRequest(handler, "192.0.2.1:1", "a").Code)
	require.Equal(t, http.StatusTooManyRequests, rateRequest(handler, "192.0.2.1:1", "b").Code)
	// 站点额度拒绝不能消耗用户 b 自己的额度。
	require.Equal(t, http.StatusNoContent, rateRequest(limiter.BindGroup(first)(next), "192.0.2.1:1", "b").Code)
	server.SetTime(time.Date(2026, 10, 22, 12, 1, 0, 0, time.UTC))
	assert.Equal(t, http.StatusNoContent, rateRequest(handler, "192.0.2.1:1", "b").Code)
}

func TestRateLimiterRecoveryRoundsUpFractionalSeconds(t *testing.T) {
	policy := defaultRatePolicy()
	policy.MaxRequests = 1
	server, _, _, limiter := rateFixture(t, policy)
	start := time.Date(2026, 10, 22, 12, 0, 0, 500000000, time.UTC)
	server.SetTime(start)
	handler := rateHandler(limiter, policy, "precision", IPIdentity)
	require.Equal(t, http.StatusNoContent, rateRequest(handler, "192.0.2.1:1", "").Code)
	server.SetTime(start.Add(59200 * time.Millisecond))
	blocked := rateRequest(handler, "192.0.2.1:1", "")
	assert.Equal(t, "1", blocked.Header().Get("Retry-After"))
	var body struct {
		ResetAt time.Time `json:"reset_at"`
	}
	require.NoError(t, json.Unmarshal(blocked.Body.Bytes(), &body))
	assert.Equal(t, start.Add(time.Minute), body.ResetAt)
	server.SetTime(start.Add(time.Minute))
	assert.Equal(t, http.StatusNoContent, rateRequest(handler, "192.0.2.1:1", "").Code)
}

type switchingRatePolicyFixture struct {
	current atomic.Pointer[shared.RateLimitSnapshot]
}

func (f *switchingRatePolicyFixture) RateLimits() shared.RateLimitSnapshot {
	return *f.current.Load()
}

func (*switchingRatePolicyFixture) RegisterRateLimit(string, shared.RateLimitPolicy, domainsettings.RateLimitMetadata) error {
	return nil
}

func TestRateLimiterGroupCapturesOnePolicyVersionBeforeAdmission(t *testing.T) {
	seed := defaultRatePolicy()
	seed.MaxRequests = 100
	server, client, _, _ := rateFixture(t, seed)
	start := time.Date(2026, 10, 22, 12, 0, 0, 0, time.UTC)
	minute := RateLimitBinding{ID: "minute", Defaults: seed, Identity: IPIdentity}
	day := RateLimitBinding{ID: "day", Defaults: seed, Identity: IPIdentity}
	day.Defaults.WindowSeconds = 86400
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	seedHandler := NewRateLimiter(client, nil).BindGroup(minute, day)(next)
	for range 36 {
		require.Equal(t, http.StatusNoContent, rateRequest(seedHandler, "192.0.2.1:1", "").Code)
	}
	server.SetTime(start.Add(2 * time.Minute))
	for range 4 {
		require.Equal(t, http.StatusNoContent, rateRequest(seedHandler, "192.0.2.1:1", "").Code)
	}

	oldMinute := minute.Defaults
	oldMinute.MaxRequests = 5
	oldDay := day.Defaults
	oldDay.MaxRequests = 40
	newMinute := oldMinute
	newMinute.MaxRequests = 4
	newDay := oldDay
	newDay.MaxRequests = 50
	oldSnapshot := shared.NewRateLimitSnapshot(map[string]shared.RateLimitPolicy{
		"minute": oldMinute,
		"day":    oldDay,
	}, 1)
	newSnapshot := shared.NewRateLimitSnapshot(map[string]shared.RateLimitPolicy{
		"minute": newMinute,
		"day":    newDay,
	}, 2)
	provider := &switchingRatePolicyFixture{}
	provider.current.Store(&oldSnapshot)
	var publish sync.Once
	minute.Identity = func(r *http.Request) string {
		// 在第一条规则读取后发布新版，复现旧分钟阈值与新日阈值混用的间隙。
		publish.Do(func() {
			provider.current.Store(&newSnapshot)
		})
		return IPIdentity(r)
	}
	handler := NewRateLimiter(client, provider).BindGroup(minute, day)(next)

	first := rateRequest(handler, "192.0.2.1:1", "")
	require.Equal(t, http.StatusTooManyRequests, first.Code)
	assert.Equal(t, "86280", first.Header().Get("Retry-After"))
	second := rateRequest(handler, "192.0.2.1:1", "")
	require.Equal(t, http.StatusTooManyRequests, second.Code)
	assert.Equal(t, "60", second.Header().Get("Retry-After"))
}
