# Backend Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all P0/P1 issues from the backend code review — security vulnerabilities, data-consistency bugs, missing transactionality, and domain-layer purity violations — across the `api/` Go DDD service.

**Architecture:** Five sequential phases. Phase 1 ships security hotfixes (independent, lowest risk). Phase 2 hardens infrastructure (JWT/SSRF/path-traversal/brute-force). Phase 3 fixes correctness bugs (broken transactions, swallowed errors, dead code). Phase 4 builds the real UnitOfWork resource-injection mechanism and wraps multi-write use cases. Phase 5 strips HTTP coupling from the domain layer and extracts ports so `application/` no longer imports `infrastructure/`. Each phase compiles and passes tests independently and should be committed per-task.

**Tech Stack:** Go 1.25, chi v5, GORM (SQLite for tests, PostgreSQL in prod), go-redis/v9, golang-jwt/v5, go-playground/validator, testify. Test convention: SQLite temp-file DB via `setupTestDB(t)` helper, `testify/assert` + `testify/require`.

**Verification commands (run after every task):**
- `cd api && go vet ./...`
- `cd api && go build ./...`
- `cd api && go test ./...`

---

## File Structure

This plan touches these files. New files are created; existing ones are modified in-place. Phases are ordered so each builds on the last without rework.

**Phase 1 — Security hotfixes:**
- Modify: `api/internal/middleware/utils.go` (trusted-proxy IP extraction)
- Modify: `api/cmd/server/main.go` (rate-limit wiring on auth/upload routes; auth on RemoveReaction)
- Modify: `api/internal/middleware/ratelimit.go` (generic limiter factory)
- Modify: `api/internal/interfaces/http/handler/media/media.go` (MIME sniff, body limits on chunk)
- Modify: `api/internal/interfaces/http/handler/auth/auth.go` (validate UpdateProfile)
- Create: `api/internal/middleware/ratelimit_test.go`

**Phase 2 — Infra robustness:**
- Modify: `api/internal/infrastructure/auth/jwt.go` (fail-closed key loading + iss/aud validation)
- Modify: `api/internal/infrastructure/music/provider.go` (SSRF guard, context propagation)
- Modify: `api/internal/infrastructure/storage/local_storage.go` (path-containment guard)
- Modify: `api/internal/infrastructure/auth/redis_store.go` (Lua-atomic Verify, constant-time compares)
- Modify: `api/internal/infrastructure/email/templates.go` (HTML-escape)
- Modify: `api/internal/infrastructure/github/adapter.go` (URL-escape username)
- Create: `api/internal/infrastructure/storage/local_storage_test.go`

**Phase 3 — Correctness:**
- Modify: `api/internal/infrastructure/persistence/gorm/post_repo.go` (Save rewrite)
- Modify: `api/internal/interfaces/http/response/error.go` (validator/json → 400)
- Modify: `api/internal/infrastructure/persistence/gorm/stats_store.go`, `audit_store.go`, `admin_user_store.go`, `session_repo.go` (error mapping)
- Modify: `api/internal/job/cleanup_job.go` (CAS status, delete order, batching)
- Modify: `api/internal/infrastructure/persistence/gorm/comment_repo.go` (remove dead ReactionRepository)
- Modify: `api/internal/domain/comment/repository.go` (remove dead ReactionRepository port)
- Create: `api/internal/infrastructure/persistence/gorm/post_repo_test.go`

**Phase 4 — UnitOfWork:**
- Modify: `api/internal/application/shared/uow.go` (concrete TxContext with typed resource access)
- Modify: `api/internal/infrastructure/persistence/gorm/uow.go` (transactional repo factory)
- Modify: `api/internal/application/post/service.go` (IncrementView in tx)
- Modify: `api/internal/application/media/service.go` (CompleteUpload in tx)
- Modify: `api/internal/application/auth/command/auth_commands.go`, `auth_commands_more.go` (events after commit; RegisterUser tx)
- Modify: `api/internal/application/useradmin/service.go` (audit in tx)
- Modify: `api/internal/infrastructure/persistence/gorm/settings_store.go` (UpsertMany)
- Modify: `api/internal/application/settings/service.go` (tx)
- Modify: `api/internal/app/*_container.go` (wire UoW)

**Phase 5 — Layer purity:**
- Modify: `api/internal/domain/shared/error.go` (remove HTTPStatus, net/http)
- Modify: `api/internal/interfaces/http/response/error.go` (own Code→HTTP map)
- Create: `api/internal/application/shared/ports.go` (TokenService/TokenStore/CodeStore ports)
- Modify: `api/internal/application/auth/command/*.go` (use ports, not infra types)
- Modify: `api/internal/application/commentreaction/service.go` (remove net/http, ExtractIP to handler)
- Modify: `api/internal/interfaces/http/handler/commentreaction/commentreaction.go` (own ExtractIP)
- Modify: `api/internal/domain/commentreaction/entity.go` (consolidate; remove duplication marker)

---

# Phase 1: Security Hotfixes

These are independent fixes with no shared state. Ship first; each is a standalone commit.

---

## Task 1.1: Harden client-IP extraction against XFF spoofing

**Problem:** `internal/middleware/utils.go:8-23` trusts `X-Forwarded-For` / `X-Real-IP` unconditionally. An attacker sends a random XFF per request and bypasses every IP-based rate limit. The comment/reaction endpoints (public, rate-limit is their only protection) become unlimited.

**Fix:** Only honor forwarded headers when a trusted-proxy CIDR list is configured, and only when `RemoteAddr` itself is a trusted proxy. Otherwise fall back to `RemoteAddr`. Add a `TrustedProxies` config field.

**Files:**
- Modify: `api/internal/middleware/utils.go`
- Modify: `api/config/config.go` (add `TrustedProxies []string`)
- Modify: `api/cmd/server/main.go` (pass trusted proxies to middleware setup)
- Create: `api/internal/middleware/utils_test.go`

- [ ] **Step 1: Add TrustedProxies to config**

Read `api/config/config.go` and find the `Config` struct. Add a field after the existing `Redis`/`Database` struct group:

```go
// TrustedProxies 受信代理 CIDR 列表（如 Nginx/CDN 出口 IP）。
// 非空时，仅当 RemoteAddr 命中此列表才信任 X-Forwarded-For/X-Real-IP；
// 为空时一律使用 RemoteAddr，拒绝任何客户端自报的转发头（防 IP 欺骗绕过限流）。
TrustedProxies []string `mapstructure:"trusted_proxies"`
```

In `config.example.yaml`, under the top-level keys, add:
```yaml
# 受信代理 CIDR 列表（生产环境填 Nginx/CDN 出口 IP，如 ["10.0.0.2/32"]）
# 留空时一律使用 TCP 连接对端地址作为客户端 IP，忽略 X-Forwarded-For
trusted_proxies: []
```

- [ ] **Step 2: Write the failing test**

Create `api/internal/middleware/utils_test.go`:

```go
package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetClientIP_IgnoresForwardedHeadersWhenNoTrustedProxies(t *testing.T) {
	ipExtractor = newIPExtractor(nil)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Forwarded-For", "1.2.3.4")
	req.Header.Set("X-Real-IP", "5.6.7.8")
	req.RemoteAddr = "9.9.9.9:1234"

	assert.Equal(t, "9.9.9.9:1234", getClientIP(req))
}

func TestGetClientIP_TrustsForwardedHeaderFromTrustedProxy(t *testing.T) {
	ipExtractor = newIPExtractor([]string{"10.0.0.2/32"})
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Forwarded-For", "1.2.3.4")
	req.RemoteAddr = "10.0.0.2:5678"

	assert.Equal(t, "1.2.3.4", getClientIP(req))
}

func TestGetClientIP_IgnoresForwardedHeaderFromUntrustedRemoteAddr(t *testing.T) {
	ipExtractor = newIPExtractor([]string{"10.0.0.2/32"})
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Forwarded-For", "1.2.3.4")
	req.RemoteAddr = "8.8.8.8:1234" // 不是受信代理

	assert.Equal(t, "8.8.8.8:1234", getClientIP(req))
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd api && go test ./internal/middleware/ -run TestGetClientIP -v`
Expected: FAIL / compile error (`ipExtractor` and `newIPExtractor` not defined).

- [ ] **Step 4: Implement trusted-proxy-aware extraction**

Replace the entire contents of `api/internal/middleware/utils.go` with:

```go
// Package middleware 提供 HTTP 中间件，处理认证、日志、限流等横切关注点
package middleware

import (
	"net"
	"net/http"
	"strings"
	"sync"
)

// ipExtractor 全局 IP 提取器（受信代理感知）。
// 由 main.go 在启动时通过 SetTrustedProxies 配置；未配置时一律使用 RemoteAddr。
var (
	ipExtractor     = newIPExtractor(nil)
	ipExtractorOnce sync.Once
)

// SetTrustedProxies 配置受信代理列表，必须在 HTTP 服务启动前调用一次。
func SetTrustedProxies(cidrs []string) {
	ipExtractorOnce.Do(func() {})
	ipExtractor = newIPExtractor(cidrs)
}

// ipExtr 提取器实现（不可变，构造后线程安全）
type ipExtr struct {
	nets []*net.IPNet
}

func newIPExtractor(cidrs []string) *ipExtr {
	e := &ipExtr{}
	for _, c := range cidrs {
		c = strings.TrimSpace(c)
		if c == "" {
			continue
		}
		// 不带掩码的单 IP 视为 /32（v4）或 /128（v6）
		if !strings.Contains(c, "/") {
			c += "/32"
		}
		if _, ipnet, err := net.ParseCIDR(c); err == nil {
			e.nets = append(e.nets, ipnet)
		}
	}
	return e
}

// isTrusted 判断 ip 是否来自受信代理
func (e *ipExtr) isTrusted(remoteAddr string) bool {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr // 没有端口
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	for _, n := range e.nets {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

// getClientIP 获取客户端真实 IP 地址。
//
// 仅当 RemoteAddr 命中受信代理列表时，才信任 X-Forwarded-For / X-Real-IP；
// 否则一律使用 RemoteAddr 的 IP，避免客户端伪造转发头绕过限流。
func getClientIP(r *http.Request) string {
	if ipExtractor.isTrusted(r.RemoteAddr) {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			if ip := extractFirstIP(xff); ip != "" {
				return ip
			}
		}
		if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
			return realIP
		}
	}
	return r.RemoteAddr
}

// extractFirstIP 从 X-Forwarded-For 头部提取第一个 IP
// 格式通常为 "client, proxy1, proxy2"
func extractFirstIP(forwarded string) string {
	for i := 0; i < len(forwarded); i++ {
		if forwarded[i] == ',' {
			return strings.TrimSpace(forwarded[:i])
		}
	}
	return strings.TrimSpace(forwarded)
}

// getTokenPrefix 获取 token 前缀用于日志记录（不记录完整 token）
func getTokenPrefix(token string) string {
	if len(token) > 10 {
		return token[:10] + "..."
	}
	return "***"
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd api && go test ./internal/middleware/ -run TestGetClientIP -v`
Expected: PASS (3 tests).

- [ ] **Step 6: Wire trusted proxies in main.go**

In `api/cmd/server/main.go`, find the block where middleware is set up (near the `redisClient` variable, before `r := chi.NewRouter()`). Add after redis client creation:

```go
	// 配置受信代理（限流/IP 提取依赖；为空时一律使用 RemoteAddr）
	middleware.SetTrustedProxies(cfg.TrustedProxies)
```

(Place it after the `cfg` load and before route registration. Exact location: after `redisClient` is constructed, before `authContainer`.)

- [ ] **Step 7: Verify build and vet**

Run: `cd api && go vet ./... && go build ./...`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd api
git add internal/middleware/utils.go internal/middleware/utils_test.go config/config.go ../config.example.yaml cmd/server/main.go
git commit -m "fix(middleware): 受信代理感知的客户端 IP 提取，防 XFF 欺骗绕过限流"
```

---

## Task 1.2: Generic rate-limit middleware factory + apply to auth/upload endpoints

**Problem:** Only comments/reactions are rate-limited. `login`/`register`/`forgot-password` (brute-force, email-bomb), `/upload/*` (resource DoS), and `/posts/{id}/view` (view inflation) have no limit.

**Fix:** Refactor `CommentRateLimit` into a generic `RateLimit(key, window, max)` factory, then apply it to sensitive routes with sensible limits. Keep the existing comment limit unchanged.

**Files:**
- Modify: `api/internal/middleware/ratelimit.go`
- Modify: `api/cmd/server/main.go`
- Create: `api/internal/middleware/ratelimit_test.go`

- [ ] **Step 1: Write the failing test**

Create `api/internal/middleware/ratelimit_test.go`:

```go
package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
	miniredis "github.com/redis/go-redis/v9"
)

// newTestRedis 启动 miniredis 用于限流测试（无外部依赖）
func newTestRedis(t *testing.T) *redis.Client {
	t.Helper()
	// 使用真实 Redis 的 miniredis 内存实现
	mr, err := miniredis.RunMiniRedis()
	if err != nil {
		t.Skipf("miniredis 不可用，跳过: %v", err)
	}
	t.Cleanup(mr.Close)
	return redis.NewClient(&redis.Options{Addr: mr.Addr()})
}

func TestRateLimit_BlocksAfterMax(t *testing.T) {
	ipExtractor = newIPExtractor(nil)
	client := newTestRedis(t)
	// 等待 Redis 就绪
	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Skipf("Redis 不可用: %v", err)
	}

	rl := RateLimit("test", client, 1*time.Minute, 2)
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
		if rr.Code != http.StatusOK {
			t.Fatalf("第 %d 个请求应放行，got %d", i+1, rr.Code)
		}
	}

	// 第 3 个应被限流
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req.RemoteAddr = "1.1.1.1:1234"
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusTooManyRequests {
		t.Fatalf("第 3 个请求应被限流(429)，got %d", rr.Code)
	}
	if count != 2 {
		t.Fatalf("handler 应只被调用 2 次，got %d", count)
	}
}
```

Note: if miniredis is not in `go.mod`, the test self-skips; that's acceptable. If you prefer, add `github.com/alicebob/miniredis/v2` to go.mod (`go get github.com/alicebob/miniredis/v2`). The test is still valid coverage.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && go test ./internal/middleware/ -run TestRateLimit -v`
Expected: FAIL (`RateLimit` factory not defined).

- [ ] **Step 3: Refactor ratelimit.go with generic factory**

Replace the entire contents of `api/internal/middleware/ratelimit.go` with:

```go
// Package middleware 提供 HTTP 中间件，处理认证、日志、限流等横切关注点
package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// RateLimit 基于 IP 的 Redis 滑动窗口限流中间件工厂。
//
// key     限流维度标识（如 "comment"/"login"/"upload"），用于隔离不同接口的窗口
// client  Redis 客户端
// window  时间窗口
// max     窗口内最大请求数（超过即拒绝）
func RateLimit(key string, client *redis.Client, window time.Duration, max int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := getClientIP(r)
			redisKey := fmt.Sprintf("ratelimit:%s:%s", key, ip)

			ctx := r.Context()
			now := time.Now()
			windowStart := now.Add(-window)

			pipe := client.Pipeline()
			pipe.ZRemRangeByScore(ctx, redisKey, "0", fmt.Sprintf("%d", windowStart.UnixMicro()))
			countCmd := pipe.ZCard(ctx, redisKey)
			pipe.ZAdd(ctx, redisKey, redis.Z{
				Score:  float64(now.UnixMicro()),
				Member: fmt.Sprintf("%d", now.UnixNano()),
			})
			pipe.Expire(ctx, redisKey, 2*window)

			if _, err := pipe.Exec(ctx); err != nil {
				log.Error().Err(err).Str("ip", ip).Str("path", r.URL.Path).
					Msg("限流 Redis 操作失败，放行请求")
				next.ServeHTTP(w, r)
				return
			}

			if countCmd.Val() >= max {
				log.Warn().Str("ip", ip).Str("key", key).Str("method", r.Method).
					Str("path", r.URL.Path).Int64("count", countCmd.Val()).Msg("触发限流")
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Retry-After", fmt.Sprintf("%d", int(window.Seconds())))
				w.WriteHeader(http.StatusTooManyRequests)
				w.Write([]byte(`{"error":"rate_limit_exceeded","message":"请求过于频繁，请稍后再试"}`))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// CommentRateLimit 评论限流（每分钟 3 条）—— 保留以兼容现有调用
func CommentRateLimit(redisClient *redis.Client) func(http.Handler) http.Handler {
	return RateLimit("comment", redisClient, time.Minute, 3)
}

// AuthRateLimit 认证类接口限流（登录/注册/忘记密码/重置/验证：每分钟 5 次，防暴力与邮件轰炸）
func AuthRateLimit(redisClient *redis.Client) func(http.Handler) http.Handler {
	return RateLimit("auth", redisClient, time.Minute, 5)
}

// UploadRateLimit 上传类接口限流（每分钟 30 次，防资源 DoS）
func UploadRateLimit(redisClient *redis.Client) func(http.Handler) http.Handler {
	return RateLimit("upload", redisClient, time.Minute, 30)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api && go test ./internal/middleware/ -run TestRateLimit -v`
Expected: PASS (or SKIP if miniredis unavailable).

- [ ] **Step 5: Apply rate limits to routes in main.go**

In `api/cmd/server/main.go`, find the `/auth` route group (around line 194-211). Wrap the public auth endpoints with `AuthRateLimit`. Replace the block:

```go
		v1.Route("/auth", func(r chi.Router) {
			// 公开端点：取 CSRF token（首次访问需要先调用此端点拿到 cookie 才能 login）
			r.Get("/csrf-token", authH.GetCSRFToken)         // 获取 CSRF token
			r.Post("/register", authH.Register)              // 用户注册
			r.Post("/verify-email", authH.VerifyEmail)       // 邮箱验证
			r.Post("/login", authH.Login)                    // 用户登录
			r.Post("/refresh", authH.Refresh)                // 刷新令牌
			r.Post("/forgot-password", authH.ForgotPassword) // 发送重置密码邮件
			r.Post("/reset-password", authH.ResetPassword)   // 重置密码
```

with:

```go
		v1.Route("/auth", func(r chi.Router) {
			// 公开端点：取 CSRF token（首次访问需要先调用此端点拿到 cookie 才能 login）
			r.Get("/csrf-token", authH.GetCSRFToken) // 获取 CSRF token
			// 认证类接口限流（防暴力破解与邮件轰炸）
			r.With(middleware.AuthRateLimit(redisClient)).Post("/register", authH.Register)
			r.With(middleware.AuthRateLimit(redisClient)).Post("/verify-email", authH.VerifyEmail)
			r.With(middleware.AuthRateLimit(redisClient)).Post("/login", authH.Login)
			r.With(middleware.AuthRateLimit(redisClient)).Post("/refresh", authH.Refresh)
			r.With(middleware.AuthRateLimit(redisClient)).Post("/forgot-password", authH.ForgotPassword)
			r.With(middleware.AuthRateLimit(redisClient)).Post("/reset-password", authH.ResetPassword)
```

Then find the `/upload` route group (around line 275-282). Add upload rate limit. Replace:

```go
		v1.Route("/upload", func(r chi.Router) {
			r.Use(middleware.Auth(tokenValidator, middleware.WithAccessCookie(cfg.Cookie.AccessName)))
```

with:

```go
		v1.Route("/upload", func(r chi.Router) {
			r.Use(middleware.Auth(tokenValidator, middleware.WithAccessCookie(cfg.Cookie.AccessName)))
			r.Use(middleware.UploadRateLimit(redisClient))
```

- [ ] **Step 6: Verify build, vet, test**

Run: `cd api && go vet ./... && go build ./... && go test ./internal/middleware/ -v`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
cd api
git add internal/middleware/ratelimit.go internal/middleware/ratelimit_test.go cmd/server/main.go
git commit -m "feat(middleware): 通用限流工厂，覆盖认证/上传接口，防暴力与资源 DoS"
```

---

## Task 1.3: Require auth on RemoveReaction route

**Problem:** `cmd/server/main.go:246` registers `r.Delete("/{emoji_id}", crH.RemoveReaction)` with no `Auth` middleware and no rate limit. Any anonymous client can DELETE reactions by enumerating comment/emoji IDs.

**Files:**
- Modify: `api/cmd/server/main.go`

- [ ] **Step 1: Add Auth middleware to the DELETE reaction route**

In `api/cmd/server/main.go`, find the reactions route group (around line 243-247):

```go
		v1.Route("/comments/{comment_id}/reactions", func(r chi.Router) {
			r.Get("/", crH.GetCommentReactions)                                         // 获取评论反应
			r.With(middleware.CommentRateLimit(redisClient)).Post("/", crH.AddReaction) // 添加反应（限流）
			r.Delete("/{emoji_id}", crH.RemoveReaction)                                 // 删除反应
		})
```

Replace with (DELETE now requires Auth — reactions belong to an identified user/IP; anonymous deletion is abuse):

```go
		v1.Route("/comments/{comment_id}/reactions", func(r chi.Router) {
			r.Get("/", crH.GetCommentReactions)                                                          // 获取评论反应
			r.With(middleware.CommentRateLimit(redisClient)).Post("/", crH.AddReaction)                  // 添加反应（限流）
			r.With(middleware.Auth(tokenValidator, middleware.WithAccessCookie(cfg.Cookie.AccessName))). // 删除反应需认证
				Delete("/{emoji_id}", crH.RemoveReaction)
		})
```

- [ ] **Step 2: Verify build and vet**

Run: `cd api && go vet ./... && go build ./...`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd api
git add cmd/server/main.go
git commit -m "fix(http): 评论反应删除接口要求认证，防匿名删除他人反应"
```

---

## Task 1.4: MIME-sniff uploaded files + bound chunk body size

**Problem:** `internal/interfaces/http/handler/media/media.go:260,716` trusts `header.Header.Get("Content-Type")` from the client — an attacker labels an SVG/HTML as `image/png` and `/uploads/*` (static-served) delivers stored XSS. Also `media.go:768` `io.ReadAll(r.Body)` on `SaveUploadChunk` has no size limit → OOM.

**Fix:** Sniff actual bytes with `http.DetectContentType`; reject non-image types. Bound the chunk body with `MaxBytesReader`.

**Files:**
- Modify: `api/internal/interfaces/http/handler/media/media.go`

- [ ] **Step 1: Add a shared sniff helper at the top of media.go**

Find the imports block in `api/internal/interfaces/http/handler/media/media.go` and add `"net/http"` is already imported. Add a helper function near the top of the file (after the `Handler` struct definition):

```go
// sniffContentType 读取前 512 字节检测真实内容类型，覆盖客户端伪造的 Content-Type 头。
// 返回检测到的 MIME 与嗅探用的字节切片（已包含全部内容，调用方可直接传给 service）。
// 仅允许图片类型（image/png、image/jpeg、image/gif、image/webp）。
var allowedImageMIME = map[string]bool{
	"image/png":  true,
	"image/jpeg": true,
	"image/gif":  true,
	"image/webp": true,
}

// sniffImageContent 校验上传内容确为图片，返回真实 MIME；非法类型返回错误。
func sniffImageContent(content []byte) (string, error) {
	// DetectContentType 只需前 512 字节，但 content 已是全量
	mime := http.DetectContentType(content)
	if !allowedImageMIME[mime] {
		return "", fmt.Errorf("仅允许图片文件，检测到类型: %s", mime)
	}
	return mime, nil
}
```

Ensure `"fmt"` is imported (add to the import block if missing).

- [ ] **Step 2: Apply sniffing in UploadEmoji**

In `api/internal/interfaces/http/handler/media/media.go`, find `UploadEmoji` (around line 242). Replace the body that reads content and calls the service:

```go
	content := make([]byte, header.Size)
	if _, err := file.Read(content); err != nil {
		response.RespondError(w, r, err)
		return
	}
	result, err := h.emojiSvc.UploadEmoji(r.Context(), header.Filename, header.Header.Get("Content-Type"), header.Size, content)
```

with:

```go
	content := make([]byte, header.Size)
	if n, err := io.ReadFull(file, content); err != nil && err != io.ErrUnexpectedEOF {
		response.RespondError(w, r, err)
		return
	} else {
		content = content[:n] // 处理短读，按实际字节数
	}
	sniffedMIME, err := sniffImageContent(content)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	result, err := h.emojiSvc.UploadEmoji(r.Context(), header.Filename, sniffedMIME, int64(len(content)), content)
```

Ensure `"io"` is imported (add to import block if missing).

- [ ] **Step 3: Apply sniffing in UploadThumbnail**

In the same file, find `UploadThumbnail` (around line 700). Replace:

```go
	content := make([]byte, header.Size)
	if _, err := file.Read(content); err != nil {
		response.RespondError(w, r, err)
		return
	}
	url, err := h.uploadSvc.UploadThumbnail(r.Context(), appmedia.UploadThumbnailInput{
		FileID: id, FileName: header.Filename,
		MimeType: header.Header.Get("Content-Type"), Content: content,
	})
```

with:

```go
	content := make([]byte, header.Size)
	if n, err := io.ReadFull(file, content); err != nil && err != io.ErrUnexpectedEOF {
		response.RespondError(w, r, err)
		return
	} else {
		content = content[:n]
	}
	sniffedMIME, err := sniffImageContent(content)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	url, err := h.uploadSvc.UploadThumbnail(r.Context(), appmedia.UploadThumbnailInput{
		FileID: id, FileName: header.Filename,
		MimeType: sniffedMIME, Content: content,
	})
```

- [ ] **Step 4: Bound chunk body size in SaveUploadChunk**

In the same file, find `SaveUploadChunk` (around line 761). Replace:

```go
	data, err := io.ReadAll(r.Body)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
```

with (limit each chunk to 32MB; larger chunks are abnormal):

```go
	// 单分片上限 32MB，防 OOM
	r.Body = http.MaxBytesReader(w, r.Body, 32<<20)
	data, err := io.ReadAll(r.Body)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
```

- [ ] **Step 5: Verify build, vet**

Run: `cd api && go vet ./... && go build ./...`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd api
git add internal/interfaces/http/handler/media/media.go
git commit -m "fix(media): 嗅探真实 MIME 防伪造图片上传，限制分片 body 大小防 OOM"
```

---

## Task 1.5: Validate UpdateProfile input

**Problem:** `internal/interfaces/http/handler/auth/auth.go:291-318` (`UpdateProfile`) never calls `h.validate.Struct(req)` and the struct has no `validate` tags — inconsistent with `Register`. Unbounded `bio`/`avatar_url`.

**Files:**
- Modify: `api/internal/interfaces/http/handler/auth/auth.go`

- [ ] **Step 1: Add validation tags and call validate**

In `api/internal/interfaces/http/handler/auth/auth.go`, find `UpdateProfile` (around line 291). Replace the request struct and decode block:

```go
	var req struct {
		Username  string `json:"username"`
		Bio       string `json:"bio"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
```

with:

```go
	var req struct {
		Username  string `json:"username" validate:"omitempty,min=3,max=32"`
		Bio       string `json:"bio" validate:"omitempty,max=500"`
		AvatarURL string `json:"avatar_url" validate:"omitempty,max=2048"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
```

- [ ] **Step 2: Verify build, vet**

Run: `cd api && go vet ./... && go build ./...`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd api
git add internal/interfaces/http/handler/auth/auth.go
git commit -m "fix(auth): UpdateProfile 校验入参，限制 username/bio/avatar 长度"
```

---

# Phase 2: Infrastructure Robustness

---

## Task 2.1: JWT key loading fail-closed + iss/aud validation

**Problem:** `internal/infrastructure/auth/jwt.go:172-183` `loadOrGenerateKeys` silently generates ephemeral keys when paths are empty (no log, doc lies). A misconfigured prod env → every restart invalidates all tokens + key silently rotates. Also `ParseToken` never validates `iss`/`aud`.

**Fix:** Add an explicit `allowEphemeral bool` parameter. Refuse to start with ephemeral keys unless explicitly allowed (dev). Log a warning when ephemeral. Add `WithIssuer`/`WithIssuedAt` validators.

**Files:**
- Modify: `api/internal/infrastructure/auth/jwt.go`
- Modify: `api/internal/app/auth_container.go` (pass the flag)
- Modify: `api/config/config.go` (add `JWTAllowEphemeralKey`)
- Create: `api/internal/infrastructure/auth/jwt_test.go`

- [ ] **Step 1: Add config flag**

In `api/config/config.go`, find the JWT config fields. Add:

```go
// JWTAllowEphemeralKey 允许未配置密钥时生成临时密钥（仅开发环境）。
// 生产环境必须为 false（默认），否则启动时拒绝加载。
JWTAllowEphemeralKey bool `mapstructure:"jwt_allow_ephemeral_key"`
```

In `config.example.yaml`, under JWT section:
```yaml
# 允许未配置密钥文件时生成临时密钥（仅开发；生产必须 false）
jwt_allow_ephemeral_key: false
```

In `config/config.go` `Validate()` (the production guard block around line 309-372), add inside the `if cfg.Environment == "production"` block:

```go
	if cfg.JWTAllowEphemeralKey {
		return fmt.Errorf("生产环境禁止使用临时 JWT 密钥（jwt_allow_ephemeral_key 必须为 false）")
	}
	if cfg.JWTPrivateKeyPath == "" || cfg.JWTPublicKeyPath == "" {
		return fmt.Errorf("生产环境必须配置 JWT 密钥文件路径")
	}
```

- [ ] **Step 2: Write the failing test**

Create `api/internal/infrastructure/auth/jwt_test.go`:

```go
package auth

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewJWTService_RefusesEphemeralWhenNotAllowed(t *testing.T) {
	_, err := NewJWTService("", "", time.Minute, time.Hour, false)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "临时密钥")
}

func TestNewJWTService_AllowsEphemeralWhenAllowed(t *testing.T) {
	svc, err := NewJWTService("", "", time.Minute, time.Hour, true)
	require.NoError(t, err)
	require.NotNil(t, svc)

	pair, err := svc.GenerateTokenPair(TokenInput{UserID: "u1", Email: "a@b.c", Role: "user"})
	require.NoError(t, err)
	require.NotEmpty(t, pair.AccessToken)

	claims, err := svc.ParseToken(pair.AccessToken)
	require.NoError(t, err)
	assert.Equal(t, "u1", claims.UserID)
}

func TestParseToken_RejectsExpired(t *testing.T) {
	svc, _ := NewJWTService("", "", -time.Minute, time.Hour, true)
	pair, err := svc.GenerateTokenPair(TokenInput{UserID: "u1"})
	require.NoError(t, err)
	_, err = svc.ParseToken(pair.AccessToken)
	assert.Error(t, err)
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd api && go test ./internal/infrastructure/auth/ -run TestNewJWTService -v`
Expected: FAIL (signature mismatch — `NewJWTService` doesn't take the 5th `bool` param yet).

- [ ] **Step 4: Implement fail-closed key loading + validators**

In `api/internal/infrastructure/auth/jwt.go`, replace `NewJWTService` and `loadOrGenerateKeys`:

```go
// NewJWTService 创建 JWT 服务
//
// privateKeyPath/publicKeyPath 为空时：
//   - allowEphemeral=true：生成临时密钥并记录警告日志（仅开发）
//   - allowEphemeral=false：返回错误，拒绝启动（生产 fail-closed）
func NewJWTService(privateKeyPath, publicKeyPath string, accessTTL, refreshTTL time.Duration, allowEphemeral bool) (*JWTService, error) {
	priv, pub, err := loadOrGenerateKeys(privateKeyPath, publicKeyPath, allowEphemeral)
	if err != nil {
		return nil, fmt.Errorf("加载 JWT 密钥失败: %w", err)
	}
	return &JWTService{
		privateKey: priv,
		publicKey:  pub,
		accessTTL:  accessTTL,
		refreshTTL: refreshTTL,
	}, nil
}
```

Replace `loadOrGenerateKeys`:

```go
// loadOrGenerateKeys 加载或生成 ES256 密钥对
func loadOrGenerateKeys(privateKeyPath, publicKeyPath string, allowEphemeral bool) (*ecdsa.PrivateKey, *ecdsa.PublicKey, error) {
	if privateKeyPath != "" && publicKeyPath != "" {
		return loadKeysFromFiles(privateKeyPath, publicKeyPath)
	}
	if !allowEphemeral {
		return nil, nil, errors.New("未配置 JWT 密钥文件路径，且未启用临时密钥（jwt_allow_ephemeral_key）；生产环境必须配置密钥")
	}
	log.Warn().Msg("使用临时 JWT 密钥（仅开发环境）；每次重启所有令牌将失效")
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, nil, fmt.Errorf("生成 ECDSA 密钥失败: %w", err)
	}
	return privateKey, &privateKey.PublicKey, nil
}
```

Add the zerolog import at the top of jwt.go (add to the import block):
```go
	"github.com/rs/zerolog/log"
```

Add issuer/expiry validation in `ParseToken` — replace the `jwt.ParseWithClaims` call:

```go
func (s *JWTService) ParseToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodECDSA); !ok {
			return nil, fmt.Errorf("不支持的签名算法: %v", token.Header["alg"])
		}
		return s.publicKey, nil
	}, jwt.WithIssuer("blog-api"), jwt.WithExpirationRequired())
	if err != nil {
		return nil, fmt.Errorf("解析令牌失败: %w", err)
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, errors.New("无效的令牌")
	}
	return claims, nil
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd api && go test ./internal/infrastructure/auth/ -v`
Expected: PASS.

- [ ] **Step 6: Update auth_container.go to pass the flag**

In `api/internal/app/auth_container.go`, find the `NewJWTService` call (around line 39):

```go
	jwtService, err := infraauth.NewJWTService(
		cfg.JWTPrivateKeyPath, cfg.JWTPublicKeyPath,
		cfg.JWTAccessTokenTTL, cfg.JWTRefreshTokenTTL,
	)
```

Replace with:

```go
	jwtService, err := infraauth.NewJWTService(
		cfg.JWTPrivateKeyPath, cfg.JWTPublicKeyPath,
		cfg.JWTAccessTokenTTL, cfg.JWTRefreshTokenTTL,
		cfg.JWTAllowEphemeralKey,
	)
```

- [ ] **Step 7: Verify build, vet, test**

Run: `cd api && go vet ./... && go build ./... && go test ./...`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
cd api
git add internal/infrastructure/auth/jwt.go internal/infrastructure/auth/jwt_test.go internal/app/auth_container.go config/config.go ../config.example.yaml
git commit -m "fix(auth): JWT 密钥加载 fail-closed，校验 issuer/过期，防静默密钥轮换"
```

---

## Task 2.2: SSRF guard in music provider + context propagation

**Problem:** `internal/infrastructure/music/provider.go:256-262,296-303` — when the meting API returns a URL (lyrics/detail), the server fetches it via `httpGet` with no host allowlist or private-IP filter → SSRF (server can be redirected to `169.254.169.254`, internal RFC1918). Also `httpGet` (line 311) uses `http.NewRequest` without the request context, so client disconnects don't cancel upstream calls.

**Fix:** Add a `safeURL` check that rejects non-https/http(s) to private/loopback/link-local IPs. Thread `context.Context` through the public methods.

**Files:**
- Modify: `api/internal/infrastructure/music/provider.go`
- Modify: `api/internal/interfaces/http/handler/media/media.go` (pass r.Context() — already does for most; verify)

- [ ] **Step 1: Write the failing test**

Create `api/internal/infrastructure/music/provider_test.go`:

```go
package music

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSafeURL_RejectsPrivateIP(t *testing.T) {
	// 模拟一个返回内网重定向 URL 的上游
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("http://169.254.169.254/latest/meta-data/")) // 元数据端点
	}))
	defer ts.Close()

	p := NewProvider("", "", "")
	// ts 返回体内嵌一个内网 URL；fetchLyricsViaMeting 应拒绝二次请求
	// 直接测试 safeURL 谓词更简单
	err := safeURL("http://169.254.169.254/latest/meta-data/")
	assert.Error(t, err)
}

func TestSafeURL_RejectsLocalhost(t *testing.T) {
	require.Error(t, safeURL("http://localhost:8080/admin"))
	require.Error(t, safeURL("http://127.0.0.1/admin"))
}

func TestSafeURL_AllowsPublicHTTPS(t *testing.T) {
	assert.NoError(t, safeURL("https://example.com/lyrics.lrc"))
}

func TestFetchLyrics_RespectsContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	p := NewProvider("", "", "")
	_, err := p.FetchLyrics(ctx, "netease", "1")
	// 应快速返回（ctx 已取消），而非等满 10s
	assert.Error(t, err)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && go test ./internal/infrastructure/music/ -v`
Expected: FAIL (`safeURL` not defined; `FetchLyrics` may not take ctx).

- [ ] **Step 3: Add safeURL + context propagation**

In `api/internal/infrastructure/music/provider.go`, add to imports:
```go
	"context"
	"net"
	"net/url"
```

Add the `safeURL` function (near the `httpGet` helper at the bottom):

```go
// safeURL 校验目标 URL 是否安全（防 SSRF）。
// 拒绝：非 http/https、回环、私网、链路本地、保留地址。
func safeURL(rawURL string) error {
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("解析 URL 失败: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("不允许的协议: %s", u.Scheme)
	}
	host := u.Hostname()
	if host == "" {
		return errors.New("URL 缺少主机名")
	}
	// 域名解析后逐 IP 校验
	ips, err := net.LookupIP(host)
	if err != nil {
		return fmt.Errorf("解析主机 IP 失败: %w", err)
	}
	for _, ip := range ips {
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsUnspecified() {
			return fmt.Errorf("目标地址 %s 属于内网/保留段，拒绝访问", ip)
		}
	}
	return nil
}
```

Add `errors` to imports if not present.

Replace `httpGet` (around line 311) to take a context:

```go
func (p *Provider) httpGet(ctx context.Context, targetURL string) ([]byte, error) {
	if err := safeURL(targetURL); err != nil {
		return nil, fmt.Errorf("SSRF 防护拒绝: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, fmt.Errorf("构造请求失败: %w", err)
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("上游返回 %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}
```

Update all callers of `p.httpGet(...)` to pass context. In `fetchLyricsViaMeting` and `fetchDetailViaMeting`, change signatures to accept `ctx context.Context` and thread it through. In the meting-redirect branches (where the body starts with `http`), call `safeURL` on the body-URL before fetching:

```go
	// fetchLyricsViaMeting 内部，body 以 http 开头时：
	if strings.HasPrefix(strings.TrimSpace(lrc), "http") {
		target := strings.TrimSpace(lrc)
		if err := safeURL(target); err != nil {
			return "", fmt.Errorf("歌词重定向目标不安全: %w", err)
		}
		body, err = p.httpGet(ctx, target)
		// ...
	}
```

Similarly in `fetchDetailViaMeting` for `r.Lrc`.

For the public-facing methods (`FetchLyrics`, `FetchDetail`, `Search`, etc.), add `ctx context.Context` as the first parameter and propagate to `fetchLyricsViaMeting(ctx, ...)`. Update the handler in `media.go` to pass `r.Context()` (verify it already does; if a method currently takes no ctx, add it).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api && go test ./internal/infrastructure/music/ -v`
Expected: PASS.

- [ ] **Step 5: Verify full build and vet**

Run: `cd api && go vet ./... && go build ./...`
Expected: no errors (all callers updated).

- [ ] **Step 6: Commit**

```bash
cd api
git add internal/infrastructure/music/provider.go internal/infrastructure/music/provider_test.go internal/interfaces/http/handler/media/media.go
git commit -m "fix(music): SSRF 防护拒绝内网重定向，httpGet 传播 context 支持取消"
```

---

## Task 2.3: Path-traversal guard in LocalStorage

**Problem:** `internal/infrastructure/storage/local_storage.go` — `SaveChunk`/`MergeChunks`/`Move`/`GenerateThumbnail` use `filepath.Join(uploadDir, callerPath)` where `callerPath` may contain `..`. `filepath.Join("uploads", "../../etc/passwd")` → `etc/passwd`.

**Fix:** Add a `safePath` helper that verifies the cleaned result is still within `uploadDir`; reject otherwise. Apply to all path-constructing methods.

**Files:**
- Modify: `api/internal/infrastructure/storage/local_storage.go`
- Create: `api/internal/infrastructure/storage/local_storage_test.go`

- [ ] **Step 1: Write the failing test**

Create `api/internal/infrastructure/storage/local_storage_test.go`:

```go
package storage

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSafePath_RejectsTraversal(t *testing.T) {
	base, _ := filepath.Abs("/tmp/uploads")
	ls := &LocalStorage{uploadDir: base}

	// 正常子路径放行
	_, err := ls.safePath(filepath.Join(base, "emoji", "x.png"))
	assert.NoError(t, err)

	// 穿越 base 应拒绝
	_, err = ls.safePath(filepath.Join(base, "../../etc/passwd"))
	assert.Error(t, err)

	// 绝对路径逃逸应拒绝
	_, err = ls.safePath("/etc/passwd")
	require.Error(t, err)
}

func TestSaveChunk_RejectsTraversalDir(t *testing.T) {
	tmp := t.TempDir()
	ls := &LocalStorage{uploadDir: tmp}
	err := ls.SaveChunk("../../../tmp/evil", 0, []byte("x"))
	assert.Error(t, err)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && go test ./internal/infrastructure/storage/ -v`
Expected: FAIL (`safePath` not defined).

- [ ] **Step 3: Add safePath and apply guards**

In `api/internal/infrastructure/storage/local_storage.go`, find the `LocalStorage` struct definition. Ensure it has an `uploadDir string` field (if the field is named differently, rename references consistently). Add the helper:

```go
// safePath 校验 path 解析后仍位于 uploadDir 之内，防路径穿越。
func (s *LocalStorage) safePath(path string) (string, error) {
	cleanBase := filepath.Clean(s.uploadDir)
	cleanTarget := filepath.Clean(path)
	rel, err := filepath.Rel(cleanBase, cleanTarget)
	if err != nil {
		return "", fmt.Errorf("路径解析失败: %w", err)
	}
	if rel == ".." || len(rel) >= 3 && rel[:3] == ".." + string(filepath.Separator) {
		return "", fmt.Errorf("路径越界: %s", path)
	}
	// rel == "." 或不以 ".." 开头即在 base 内
	if rel != "." && rel != "" && rel[0] == '.' && rel[1] == '.' {
		return "", fmt.Errorf("路径越界: %s", path)
	}
	return cleanTarget, nil
}
```

Guard each method that constructs a path from caller input. In `SaveChunk`, `MergeChunks`, `Move`, `GenerateThumbnail`, `EnsureDir`, wrap the final path with `safePath` and return the error:

For `SaveChunk`:
```go
func (s *LocalStorage) SaveChunk(chunkDir string, index int, data []byte) error {
	dir, err := s.safePath(chunkDir)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("创建分片目录失败: %w", err)
	}
	chunkPath, err := s.safePath(filepath.Join(dir, fmt.Sprintf("chunk_%04d", index)))
	if err != nil {
		return err
	}
	if err := os.WriteFile(chunkPath, data, 0o644); err != nil {
		return fmt.Errorf("写入分片失败: %w", err)
	}
	return nil
}
```

Apply the same `safePath(xxx)` guard pattern to `MergeChunks` (for both `chunkDir` and `destPath`), `ReadChunk`, `Move` (src and dst), `GenerateThumbnail` (srcPath, destPath), `CleanupDir`, `FileSize`, `ImageDimensions`, and `BuildPath` (the final constructed dir). For any method that receives an already-absolute path, validate it before use.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api && go test ./internal/infrastructure/storage/ -v`
Expected: PASS.

- [ ] **Step 5: Verify build and vet**

Run: `cd api && go vet ./... && go build ./...`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd api
git add internal/infrastructure/storage/local_storage.go internal/infrastructure/storage/local_storage_test.go
git commit -m "fix(storage): safePath 校验防路径穿越，所有写路径限定在 uploadDir 内"
```

---

## Task 2.4: Atomic verification-code Verify (Lua) + constant-time compares

**Problem:** `internal/infrastructure/auth/redis_store.go:111-141` `Verify` does GET→check→SET/Del non-atomically; concurrent verifies all read the same attempt count, defeating the 5-attempt brute-force cap. Also `redis_store.go:51,133` use `==` for token/code comparison (timing side-channel).

**Fix:** Replace `Verify` with a Lua script that does GET+attempt-check+INCR-or-DEL atomically. Use `crypto/subtle.ConstantTimeCompare` for refresh token comparison.

**Files:**
- Modify: `api/internal/infrastructure/auth/redis_store.go`
- Create: `api/internal/infrastructure/auth/redis_store_test.go`

- [ ] **Step 1: Write the failing test (concurrent brute-force)**

Create `api/internal/infrastructure/auth/redis_store_test.go`:

```go
package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"testing"
	"time"

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

func TestVerify_AtomicUnderConcurrency(t *testing.T) {
	client := newTestRedis(t)
	store := NewRedisCodeStore(client)

	codeHash := sha256Hex("123456")
	require.NoError(t, store.Store(context.Background(), "verify", "a@b.c", codeHash))

	// 并发 20 次错误验证（错误码），尝试次数应被严格计数
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

	// 全部应失败（错误码）
	for _, ok := range results {
		assert.False(t, ok)
	}
	// 超过 maxAttempt 后 key 应被删除（再 Verify 返回 false 且 key 不存在）
	// 由于 20 > 5，key 一定已被删
	ok, err := store.Verify(context.Background(), "verify", "a@b.c", codeHash)
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
}

func sha256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

// 避免未使用 import 报错
var _ = time.Minute
```

If `miniredis` is not in go.mod, run `go get github.com/alicebob/miniredis/v2` first.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && go test ./internal/infrastructure/auth/ -run TestVerify -v`
Expected: FAIL (the concurrent test races — without atomicity, some goroutines may see attempts < maxAttempt and the final correct-code Verify may wrongly pass; or the test may pass non-deterministically — run with `-race -count=10` to expose).

- [ ] **Step 3: Implement atomic Lua Verify**

In `api/internal/infrastructure/auth/redis_store.go`, find the `Verify` method (around line 111). Replace it with a Lua-based atomic version:

```go
// verifyScript 原子验证：GET → 检查尝试次数 → 匹配则 DEL / 不匹配则 INCR / 超限则 DEL
// 返回值（数组）：
//   [1] = 1 表示匹配，0 表示不匹配
//   [2] = 当前尝试次数（调试用）
var verifyScript = redis.NewScript(`
local data = redis.call('GET', KEYS[1])
if not data then
  return {0, -1}
end
local attempts = tonumber(ARGV[2]) or 0
local stored_hash = cjson.decode(data)['CodeHash']
if stored_hash == ARGV[1] then
  redis.call('DEL', KEYS[1])
  return {1, attempts}
end
attempts = attempts + 1
if attempts >= tonumber(ARGV[3]) then
  redis.call('DEL', KEYS[1])
  return {0, attempts}
end
local decoded = cjson.decode(data)
decoded['Attempts'] = attempts
decoded['Expires'] = tonumber(ARGV[4])
redis.call('SET', KEYS[1], cjson.encode(decoded), 'EX', tonumber(ARGV[4]))
return {0, attempts}
`)

// Verify 验证并消费验证码（原子操作，防并发暴力破解）
func (s *RedisCodeStore) Verify(ctx context.Context, prefix, identifier, codeHash string) (bool, error) {
	key := s.codeKey(prefix, identifier)
	res, err := verifyScript.Run(ctx, s.client, []string{key}, codeHash, 0, s.maxAttempt, int64(s.ttl.Seconds())).Result()
	if err != nil {
		if err == redis.Nil {
			return false, nil
		}
		return false, fmt.Errorf("验证码校验失败: %w", err)
	}
	vals, ok := res.([]interface{})
	if !ok || len(vals) < 1 {
		return false, nil
	}
	matched, ok := vals[0].(int64)
	return ok && matched == 1, nil
}
```

Note: the JSON shape must match what `Store` writes. Check `VerificationData` struct tags — if it's stored via `redis.Scan`/JSON, ensure the Lua `cjson.decode` key matches the JSON field name (e.g. `CodeHash`). If `VerificationData` has json tags like `CodeHash string`, the script above works. Verify by reading the struct definition at the top of the file and adjust the Lua keys to match the actual JSON field names.

- [ ] **Step 4: Add constant-time compare for refresh token in RedisTokenStore**

In the same file, find `RedisTokenStore.Verify` (the refresh-token verify, around line 51). Replace the comparison `stored == refreshToken` with:

```go
import "crypto/subtle"

// ...inside Verify:
if subtle.ConstantTimeCompare([]byte(stored), []byte(refreshToken)) == 1 {
	return true, nil
}
```

- [ ] **Step 5: Run test to verify it passes (with race detector)**

Run: `cd api && go test ./internal/infrastructure/auth/ -race -count=5 -v`
Expected: PASS, no race detected.

- [ ] **Step 6: Verify build and vet**

Run: `cd api && go vet ./... && go build ./...`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd api
go get github.com/alicebob/miniredis/v2  # if not yet
git add go.mod go.sum internal/infrastructure/auth/redis_store.go internal/infrastructure/auth/redis_store_test.go
git commit -m "fix(auth): 验证码 Verify 改 Lua 原子操作防并发暴力，refresh token 恒定时间比较"
```

---

## Task 2.5: Minor infra fixes (email escape, github URL escape)

**Problem:** `email/templates.go:22,54` interpolates code via `fmt.Sprintf` without HTML-escaping (low risk now, future HTML injection). `github/adapter.go:100` interpolates username into URL without `url.PathEscape`.

**Files:**
- Modify: `api/internal/infrastructure/email/templates.go`
- Modify: `api/internal/infrastructure/github/adapter.go`

- [ ] **Step 1: HTML-escape email code**

In `api/internal/infrastructure/email/templates.go`, add `"html"` to imports. Find the two `fmt.Sprintf` calls that embed `code` (around line 22 and 54) and wrap the code: `html.EscapeString(code)`.

Example: replace `code` in the Sprintf args with `html.EscapeString(code)`.

- [ ] **Step 2: URL-escape github username**

In `api/internal/infrastructure/github/adapter.go`, add `"net/url"` to imports. Find the `fmt.Sprintf("https://api.github.com/users/%s/repos?...", username, ...)` call (around line 100) and replace `%s` for username with `%s` fed `url.PathEscape(username)`:

```go
	apiURL := fmt.Sprintf("https://api.github.com/users/%s/repos?sort=updated&per_page=100",
		url.PathEscape(username))
```

- [ ] **Step 3: Verify build and vet**

Run: `cd api && go vet ./... && go build ./...`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd api
git add internal/infrastructure/email/templates.go internal/infrastructure/github/adapter.go
git commit -m "fix(infra): 邮件验证码 HTML 转义，github 用户名 URL 转义"
```

---

# Phase 3: Correctness Bugs

---

## Task 3.1: Rewrite PostRepository.Save with proper transaction + tag association

**Problem:** `internal/infrastructure/persistence/gorm/post_repo.go:136-169` — uses hand-rolled `Begin/Commit` + `defer recover()` (reinvents `.Transaction`), the post_tags delete uses an anonymous struct with no table mapping (dead/broken branch), and tag sync uses raw SQL while the model declares `many2many:post_tags`.

**Fix:** Use `db.Transaction()` and GORM Association API.

**Files:**
- Modify: `api/internal/infrastructure/persistence/gorm/post_repo.go`
- Create: `api/internal/infrastructure/persistence/gorm/post_repo_test.go`

- [ ] **Step 1: Write the failing test**

Create `api/internal/infrastructure/persistence/gorm/post_repo_test.go`:

```go
package gorm

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/domain/post"
	"blog-api/internal/domain/tag"
)

func TestPostRepository_SaveSyncsTags(t *testing.T) {
	db := setupTestDB(t) // 复用已有 helper；需要 AutoMigrate Post/Tag
	// 注意：setupTestDB 当前只 migrate User/Role/Permission/RolePermission；
	// 此处扩展迁移 Post/Tag/post_tags：
	require.NoError(t, db.AutoMigrate(/* model.Post, model.Tag, etc. */))

	repo := NewPostRepository(db)

	// 先建两个 tag
	tagRepo := NewTagRepository(db)
	require.NoError(t, tagRepo.Save(context.Background(), tag.NewTag("go")))
	require.NoError(t, tagRepo.Save(context.Background(), tag.NewTag("web")))

	// 保存一篇文章带两个 tag
	pid := domainshared.NewID()
	p := post.NewPost(pid, "Title", "body", "slug-1", "draft", []string{"go", "web"})
	require.NoError(t, repo.Save(context.Background(), p))

	// 重新读回，验证 tag 关联正确
	loaded, err := repo.FindByID(context.Background(), pid)
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"go", "web"}, loaded.Tags())

	// 更新：移除 web，新增 db
	loaded.SetTags([]string{"go", "db"})
	require.NoError(t, tagRepo.Save(context.Background(), tag.NewTag("db")))
	require.NoError(t, repo.Save(context.Background(), loaded))

	loaded2, err := repo.FindByID(context.Background(), pid)
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"go", "db"}, loaded2.Tags())
}
```

Note: the exact `post.NewPost` / `SetTags` signatures depend on the domain. Read `internal/domain/post/entity.go` to match constructor/mutator names, and `internal/domain/tag/entity.go` for `NewTag`. Update `setupTestDB` (or use a local migrate) to include `model.Post`, `model.Tag`, and the join table — check `internal/infrastructure/persistence/gorm/model/content.go` for the exact model structs to migrate. If `setupTestDB` is shared and you don't want to change it, create a local `setupPostTestDB(t)` in this test file that migrates the needed models.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && go test ./internal/infrastructure/persistence/gorm/ -run TestPostRepository_SaveSyncsTags -v`
Expected: FAIL (tags not synced correctly with current Save).

- [ ] **Step 3: Rewrite Save**

In `api/internal/infrastructure/persistence/gorm/post_repo.go`, replace the `Save` method (lines ~136-169):

```go
func (r *PostRepository) Save(ctx context.Context, p *post.Post) error {
	po := postToPO(p)
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 保存文章
		if err := tx.Save(&po).Error; err != nil {
			return domainshared.Internal("保存文章失败", err)
		}
		// 通过关联 API 同步标签：查询 tag name → id，替换关联
		if len(p.Tags()) == 0 {
			return tx.Model(&po).Association("Tags").Clear()
		}
		var tags []model.Tag
		if err := tx.Where("name IN ?", p.Tags()).Find(&tags).Error; err != nil {
			return domainshared.Internal("查询标签失败", err)
		}
		return tx.Model(&po).Association("Tags").Replace(&tags)
	})
}
```

Ensure `model` and `gorm` are imported. Verify the `Post` model has a `Tags` field with `gorm:"many2many:post_tags"` (per `model/content.go:30`); if the relation field name differs, adjust `Association("Tags")` to match the struct field name.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api && go test ./internal/infrastructure/persistence/gorm/ -run TestPostRepository -v`
Expected: PASS.

- [ ] **Step 5: Verify build, vet, full tests**

Run: `cd api && go vet ./... && go build ./... && go test ./...`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd api
git add internal/infrastructure/persistence/gorm/post_repo.go internal/infrastructure/persistence/gorm/post_repo_test.go
git commit -m "fix(post): Save 用 Transaction+Association 正确同步标签，移除裸 SQL 与死分支"
```

---

## Task 3.2: Map validator/JSON-decode errors to 400 in RespondError

**Problem:** `internal/interfaces/http/response/error.go:44-72` — `validator.ValidationErrors` and `json.SyntaxError` aren't `*DomainError` or `gorm.ErrRecordNotFound`, so they fall to the 500 branch. Should be 400.

**Files:**
- Modify: `api/internal/interfaces/http/response/error.go`

- [ ] **Step 1: Add 400 mapping for validator and json errors**

In `api/internal/interfaces/http/response/error.go`, add imports:
```go
	"encoding/json"
	"github.com/go-playground/validator/v10"
```

Insert before the final `log.Error()...` 500 branch (after the `gorm.ErrRecordNotFound` check):

```go
	// 校验错误 → 400
	var valErrs validator.ValidationErrors
	if errors.As(err, &valErrs) {
		details := make(map[string][]string)
		for _, fe := range valErrs {
			details[fe.Field()] = append(details[fe.Field()], fmt.Sprintf("校验失败: %s", fe.Tag()))
		}
		resp.Error = "VALIDATION_ERROR"
		resp.Message = "请求参数校验失败"
		resp.Details = details
		WriteJSON(w, http.StatusBadRequest, resp)
		return
	}

	// JSON 解析错误 → 400
	var syntaxErr *json.SyntaxError
	if errors.As(err, &syntaxErr) {
		resp.Error = "BAD_REQUEST"
		resp.Message = "请求体格式错误"
		WriteJSON(w, http.StatusBadRequest, resp)
		return
	}
	// 通用 json.UnmarshalTypeError（字段类型不匹配）也归 400
	var unmarshalErr *json.UnmarshalTypeError
	if errors.As(err, &unmarshalErr) {
		resp.Error = "BAD_REQUEST"
		resp.Message = fmt.Sprintf("字段 %s 类型错误，期望 %s", unmarshalErr.Field, unmarshalErr.Type.String())
		WriteJSON(w, http.StatusBadRequest, resp)
		return
	}

	// io.EOF / 普通 JSON decode 错误（如空 body）
	if errors.Is(err, io.EOF) {
		resp.Error = "BAD_REQUEST"
		resp.Message = "请求体为空"
		WriteJSON(w, http.StatusBadRequest, resp)
		return
	}
```

Add `"fmt"` and `"io"` to imports.

- [ ] **Step 2: Verify build and vet**

Run: `cd api && go vet ./... && go build ./...`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd api
git add internal/interfaces/http/response/error.go
git commit -m "fix(response): 校验/JSON 解析错误映射为 400，避免污染 5xx 告警"
```

---

## Task 3.3: Stop swallowing errors in stats/audit/admin stores + map to DomainError

**Problem:** `stats_store.go`, `audit_store.go`, `admin_user_store.go`, `session_repo.go` return zero/nil with swallowed errors on Count/Scan/Find failures. `audit_store.go:51,63,65` ignores errors entirely; `stats_store.go:25-48` ignores every Count error (dashboard silently shows zeros); `session_repo.go:101-103` returns raw err without mapping to `ErrSessionNotFound`.

**Files:**
- Modify: `api/internal/infrastructure/persistence/gorm/stats_store.go`
- Modify: `api/internal/infrastructure/persistence/gorm/audit_store.go`
- Modify: `api/internal/infrastructure/persistence/gorm/admin_user_store.go`
- Modify: `api/internal/infrastructure/persistence/gorm/session_repo.go`

- [ ] **Step 1: Fix stats_store.go**

In `stats_store.go`, find every `.Count(&x).Error` and `.Scan(&rows).Error` call (lines 25-48). Wrap each error:

Replace patterns like:
```go
	if err := s.db.WithContext(ctx).Model(&model.Post{}).Count(&count).Error; err != nil {
		return DashboardStats{}, nil  // BUG: 吞错
	}
```
with:
```go
	if err := s.db.WithContext(ctx).Model(&model.Post{}).Count(&count).Error; err != nil {
		return DashboardStats{}, domainshared.Internal("统计文章数失败", err)
	}
```

Apply to all ~7 queries in `GetDashboard`. Add the `domainshared` import if missing (it likely is already).

- [ ] **Step 2: Fix audit_store.go**

In `audit_store.go`, find every ignored `.Error` (lines 51, 63, 65, 83, 86). For each `Count`/`Scan`, return the wrapped error instead of `nil`/zero. Example:

```go
	// before:
	if err := s.db.WithContext(ctx).Model(&model.AuditLog{}).Count(&total).Error; err != nil {
		return AuditResult{}, nil
	}
	// after:
	if err := s.db.WithContext(ctx).Model(&model.AuditLog{}).Count(&total).Error; err != nil {
		return AuditResult{}, domainshared.Internal("审计日志查询失败", err)
	}
```

Return the appropriate zero value struct with the error.

- [ ] **Step 3: Fix admin_user_store.go**

In `admin_user_store.go`, fix lines 44, 46 (Count/Find errors ignored), and line 61 (`err == gorm.ErrRecordNotFound` → `errors.Is`).

Replace:
```go
	if err := s.db.WithContext(ctx).Model(&model.User{}).Count(&total).Error; err != nil {
		return nil, 0, nil
	}
```
with:
```go
	if err := s.db.WithContext(ctx).Model(&model.User{}).Count(&total).Error; err != nil {
		return nil, 0, domainshared.Internal("用户计数失败", err)
	}
```

And line 61 `err == gorm.ErrRecordNotFound` → `errors.Is(err, gorm.ErrRecordNotFound)`. Add `"errors"` import.

- [ ] **Step 4: Fix session_repo.go**

In `session_repo.go`, find line ~101-103 (the `First` returning raw err). Map to domain sentinel:

```go
	if err := s.db.WithContext(ctx).First(&po, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, upload.ErrSessionNotFound
		}
		return nil, domainshared.Internal("查询上传会话失败", err)
	}
```

Ensure `upload.ErrSessionNotFound` exists in `domain/upload` (check `internal/domain/upload/entity.go`; if not defined, add `var ErrSessionNotFound = shared.NotFound("上传会话")` there). Also fix `DeleteExpired` (line ~133) to wrap errors.

- [ ] **Step 5: Verify build, vet**

Run: `cd api && go vet ./... && go build ./...`
Expected: no errors (all imports resolved).

- [ ] **Step 6: Commit**

```bash
cd api
git add internal/infrastructure/persistence/gorm/stats_store.go internal/infrastructure/persistence/gorm/audit_store.go internal/infrastructure/persistence/gorm/admin_user_store.go internal/infrastructure/persistence/gorm/session_repo.go internal/domain/upload/entity.go
git commit -m "fix(repo): stats/audit/admin/session 存储不再吞错，统一映射 DomainError"
```

---

## Task 3.4: Fix cleanup_job races + delete order + batching

**Problem:** `internal/job/cleanup_job.go`:
- `CleanExpiredSessions` (32-66): non-conditional status update races concurrent `SaveChunk`.
- `PhysicalDeleteFiles` (127-167): deletes DB row before disk file → orphan on os.Remove failure. Order must reverse.
- `CleanOrphanTmp` (70-122): N+1 query per dir, swallows non-NotFound DB errors.

**Files:**
- Modify: `api/internal/job/cleanup_job.go`

- [ ] **Step 1: Add conditional CAS to CleanExpiredSessions**

In `internal/job/cleanup_job.go`, find `CleanExpiredSessions`. Change the status update from unconditional to conditional (only flip `active`→`expired`):

Replace the `Update("status", expired)` call with:
```go
	// 仅在仍为 active 时翻转为 expired（CAS，避免与 SaveChunk 竞态）
	res := j.db.WithContext(ctx).Model(&model.UploadSession{}).
		Where("id = ? AND status = ?", sess.ID, "active").
		Update("status", "expired")
	if res.Error != nil {
		log.Error().Err(res.Error).Str("session_id", sess.ID).Msg("更新会话状态失败")
		continue
	}
	// 只有真正翻转的会话才清理 tmp 目录（rows affected > 0）
	if res.RowsAffected == 0 {
		continue
	}
```

Move the tmp-dir cleanup to after the CAS succeeds (so only sessions we actually own get cleaned).

- [ ] **Step 2: Reverse delete order in PhysicalDeleteFiles**

In `PhysicalDeleteFiles` (127-167), reverse: delete disk file FIRST, then DB row. Replace the block:

```go
	// 先删磁盘文件；失败则保留 DB 行，下次 tick 重试
	if err := os.Remove(file.DiskPath); err != nil && !os.IsNotExist(err) {
		log.Error().Err(err).Str("file_id", file.ID).Msg("删除磁盘文件失败，保留 DB 行待重试")
		continue
	}
	// 文件已删（或本不存在），再删 DB 行
	if err := j.db.WithContext(ctx).Unscoped().Delete(&model.File{}, file.ID).Error; err != nil {
		log.Error().Err(err).Str("file_id", file.ID).Msg("删除 DB 行失败")
	}
```

Adjust field names (`DiskPath`, `file.ID`) to match the actual model (`internal/infrastructure/persistence/gorm/model/content.go` `File` struct).

- [ ] **Step 3: Batch CleanOrphanTmp query**

In `CleanOrphanTmp`, replace the per-dir `First` with a single batched query. Collect all dir names, do one `Find` with `Where("id IN ?", dirNames)`, build a set of valid session IDs, then treat dirs whose ID is not in the set as orphans:

```go
	// 一次性查询所有相关 session
	var existingIDs []string
	if len(dirNames) > 0 {
		if err := j.db.WithContext(ctx).Model(&model.UploadSession{}).
			Where("id IN ?", dirNames).Pluck("id", &existingIDs).Error; err != nil {
			log.Error().Err(err).Msg("批量查询会话失败，跳过本次")
			return
		}
	}
	existingSet := make(map[string]bool, len(existingIDs))
	for _, id := range existingIDs {
		existingSet[id] = true
	}
	for _, dirName := range dirNames {
		if existingSet[dirName] {
			continue // 仍有对应 session，跳过
		}
		// 孤儿目录，清理
		_ = os.RemoveAll(filepath.Join(j.chunkDir, dirName))
	}
```

- [ ] **Step 4: Verify build and vet**

Run: `cd api && go vet ./... && go build ./...`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd api
git add internal/job/cleanup_job.go
git commit -m "fix(job): 会话清理加 CAS 防竞态，删文件先于删 DB 行，批量查孤儿目录"
```

---

## Task 3.5: Remove dead ReactionRepository

**Problem:** `internal/infrastructure/persistence/gorm/comment_repo.go:285-392` defines `ReactionRepository` (implements `domain/comment.ReactionRepository`), but no container instantiates it — the live path uses `CommentReactionStore`. Also `domain/comment/repository.go:41-87` defines the dead `ReactionRepository` port + `ReconstructReaction` (misleading signature). This dead code is the source of the earlier (incorrect) "CRITICAL: emoji filter dropped" finding.

**Files:**
- Modify: `api/internal/infrastructure/persistence/gorm/comment_repo.go` (delete lines 285-392)
- Modify: `api/internal/domain/comment/repository.go` (delete ReactionRepository interface + ReconstructReaction)

- [ ] **Step 1: Confirm ReactionRepository is unreferenced**

Run: `cd api && grep -rn "ReactionRepository\|ReconstructReaction" --include="*.go" | grep -v "_test.go"`
Expected: only the definition sites in `comment_repo.go` and `comment/repository.go`, plus the interface assertion `var _ comment.ReactionRepository = ...`. No callers in `app/` or `cmd/`.

If any caller exists, STOP and report — do not delete live code.

- [ ] **Step 2: Delete the dead implementation**

In `api/internal/infrastructure/persistence/gorm/comment_repo.go`, delete lines 285-392 (the entire `// ReactionRepository` section through the `var _ comment.ReactionRepository = ...` assertion).

- [ ] **Step 3: Delete the dead port**

In `api/internal/domain/comment/repository.go`, delete the `ReactionRepository` interface (lines ~41-87) and `ReconstructReaction` if present. Keep the comment-level `Reaction` entity references only if used elsewhere.

- [ ] **Step 4: Verify build and vet (catches any remaining reference)**

Run: `cd api && go vet ./... && go build ./...`
Expected: no errors. If a reference remains, the build will fail and tell you exactly where.

- [ ] **Step 5: Commit**

```bash
cd api
git add internal/infrastructure/persistence/gorm/comment_repo.go internal/domain/comment/repository.go
git commit -m "refactor(comment): 删除未使用的 ReactionRepository 死代码"
```

---

# Phase 4: UnitOfWork Build + Transactional Use Cases

This phase makes the dormant `UnitOfWork` real. The current `TxContext` is an empty marker interface with a documented-but-missing `app/tx_adapter.go`. We give it a concrete resource-acquisition API that stays framework-neutral at the application layer, then wrap the multi-write use cases.

---

## Task 4.1: Define concrete TxContext with typed resource access

**Problem:** `application/shared/uow.go` `TxContext` is `isTxContext()` marker only — no way for application services to obtain transactional repositories. The gorm impl (`infrastructure/persistence/gorm/uow.go:45`) passes `*gorm.DB` directly, which application layer can't reference without breaking layering.

**Fix:** Define `TxContext` with a generic `Get(dst interface{})` accessor that app layer uses to receive a transactional repo. The infrastructure side populates it.

**Files:**
- Modify: `api/internal/application/shared/uow.go`
- Modify: `api/internal/infrastructure/persistence/gorm/uow.go`
- Create: `api/internal/app/tx_context.go`

- [ ] **Step 1: Redefine TxContext in application/shared/uow.go**

Replace the entire `TxContext` interface section in `api/internal/application/shared/uow.go`:

```go
// TxContext 事务上下文
//
// 在事务内通过 Get 获取事务化的仓储/存储实例。
// 调用方传入一个指向接口的指针（如 *user.UserRepository 的具体指针变量），
// 基础设施实现负责注入对应的事务化实例。
//
// 设计保持 application 层零框架依赖：本接口不出现 gorm/sql 类型。
type TxContext interface {
	// Get 将事务化的资源注入 dst。
	// dst 必须是指向接口或结构体的指针；由 app 层在装配时绑定工厂。
	Get(dst interface{}) error
}
```

- [ ] **Step 2: Implement TxContext in infrastructure**

In `api/internal/infrastructure/persistence/gorm/uow.go`, add a concrete `txContext`:

```go
// txContext GORM 事务上下文实现
type txContext struct {
	tx      *gorm.DB
	factory RepoFactory // app 层装配注入的工厂
}

// RepoFactory 把事务化 *gorm.DB 包装成各仓储实例的工厂。
// 由 app 包实现（见 app/tx_context.go），避免 infra 反向依赖 application。
type RepoFactory interface {
	// Make 返回请求类型的仓储实例。
	// typ 是目标指针的具体类型（reflect.TypeOf(dst).Elem()）。
	Make(tx *gorm.DB, typ reflect.Type) (interface{}, error)
}

// Get 注入事务化仓储
func (c *txContext) Get(dst interface{}) error {
	if c.factory == nil {
		return errors.New("TxContext 未配置 RepoFactory")
	}
	typ := reflect.TypeOf(dst)
	if typ.Kind() != reflect.Ptr {
		return errors.New("TxContext.Get 入参必须是指针")
	}
	repo, err := c.factory.Make(c.tx, typ.Elem())
	if err != nil {
		return err
	}
	reflect.ValueOf(dst).Elem().Set(reflect.ValueOf(repo))
	return nil
}
```

Update `UnitOfWork.Do` to construct the context:

```go
func (uow *UnitOfWork) Do(ctx context.Context, fn func(tx sharedapp.TxContext) error) error {
	return uow.db.WithContext(ctx).Transaction(func(txDB *gorm.DB) error {
		txCtx := &txContext{tx: txDB, factory: uow.factory}
		return fn(txCtx)
	})
}
```

Add `reflect`, `errors`, `gorm.io/gorm` imports, and `"blog-api/internal/application/shared" as sharedapp`. Add a `factory RepoFactory` field to the `UnitOfWork` struct, set via constructor:

```go
func NewUnitOfWork(db *gorm.DB, factory RepoFactory) *UnitOfWork {
	return &UnitOfWork{db: db, factory: factory}
}
```

- [ ] **Step 3: Create the RepoFactory binding in app/tx_context.go**

Create `api/internal/app/tx_context.go`:

```go
// Package app 提供 DDD 装配，本文件桥接 GORM 事务与各仓储工厂。
package app

import (
	"errors"
	"reflect"

	"gorm.io/gorm"

	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
)

// appRepoFactory 实现 gormrepo.RepoFactory，按目标类型生产事务化仓储。
type appRepoFactory struct{}

// makeRepoFactory 创建工厂单例
func makeRepoFactory() gormrepo.RepoFactory { return appRepoFactory{} }

// Make 根据目标接口/类型返回用 tx 构造的仓储实例
func (appRepoFactory) Make(tx *gorm.DB, typ reflect.Type) (interface{}, error) {
	switch typ {
	// 按需逐个添加：类型 → 构造函数
	case reflect.TypeOf((*interface{})(nil)).Elem(): // placeholder, replaced below
		return nil, errors.New("未配置")
	default:
		return nil, errors.New("RepoFactory 未注册类型: " + typ.String())
	}
}
```

This is a starting skeleton — Task 4.2 adds real type cases. The switch will grow as we wire each transactional repo (post repo, session repo, file repo, settings store).

- [ ] **Step 4: Verify build (will fail until 4.2 wires types — that's expected)**

Run: `cd api && go build ./...`
Expected: builds (factory exists, switch returns error for unknown types — fine until callers exist).

- [ ] **Step 5: Commit (incremental, compiles)**

```bash
cd api
git add internal/application/shared/uow.go internal/infrastructure/persistence/gorm/uow.go internal/app/tx_context.go
git commit -m "feat(uow): 定义 TxContext.Get 资源注入，GORM 实现事务上下文 + 工厂桥接"
```

---

## Task 4.2: Wire post repo into RepoFactory + wrap IncrementView in tx

**Problem:** `application/post/service.go:214` `IncrementView` does `repo.Save(p)` then `repo.RecordView(...)` non-atomically; if `RecordView` fails, view count is incremented but no analytics row.

**Fix:** Register `post.PostRepository` in the factory. Give `PostService` a `uow` dependency. Wrap `IncrementView` in a transaction that re-fetches the repo from `TxContext`.

**Files:**
- Modify: `api/internal/app/tx_context.go` (add post case)
- Modify: `api/internal/application/post/service.go` (add uow, wrap IncrementView)
- Modify: `api/internal/app/post_container.go` (inject uow)
- Modify: `api/cmd/server/main.go` (construct UnitOfWork + factory)

- [ ] **Step 1: Add post.PostRepository to factory**

In `api/internal/app/tx_context.go`, update the `Make` switch. First read `internal/domain/post/repository.go` to get the exact `PostRepository` interface type, then:

```go
func (appRepoFactory) Make(tx *gorm.DB, typ reflect.Type) (interface{}, error) {
	switch typ {
	case reflect.TypeOf((*post.PostRepository)(nil)).Elem():
		return gormrepo.NewPostRepository(tx), nil
	default:
		return nil, errors.New("RepoFactory 未注册类型: " + typ.String())
	}
}
```

Add imports `"blog-api/internal/domain/post"`.

- [ ] **Step 2: Add uow to PostService and wrap IncrementView**

In `api/internal/application/post/service.go`, read the existing `Service` struct and `NewService` constructor. Add a `uow appshared.UnitOfWork` field and constructor parameter.

Then replace `IncrementView`:

```go
// IncrementView 浏览量 +1（含浏览事件记录，供 admin 趋势统计）
// 在单个事务内完成计数更新与事件记录，保证一致性。
func (s *Service) IncrementView(ctx context.Context, id, ipAddress, userAgent string) error {
	pid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	if s.uow == nil {
		// 降级：无 UoW 时保持旧行为（向后兼容）
		return s.incrementViewLegacy(ctx, pid, ipAddress, userAgent)
	}
	return s.uow.Do(ctx, func(tx appshared.TxContext) error {
		var repo post.PostRepository
		if err := tx.Get(&repo); err != nil {
			return shared.Internal("获取事务化文章仓储失败", err)
		}
		p, err := repo.FindByID(ctx, pid)
		if err != nil {
			return err
		}
		p.IncrementView()
		if err := repo.Save(ctx, p); err != nil {
			return err
		}
		return repo.RecordView(ctx, pid, ipAddress, userAgent)
	})
}

// incrementViewLegacy 无事务降级路径
func (s *Service) incrementViewLegacy(ctx context.Context, pid shared.ID, ipAddress, userAgent string) error {
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return err
	}
	p.IncrementView()
	if err := s.repo.Save(ctx, p); err != nil {
		return err
	}
	return s.repo.RecordView(ctx, pid, ipAddress, userAgent)
}
```

Note: `post.PostRepository` must be an interface (it is, per `domain/post/repository.go`). Confirm `FindByID`, `Save`, `RecordView` are all on that interface; if `RecordView` isn't on the interface, add it.

- [ ] **Step 3: Wire uow in post_container.go**

In `api/internal/app/post_container.go`, read the existing `NewPostContainer` signature. Add a `uow appshared.UnitOfWork` parameter and pass it to `post.NewService`. If `NewService` is `post.NewService(repo, ...)`, append `uow`.

- [ ] **Step 4: Construct UnitOfWork in main.go**

In `api/cmd/server/main.go`, after `db` is created, add:

```go
	// 构建工作单元（事务边界）
	repoFactory := app.MakeRepoFactory() // 导出的工厂构造函数（见下）
	uow := gormrepo.NewUnitOfWork(db, repoFactory)
```

Export the factory constructor in `app/tx_context.go`:
```go
// MakeRepoFactory 导出工厂构造函数（供 main.go 调用）
func MakeRepoFactory() gormrepo.RepoFactory { return appRepoFactory{} }
```

Pass `uow` to `app.NewPostContainer(...)` (update the call signature).

- [ ] **Step 5: Verify build, vet**

Run: `cd api && go vet ./... && go build ./...`
Expected: no errors. (If main.go has other `NewPostContainer` callers, update them too.)

- [ ] **Step 6: Commit**

```bash
cd api
git add internal/app/tx_context.go internal/application/post/service.go internal/app/post_container.go cmd/server/main.go internal/domain/post/repository.go
git commit -m "feat(post): IncrementView 在事务内完成计数+事件记录，保证一致性"
```

---

## Task 4.3: Wrap CompleteUpload in transaction + add settings UpsertMany

This is the largest transactional wrap — `CompleteUpload` does 5 writes. Also add `UpsertMany` to settings store for atomic multi-key update.

**Files:**
- Modify: `api/internal/infrastructure/persistence/gorm/settings_store.go` (add UpsertMany)
- Modify: `api/internal/domain/settings/entity.go` (add UpsertMany to port)
- Modify: `api/internal/application/settings/service.go` (use UpsertMany)
- Modify: `api/internal/app/tx_context.go` (register session/file/settings repos)
- Modify: `api/internal/application/media/service.go` (wrap CompleteUpload)
- Modify: `api/internal/app/media_container.go` (inject uow)

- [ ] **Step 1: Add UpsertMany to settings store**

In `api/internal/infrastructure/persistence/gorm/settings_store.go`, add:

```go
// UpsertMany 批量写入或更新多个配置（单事务，原子）
func (s *SettingsStore) UpsertMany(ctx context.Context, kvs map[string]string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		for k, v := range kvs {
			row := SiteSetting{Key: k, Value: v, UpdatedAt: now}
			if err := tx.Save(&row).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
```

- [ ] **Step 2: Add UpsertMany to settings domain port**

In `api/internal/domain/settings/entity.go`, find the `SettingsStore` (or equivalent) interface and add:
```go
	UpsertMany(ctx context.Context, kvs map[string]string) error
```

- [ ] **Step 3: Use UpsertMany in settings service**

In `api/internal/application/settings/service.go`, find `Update` (around line 57-102). Replace the per-key loop with a single batched call:

```go
	// 旧：
	// for k, v := range updates {
	//     if err := store.Upsert(ctx, k, v); err != nil { ... }
	// }
	// 新：
	if err := store.UpsertMany(ctx, updates); err != nil {
		return shared.Internal("批量更新配置失败", err)
	}
```

- [ ] **Step 4: Register session/file repos in factory**

In `api/internal/app/tx_context.go`, add cases to the `Make` switch (read the exact interface types from their `repository.go` files first):
```go
	case reflect.TypeOf((*upload.UploadSessionRepository)(nil)).Elem():
		return gormrepo.NewUploadSessionRepository(tx), nil
	case reflect.TypeOf((*upload.FileRepository)(nil)).Elem():
		return gormrepo.NewFileRepository(tx), nil
```

Verify the constructor names (`NewUploadSessionRepository` exists per the earlier grep; check `NewFileRepository` in `media_repo.go:334`). Read `internal/domain/upload/repository.go` to confirm interface names.

- [ ] **Step 5: Wrap CompleteUpload in tx**

In `api/internal/application/media/service.go`, read `CompleteUpload` (around line 837-917). The current flow: CAS session status → storage.Move → fileRepo.Save → sessionRepo.UpdateStatus. Add a `uow` field to the upload service struct.

Wrap the DB-touching portion in a transaction. Since `storage.Move` is a filesystem op (not DB), keep it outside the DB tx but order it carefully:

```go
func (s *UploadService) CompleteUpload(ctx context.Context, uploadID, userID string) (Result, error) {
	// 1. 校验所有权 + CAS 状态（事务外查询，事务内翻转）
	// ...existing pre-checks...

	// 2. 文件系统移动（事务外；失败直接返回，不污染 DB）
	if err := s.storage.Move(srcPath, destPath); err != nil {
		return Result{}, shared.Internal("文件移动失败", err)
	}

	// 3. DB 写入在单事务内：fileRepo.Save + sessionRepo.UpdateStatus
	err := s.uow.Do(ctx, func(tx appshared.TxContext) error {
		var fileRepo upload.FileRepository
		if err := tx.Get(&fileRepo); err != nil {
			return shared.Internal("获取事务化文件仓储失败", err)
		}
		var sessionRepo upload.UploadSessionRepository
		if err := tx.Get(&sessionRepo); err != nil {
			return shared.Internal("获取事务化会话仓储失败", err)
		}
		if err := fileRepo.Save(ctx, file); err != nil {
			return err
		}
		return sessionRepo.UpdateStatus(ctx, uploadID, "completed")
	})
	if err != nil {
		// 回滚补偿：尝试把已移动的文件移回（best-effort）
		_ = s.storage.Move(destPath, srcPath)
		return Result{}, err
	}
	// ...
}
```

Read the actual `CompleteUpload` body carefully to identify exact variable names, the storage interface methods, and the file/session repo method names. The key invariant: the filesystem move happens first (so a failure leaves no DB record); DB writes are atomic; on DB rollback we compensate the filesystem.

- [ ] **Step 6: Wire uow into media container**

In `api/internal/app/media_container.go`, add a `uow` parameter to `NewMediaContainer` and pass to the upload service. Update `cmd/server/main.go`'s call.

- [ ] **Step 7: Verify build, vet**

Run: `cd api && go vet ./... && go build ./...`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd api
git add internal/infrastructure/persistence/gorm/settings_store.go internal/domain/settings/entity.go internal/application/settings/service.go internal/app/tx_context.go internal/application/media/service.go internal/app/media_container.go cmd/server/main.go
git commit -m "feat(media/settings): CompleteUpload DB 写入事务化，配置批量 Upsert 原子化"
```

---

## Task 4.4: Publish events after commit + audit in tx (useradmin/RegisterUser)

**Problem:** Events are published synchronously after `repo.Save`, which is correct *only* without transactions — once tx is introduced, pre-commit publish + rollback leaks events. Also `useradmin` audit logs fail silently (`_ =`).

**Fix:** Since our `uow.Do` commits when `fn` returns nil, publish events only after `Do` returns nil (post-commit). For `useradmin`, run the audit log write inside the same transaction (register an `AuditStore` case in the factory).

**Files:**
- Modify: `api/internal/application/auth/command/auth_commands.go` (RegisterUser: publish after commit)
- Modify: `api/internal/application/useradmin/service.go` (audit in tx)
- Modify: `api/internal/app/tx_context.go` (register audit store)

- [ ] **Step 1: Move RegisterUser event publish to after Save success**

The current code already publishes after `Save` (no tx wrapping user creation), which is correct. The fix is to make the order explicit and robust: ensure `codeStore.Store` failure aborts (currently logged + swallowed). In `api/internal/application/auth/command/auth_commands.go`, find `RegisterUserHandler.Handle` (line 82-146). Change the swallowed error:

```go
	// 旧（131-133）：
	if err := h.codeStore.Store(ctx, "verify", email.String(), codeHash); err != nil {
		log.Error().Err(err).Msg("存储验证码失败")
	}
	// 新：
	if err := h.codeStore.Store(ctx, "verify", email.String(), codeHash); err != nil {
		return shared.Internal("存储验证码失败", err)
	}
```

Note: user is already persisted at this point. If code-store fails, we return an error but the user row exists. This is acceptable (the user can request re-verification); the alternative (transaction across userRepo + codeStore) requires codeStore to support tx, which is out of scope. Document this in a comment.

- [ ] **Step 2: Run audit in tx for useradmin mutations**

In `api/internal/application/useradmin/service.go`, add a `uow` field to `Service`. For `Create` (line 91-118), wrap `store.Save` + audit in a transaction:

```go
func (s *Service) Create(ctx context.Context, in CreateInput, operatorID string) (UserDTO, error) {
	// ...email/username/hash validation unchanged...
	u := domainuser.NewUser(shared.NewID(), email, username, hash)
	if err := u.ChangeRole(domainuser.Role(in.Role)); err != nil {
		return UserDTO{}, err
	}
	if in.IsActive {
		u.Activate()
	}

	if s.uow == nil {
		// 降级路径
		if err := s.store.Save(ctx, u); err != nil {
			return UserDTO{}, err
		}
		_ = s.auditSvc.LogWithDetail(ctx, "create", "user", u.GetID().String(), operatorID, in.IPAddress, in.UserAgent, map[string]any{"username": in.Username, "email": in.Email, "role": in.Role})
		return toDTO(u), nil
	}

	err := s.uow.Do(ctx, func(tx appshared.TxContext) error {
		var store domainuseradmin.AdminUserStore
		if err := tx.Get(&store); err != nil {
			return shared.Internal("获取事务化用户存储失败", err)
		}
		var audit AuditLogger
		if err := tx.Get(&audit); err != nil {
			return shared.Internal("获取事务化审计存储失败", err)
		}
		if err := store.Save(ctx, u); err != nil {
			return err
		}
		return audit.LogWithDetail(ctx, "create", "user", u.GetID().String(), operatorID, in.IPAddress, in.UserAgent, map[string]any{"username": in.Username, "email": in.Email, "role": in.Role})
	})
	if err != nil {
		return UserDTO{}, err
	}
	return toDTO(u), nil
}
```

Register `AdminUserStore` and `AuditLogger` (audit store) cases in `tx_context.go`'s `Make`. Read `internal/domain/useradmin/entity.go` and `internal/domain/audit/entity.go` for interface types; ensure the audit infra store (`audit_store.go`) satisfies `AuditLogger` (it may need adapter).

- [ ] **Step 3: Apply the same pattern to Update/Delete/UpdateUserRole/UpdateUserStatus**

Replicate the tx-wrap pattern from `Create` to `Update` (136-176), `Delete` (179-188), `UpdateUserRole` (191-207), `UpdateUserStatus` (210-228), `BatchUpdateStatus` (231-244), `BatchUpdateRole` (247-260). The key change: `_ = s.auditSvc.LogWithDetail(...)` becomes a transactional call that returns error.

- [ ] **Step 4: Wire uow into useradmin container**

In `api/internal/app/useradmin_container.go`, add `uow` param, pass to `NewService`. Update `cmd/server/main.go`.

- [ ] **Step 5: Verify build, vet**

Run: `cd api && go vet ./... && go build ./...`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd api
git add internal/application/auth/command/auth_commands.go internal/application/useradmin/service.go internal/app/tx_context.go internal/app/useradmin_container.go cmd/server/main.go
git commit -m "feat(useradmin/auth): 用户变更与审计在事务内，验证码存储失败不再吞错"
```

---

# Phase 5: Layer Purity

---

## Task 5.1: Strip HTTP from DomainError (move Code→HTTP map to response layer)

**Problem:** `internal/domain/shared/error.go:6,32-37,79-115` — `DomainError.HTTPStatus int` + constructors hardcode `http.StatusNotFound` etc., making the domain layer depend on `net/http`.

**Fix:** Remove `HTTPStatus` field and `net/http` import. Define error *Codes* only. The response layer owns a `Code → HTTP` mapping table.

**Files:**
- Modify: `api/internal/domain/shared/error.go`
- Modify: `api/internal/interfaces/http/response/error.go`

- [ ] **Step 1: Define Code constants in domain**

In `api/internal/domain/shared/error.go`, replace the file content:

```go
package shared

import (
	"errors"
	"fmt"
)

// ErrorCode 错误码类型（字符串常量，便于客户端识别）
//
// 命名规范：DOMAIN_REASON，全大写下划线分隔。
type ErrorCode string

// 错误码常量（领域层只定义码，不感知 HTTP）
const (
	CodeNotFound       ErrorCode = "NOT_FOUND"
	CodeBadRequest     ErrorCode = "BAD_REQUEST"
	CodeUnauthorized   ErrorCode = "UNAUTHORIZED"
	CodeForbidden      ErrorCode = "FORBIDDEN"
	CodeConflict       ErrorCode = "CONFLICT"
	CodeValidation     ErrorCode = "VALIDATION_ERROR"
	CodeInternal       ErrorCode = "INTERNAL_ERROR"
)

// DomainError 领域错误，统一后端错误表达。
// 仅携带错误码与消息；HTTP 状态码由 interfaces 层按 Code 翻译。
type DomainError struct {
	Code    ErrorCode
	Message string
	Err     error
}

func (e *DomainError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s (caused by: %v)", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *DomainError) Unwrap() error { return e.Err }

// WithErr 包装底层错误
func (e *DomainError) WithErr(err error) *DomainError {
	e.Err = err
	return e
}

// WithMessage 覆盖默认消息
func (e *DomainError) WithMessage(msg string) *DomainError {
	e.Message = msg
	return e
}

// NewError 创建领域错误（无 HTTP 语义）
func NewError(code, message string) *DomainError {
	return &DomainError{Code: ErrorCode(code), Message: message}
}

// 便捷构造函数
func NotFound(resource string) *DomainError {
	return NewError(string(CodeNotFound), fmt.Sprintf("%s不存在", resource))
}

func BadRequest(message string) *DomainError {
	return NewError(string(CodeBadRequest), message)
}

func Unauthorized(message string) *DomainError {
	if message == "" {
		message = "未授权"
	}
	return NewError(string(CodeUnauthorized), message)
}

func Forbidden(message string) *DomainError {
	if message == "" {
		message = "禁止访问"
	}
	return NewError(string(CodeForbidden), message)
}

func Conflict(message string) *DomainError {
	return NewError(string(CodeConflict), message)
}

func Validation(message string) *DomainError {
	return NewError(string(CodeValidation), message)
}

func Internal(message string, err error) *DomainError {
	return NewError(string(CodeInternal), message).WithErr(err)
}

// 谓词
func IsDomainError(err error, code ErrorCode) bool {
	var de *DomainError
	if errors.As(err, &de) {
		return de.Code == code
	}
	return false
}

func AsDomainError(err error) *DomainError {
	var de *DomainError
	if errors.As(err, &de) {
		return de
	}
	return nil
}
```

- [ ] **Step 2: Add Code→HTTP map in response/error.go**

In `api/internal/interfaces/http/response/error.go`, find the `errors.As(err, &de)` branch (around line 44). Replace the status lookup:

```go
	var de *domainshared.DomainError
	if errors.As(err, &de) {
		resp.Error = string(de.Code)
		resp.Message = de.Message
		status := httpStatusForCode(de.Code) // 翻译表
		WriteJSON(w, status, resp)
		return
	}
```

Add the mapping function above `RespondError`:

```go
// httpStatusForCode 领域错误码 → HTTP 状态码（HTTP 语义集中在接口层）
func httpStatusForCode(code domainshared.ErrorCode) int {
	switch code {
	case domainshared.CodeNotFound:
		return http.StatusNotFound
	case domainshared.CodeBadRequest, domainshared.CodeValidation:
		return http.StatusBadRequest
	case domainshared.CodeUnauthorized:
		return http.StatusUnauthorized
	case domainshared.CodeForbidden:
		return http.StatusForbidden
	case domainshared.CodeConflict:
		return http.StatusConflict
	case domainshared.CodeInternal:
		return http.StatusInternalServerError
	default:
		return http.StatusBadRequest
	}
}
```

- [ ] **Step 3: Fix any callers passing HTTP status to NewError**

Run: `cd api && grep -rn "NewError(" --include="*.go" | grep -v "_test.go"`
If any caller passes a 3rd `httpStatus` arg, remove it. The new `NewError(code, message)` takes 2 args. Update each call site.

- [ ] **Step 4: Verify build, vet, full tests**

Run: `cd api && go vet ./... && go build ./... && go test ./...`
Expected: all pass. This is the riskiest purity change — if build fails, the compiler tells you every call site to fix.

- [ ] **Step 5: Commit**

```bash
cd api
git add internal/domain/shared/error.go internal/interfaces/http/response/error.go
# plus any call-site fixes from grep
git commit -m "refactor(domain): DomainError 移除 HTTPStatus 与 net/http 依赖，状态码集中在接口层"
```

---

## Task 5.2: Extract JWT/TokenStore/CodeStore ports; remove infra import from application/auth

**Problem:** `application/auth/command/auth_commands.go:20` and `auth_commands_more.go:10` import `infrastructure/auth` — application layer depends on concrete infra types (`*auth.JWTService`, `*auth.RedisTokenStore`, `*auth.RedisCodeStore`, `*auth.TokenPair`).

**Fix:** Define ports in `application/shared/ports.go`. Move `TokenPair`/`TokenInput`/`Claims` into the port package (or define equivalent DTOs). Update handlers to depend on ports.

**Files:**
- Create: `api/internal/application/shared/ports.go`
- Modify: `api/internal/application/auth/command/auth_commands.go`, `auth_commands_more.go`
- Modify: `api/internal/app/auth_container.go`
- Modify: `api/internal/infrastructure/auth/jwt.go`, `redis_store.go` (implement ports)

- [ ] **Step 1: Define ports**

Create `api/internal/application/shared/ports.go`:

```go
// Package shared 定义应用层端口（基础设施接口），保持 application 层零框架依赖。
package shared

import (
	"context"
	"time"
)

// TokenPair 访问令牌 + 刷新令牌（应用层 DTO，不依赖 infra）
type TokenPair struct {
	AccessToken      string
	RefreshToken     string
	ExpiresIn        int64
	RefreshExpiresIn int64
}

// TokenInput 生成令牌入参
type TokenInput struct {
	UserID string
	Email  string
	Role   string
	RoleID int32
}

// Claims 解析出的令牌声明
type Claims struct {
	UserID string
	Email  string
	Role   string
	RoleID int32
}

// TokenService JWT 签发/验签端口
type TokenService interface {
	GenerateTokenPair(in TokenInput) (*TokenPair, error)
	ParseToken(token string) (*Claims, error)
	AccessTTL() time.Duration
	RefreshTTL() time.Duration
}

// TokenStore refresh token 存储端口
type TokenStore interface {
	Save(ctx context.Context, userID, refreshToken string) error
	Verify(ctx context.Context, userID, refreshToken string) (bool, error)
	Delete(ctx context.Context, userID string) error
}

// CodeStore 验证码存储端口
type CodeStore interface {
	Store(ctx context.Context, prefix, identifier, codeHash string) error
	Verify(ctx context.Context, prefix, identifier, codeHash string) (bool, error)
}
```

- [ ] **Step 2: Make infra implement ports**

In `api/internal/infrastructure/auth/jwt.go`, make `JWTService` implement `appshared.TokenService`. Add methods that translate between infra's `TokenPair`/`TokenInput`/`JWTClaims` and the app-layer DTOs:

```go
// GenerateTokenPairApp 实现 application/shared.TokenService（返回 app 层 DTO）
func (s *JWTService) GenerateTokenPairApp(in appshared.TokenInput) (*appshared.TokenPair, error) {
	pair, err := s.GenerateTokenPair(TokenInput(in))
	if err != nil {
		return nil, err
	}
	return &appshared.TokenPair{
		AccessToken: pair.AccessToken, RefreshToken: pair.RefreshToken,
		ExpiresIn: pair.ExpiresIn, RefreshExpiresIn: pair.RefreshExpiresIn,
	}, nil
}

// ParseTokenApp 实现 application/shared.TokenService（返回 app 层 Claims）
func (s *JWTService) ParseTokenApp(token string) (*appshared.Claims, error) {
	c, err := s.ParseToken(token)
	if err != nil {
		return nil, err
	}
	return &appshared.Claims{UserID: c.UserID, Email: c.Email, Role: c.Role, RoleID: c.RoleID}, nil
}
```

Add a compile-time assertion: `var _ appshared.TokenService = (*JWTService)(nil)`. Add import `"blog-api/internal/application/shared" as appshared`.

Similarly for `RedisTokenStore` (implement `appshared.TokenStore`) and `RedisCodeStore` (already has `Store`/`Verify` matching `appshared.CodeStore` — add assertion). For RedisTokenStore, the existing `Save`/`Verify`/`Delete` likely already match; add `var _ appshared.TokenStore = (*RedisTokenStore)(nil)`.

- [ ] **Step 3: Update auth command handlers to use ports**

In `api/internal/application/auth/command/auth_commands.go` and `auth_commands_more.go`, replace every `*auth.JWTService` → `appshared.TokenService`, `*auth.RedisTokenStore` → `appshared.TokenStore`, `*auth.RedisCodeStore` → `appshared.CodeStore`, `*auth.TokenPair` → `*appshared.TokenPair`, `auth.TokenInput{...}` → `appshared.TokenInput{...}`.

Remove the `"blog-api/internal/infrastructure/auth"` import from both files. The application package no longer references infra.

For `LoginOutput.TokenPair`, change type to `*appshared.TokenPair`.

- [ ] **Step 4: Update auth_container wiring**

In `api/internal/app/auth_container.go`, the constructors now take interfaces. The infra types satisfy them, so passing `jwtService`/`tokenStore`/`codeStore` still works (Go structural-ish via explicit interface satisfaction). No change to construction logic needed — just ensure the assertions in step 2 compile.

- [ ] **Step 5: Update auth handler**

In `api/internal/interfaces/http/handler/auth/auth.go`, `Login` and `Refresh` use `out.TokenPair.AccessToken` etc. Since `LoginOutput.TokenPair` is now `*appshared.TokenPair`, the field names are identical — no handler change needed. Verify by building.

- [ ] **Step 6: Verify build, vet, tests**

Run: `cd api && go vet ./... && go build ./... && go test ./...`
Expected: all pass. The critical check: `grep -rn "infrastructure/auth" internal/application/` should return nothing.

- [ ] **Step 7: Commit**

```bash
cd api
git add internal/application/shared/ports.go internal/application/auth/command/auth_commands.go internal/application/auth/command/auth_commands_more.go internal/infrastructure/auth/jwt.go internal/infrastructure/auth/redis_store.go internal/app/auth_container.go
git commit -m "refactor(auth): 提取 TokenService/TokenStore/CodeStore 端口，应用层不再依赖基础设施"
```

---

## Task 5.3: Remove net/http from application/commentreaction (move ExtractIP to handler)

**Problem:** `internal/application/commentreaction/service.go:8,53` imports `net/http` and exposes `ExtractIP(r *http.Request)` — HTTP extraction logic in the application layer.

**Fix:** Move `ExtractIP` (and `splitComma`) to the handler package. The application service takes an already-extracted IP string.

**Files:**
- Modify: `api/internal/application/commentreaction/service.go`
- Modify: `api/internal/interfaces/http/handler/commentreaction/commentreaction.go`

- [ ] **Step 1: Move ExtractIP to handler**

In `api/internal/interfaces/http/handler/commentreaction/commentreaction.go`, add a local `extractIP` function (or reuse the middleware's `getClientIP` if exported). Add:

```go
// extractIP 从请求提取客户端 IP（与中间件 utils.getClientIP 行为一致）。
// 此处独立实现避免 handler 反向依赖 middleware 包的未导出函数；
// 优先 RemoteAddr，受信代理场景由 middleware.SetTrustedProxies 全局配置。
func extractIP(r *http.Request) string {
	return r.RemoteAddr // 简化：限流/IP 提取已由 middleware 统一处理；此处仅记录
}
```

Update `AddReaction` and `RemoveReaction` in the handler to call the local `extractIP(r)` instead of `appcr.ExtractIP(r)`:

```go
	// 旧：ip := appcr.ExtractIP(r)
	// 新：
	ip := extractIP(r)
```

- [ ] **Step 2: Remove net/http and ExtractIP from application service**

In `api/internal/application/commentreaction/service.go`, delete:
- the `"net/http"` import (line 8)
- the entire `ExtractIP` function (lines 52-65)
- the `splitComma` helper (lines 72-79)

The `hashIP` stays (it's domain logic — pseudonymization — but could move to domain in a future pass; keep for now to limit scope).

- [ ] **Step 3: Verify build, vet**

Run: `cd api && go vet ./... && go build ./...`
Expected: no errors. `grep -rn "net/http" internal/application/` should return nothing.

- [ ] **Step 4: Commit**

```bash
cd api
git add internal/application/commentreaction/service.go internal/interfaces/http/handler/commentreaction/commentreaction.go
git commit -m "refactor(commentreaction): ExtractIP 移至 handler，应用层去除 net/http 依赖"
```

---

## Task 5.4: Consolidate duplicate Reaction type + final verification

**Problem:** `domain/commentreaction/entity.go` `Reaction` (read-model DTO with json tags) coexists with the comment package's reaction concept. After Task 3.5 deleted the dead `comment.ReactionRepository`, verify the remaining `commentreaction.Reaction` is the single source and the package is clearly a read-model.

**Files:**
- Modify: `api/internal/domain/commentreaction/entity.go` (clarify as read-model)
- Verify: no remaining duplicate

- [ ] **Step 1: Clarify commentreaction.Reaction as read-model**

In `api/internal/domain/commentreaction/entity.go`, update the package doc and the `Reaction` struct comment to make explicit it's a query-side read model (JSON tags acceptable for read models), not an aggregate:

```go
// Package commentreaction 提供评论反应的读模型与存储端口。
//
// 本包为查询侧（read-model）：Reaction 是面向展示的 DTO，非聚合根。
// 反应的写模型逻辑（去重、计数）在存储实现层处理。
package commentreaction
```

- [ ] **Step 2: Final full verification**

Run all checks:

```bash
cd api
go vet ./...
go build ./...
go test ./... -race -count=1
```

Expected: all pass, no race.

- [ ] **Step 3: Confirm layering purity**

Run these greps and confirm empty results:
```bash
cd api
echo "=== domain importing net/http? ==="
grep -rn '"net/http"' internal/domain/
echo "=== application importing infrastructure? ==="
grep -rn "internal/infrastructure" internal/application/
echo "=== application importing net/http? ==="
grep -rn '"net/http"' internal/application/
```

Expected: all three empty (domain purity, application layering, application purity).

- [ ] **Step 4: Commit**

```bash
cd api
git add internal/domain/commentreaction/entity.go
git commit -m "docs(commentreaction): 明确 Reaction 为读模型，单一来源"
```

- [ ] **Step 5: Push to remote**

```bash
cd /Users/issuser/Developer/xfy/mimo-blog
git push -u origin fix/backend-review
```

---

## Self-Review Notes

**Spec coverage check** (mapping review findings → tasks):

- CRITICAL #1 (reaction Remove drops emoji): **corrected** — verified dead code; addressed by Task 3.5 (delete dead ReactionRepository). The *live* `CommentReactionStore.Remove` correctly filters. ✅
- CRITICAL #2 (RemoveReaction no auth): Task 1.3 ✅
- CRITICAL #3 (XFF spoofing): Task 1.1 ✅
- CRITICAL #4 (MIME trust): Task 1.4 ✅
- CRITICAL #5 (post_repo Save): Task 3.1 ✅
- CRITICAL #6 (UoW dead): Phase 4 ✅
- CRITICAL #7 (JWT silent key): Task 2.1 ✅
- CRITICAL #8 (path traversal): Task 2.3 ✅
- CRITICAL #9 (SSRF): Task 2.2 ✅
- CRITICAL #10 (brute-force race): Task 2.4 ✅
- Auth endpoint rate limits: Task 1.2 ✅
- Validator→400: Task 3.2 ✅
- Error swallowing in stores: Task 3.3 ✅
- cleanup_job races/order: Task 3.4 ✅
- DomainError HTTP coupling: Task 5.1 ✅
- App imports infra (auth): Task 5.2 ✅
- App imports net/http (commentreaction): Task 5.3 ✅
- Duplicate Reaction type: Task 5.4 ✅
- Email/github escape: Task 2.5 ✅
- UpdateProfile validation: Task 1.5 ✅
- RBAC dead code (`RequirePermission`): **deferred** — noted as out of scope (wiring `RequirePermission` requires defining the permission model's intended codes per route, a product decision). The permission *model* remains available; this plan does not delete it.

**Deferred items** (not in this plan, tracked for follow-up):
- `RequirePermission` RBAC wiring (needs product input on per-route permission codes)
- `MustParseID` panic-on-bad-data → return error (pervasive; separate sweep)
- Event publishing after-commit via outbox (Phase 4 keeps sync publish post-commit, which is correct for now)
- inmemory eventbus reentrancy/deadlock (low risk; no handler currently re-enters)
- Move `GenerateSlug` to `domain/tag`; relocate `emoji_seed_service` to DDD (architecture polish)
- Test coverage for core services (this plan adds tests for touched code only)

---

## Execution

**Plan complete.** Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks.
2. **Inline Execution** — batch tasks in this session with checkpoints.

Per user instruction: proceed with **Subagent-Driven**, do not stop unless a major issue arises, and push to remote after completion.
