package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

type RateLimitProvider interface {
	RateLimits() shared.RateLimitSnapshot
	RegisterRateLimit(string, shared.RateLimitPolicy, domainsettings.RateLimitMetadata) error
}

type RateLimiter struct {
	client   *redis.Client
	provider RateLimitProvider
}

func NewRateLimiter(client *redis.Client, provider RateLimitProvider) *RateLimiter {
	return &RateLimiter{client: client, provider: provider}
}

func IPIdentity(r *http.Request) string {
	if ip := getClientIP(r); ip != "" {
		return ip
	}
	return "unknown"
}

func UserIdentity(r *http.Request) string {
	if id := GetUserID(r.Context()); id != "" {
		return "user:" + id
	}
	return "ip:" + IPIdentity(r)
}

func SharedIdentity(*http.Request) string { return "site" }

// HashedIPIdentity 的密钥由业务独立派生，不能复用持久化令牌摘要的密钥。
func HashedIPIdentity(key []byte) func(*http.Request) string {
	key = append([]byte(nil), key...)
	return func(r *http.Request) string {
		mac := hmac.New(sha256.New, key)
		_, _ = mac.Write([]byte(IPIdentity(r)))
		return hex.EncodeToString(mac.Sum(nil))
	}
}

type RateLimitBinding struct {
	ID       string
	Defaults shared.RateLimitPolicy
	Metadata domainsettings.RateLimitMetadata
	Identity func(*http.Request) string
}

func (l *RateLimiter) Bind(id string, defaults shared.RateLimitPolicy, metadata domainsettings.RateLimitMetadata, identity func(*http.Request) string) func(http.Handler) http.Handler {
	return l.BindGroup(RateLimitBinding{ID: id, Defaults: defaults, Metadata: metadata, Identity: identity})
}

// BindGroup 登记真实入口，并将同一路由的多个额度作为一次原子准入，拒绝时不半扣额度。
func (l *RateLimiter) BindGroup(bindings ...RateLimitBinding) func(http.Handler) http.Handler {
	for i, binding := range bindings {
		if binding.Identity == nil {
			panic("限流身份解析器不能为空")
		}
		for _, previous := range bindings[:i] {
			if previous.ID == binding.ID {
				panic("同一限流组合不能重复绑定规则")
			}
		}
		if l.provider != nil {
			if err := l.provider.RegisterRateLimit(binding.ID, binding.Defaults, binding.Metadata); err != nil {
				panic(err)
			}
		}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var snapshot shared.RateLimitSnapshot
			if l.provider != nil {
				snapshot = l.provider.RateLimits()
			}
			keys := make([]string, 0, len(bindings)*2)
			args := make([]any, 1, 1+len(bindings)*4)
			args[0] = shared.MaxRateLimitWindowSeconds
			failureMode := "allow"
			for _, binding := range bindings {
				policy := binding.Defaults
				if current, ok := snapshot.Lookup(binding.ID); ok {
					policy = current
				}
				if !policy.Enabled {
					continue
				}
				if policy.FailureMode != "allow" {
					failureMode = "deny"
				}
				dimension := binding.Identity(r)
				if dimension == "" {
					dimension = "unknown"
				}
				// 固定摘要避免 Redis 键包含原始地址、用户标识或凭据。
				digest := sha256.Sum256([]byte(binding.ID + "\x00" + dimension))
				key := "ratelimit:{" + hex.EncodeToString(digest[:]) + "}"
				keys = append(keys, key+":events", key+":day")
				args = append(args, policy.WindowSeconds, policy.MaxRequests, policy.BurstRequests, policy.DailyQuota)
			}
			if len(keys) == 0 {
				next.ServeHTTP(w, r)
				return
			}
			result, err := l.decide(r, keys, args)
			if err != nil {
				// 底层错误可能包含服务器地址或键，不记录错误文本与身份维度。
				log.Error().Str("policy", bindings[0].ID).Str("failure_mode", failureMode).Msg("限流存储不可用")
				if failureMode == "allow" {
					next.ServeHTTP(w, r)
					return
				}
				writeRateLimitError(w, http.StatusServiceUnavailable, "rate_limit_unavailable", "限流服务暂不可用，请稍后重试", "storage_unavailable", 1, time.Time{})
				return
			}
			if result[0] == 0 {
				reasons := [...]string{"", "window", "burst", "daily"}
				writeRateLimitError(w, http.StatusTooManyRequests, "rate_limit_exceeded", "请求过于频繁，请稍后再试", reasons[result[1]], result[2], time.UnixMicro(result[3]).UTC())
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func (l *RateLimiter) decide(r *http.Request, keys []string, args []any) ([]int64, error) {
	if l.client == nil {
		return nil, errors.New("限流存储未配置")
	}
	return rateLimitScript.Run(r.Context(), l.client, keys, args...).Int64Slice()
}

func writeRateLimitError(w http.ResponseWriter, status int, code, message, reason string, retry int64, reset time.Time) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Retry-After", strconv.FormatInt(retry, 10))
	w.Header().Set("X-RateLimit-Reason", reason)
	resetAt := ""
	if !reset.IsZero() {
		seconds := reset.Unix()
		if reset.Nanosecond() != 0 {
			seconds++
		}
		w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(seconds, 10))
		resetAt = reset.Format(time.RFC3339Nano)
	}
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(struct {
		Error      string `json:"error"`
		Message    string `json:"message"`
		Reason     string `json:"reason"`
		RetryAfter int64  `json:"retry_after"`
		ResetAt    string `json:"reset_at,omitempty"`
	}{code, message, reason, retry, resetAt})
}

// Redis TIME 是跨实例唯一时钟；窗口采用 (now-window, now]。历史保留完整最大窗口，
// 因此改版本、缩小再扩大窗口不会重置额度。拒绝不写入请求、不刷新 TTL。
var rateLimitScript = redis.NewScript(`
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000000 + tonumber(clock[2])
local retention = tonumber(ARGV[1])
local day = math.floor(tonumber(clock[1]) / 86400)
local midnight = (day + 1) * 86400 * 1000000
local reset = 0
local reason = 0
local function checkWindow(key, duration, limit, code)
  if limit == 0 then return end
  local minimum = '(' .. string.format('%.0f', now - duration)
  local count = redis.call('ZCOUNT', key, minimum, '+inf')
  if count >= limit then
    local item = redis.call('ZRANGEBYSCORE', key, minimum, '+inf', 'WITHSCORES', 'LIMIT', count - limit, 1)
    local candidate = tonumber(item[2]) + duration
    if candidate > reset then reset = candidate; reason = code end
  end
end
for index = 1, #KEYS, 2 do
  local arg = 2 + ((index - 1) / 2) * 4
  local window = tonumber(ARGV[arg]) * 1000000
  local maximum = tonumber(ARGV[arg + 1])
  local burst = tonumber(ARGV[arg + 2])
  local quota = tonumber(ARGV[arg + 3])
  local storedDay = tonumber(redis.call('HGET', KEYS[index + 1], 'day') or '-1')
  local daily = 0
  if storedDay == day then daily = tonumber(redis.call('HGET', KEYS[index + 1], 'count') or '0') end
  redis.call('ZREMRANGEBYSCORE', KEYS[index], '-inf', now - retention * 1000000)
  checkWindow(KEYS[index], window, maximum, 1)
  checkWindow(KEYS[index], 1000000, burst, 2)
  if quota > 0 and daily >= quota and midnight > reset then reset = midnight; reason = 3 end
end
if reason ~= 0 then
  return {0, reason, math.max(1, math.ceil((reset - now) / 1000000)), reset}
end
for index = 1, #KEYS, 2 do
  local storedDay = tonumber(redis.call('HGET', KEYS[index + 1], 'day') or '-1')
  if storedDay ~= day then redis.call('HSET', KEYS[index + 1], 'day', day, 'count', 0) end
  local sequence = redis.call('HINCRBY', KEYS[index + 1], 'sequence', 1)
  redis.call('HINCRBY', KEYS[index + 1], 'count', 1)
  redis.call('ZADD', KEYS[index], now, string.format('%.0f', now) .. ':' .. sequence)
  redis.call('EXPIRE', KEYS[index], retention)
  redis.call('EXPIRE', KEYS[index + 1], retention + 1)
end
return {1, 0, 0, 0}
`)
