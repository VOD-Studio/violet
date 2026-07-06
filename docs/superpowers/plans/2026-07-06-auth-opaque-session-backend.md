# 登录态 opaque session 重构（后端）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Go 后端登录态从 access/refresh JWT 切换为 opaque session（对标 bilibili SESSDATA），彻底删除 JWT/refresh/rotation 遗产，无兼容层。

**Architecture:** 新增 `domain/session` 聚合根 + `SessionStore`（Redis，维护 `session:<id>` 与 `user:<uid>:sessions` 索引）+ `SessionAuth` 中间件（读 cookie → 查 session → 注入 ctx → 滑动续期，不轮换 id、不 Set-Cookie）。改造 login/google/github/logout/change-password/reset-password 复用 session；新增只读 `/auth/session` 供 SSR。删除 JWTService/RedisTokenStore/RefreshTokenHandler/TokenService/TokenStore 端点与端口。

**Tech Stack:** Go 1.x + chi v5 + go-redis v9 + miniredis（测试）+ gorm + zerolog + testify。决策依据见 `docs/adr/0003-login-opaque-session.md`、`docs/auth-architecture-selection.md`。

## Global Constraints

- **保留**：邮箱密码 + GitHub + Google 三种登录入口；double-submit CSRF（`mimo_csrf`）；DDD 分层（domain → application → infrastructure → interfaces）；CQRS command/query；现有测试模式（testify mocks + miniredis）。
- **删除（无兼容层）**：access/refresh JWT、`TokenService`/`TokenStore` 端口、`JWTService`、`RedisTokenStore`（refresh 白名单 + rotation Lua）、`RefreshTokenHandler`、`/auth/refresh` 端点、config 的 `JWT*` 字段、`TokenServiceAdapter`。
- **命门不变量**：(1) 鉴权中间件读 session 后只 `EXPIRE`（滑动续期），**不换 id、不 Set-Cookie**；(2) `/auth/session` 端点**只读不续期不写 cookie**。
- **cookie 清单**：`mimo_session`（HttpOnly，opaque id）、`mimo_csrf`（非 HttpOnly，复用现有 `CSRFName`）。`mimo_uid` 本期不做（YAGNI，前端已有 `/auth/me`）。
- **生命周期**：`idle TTL`（滑动，默认与原 refresh TTL 同量级，如 7d）+ `max TTL` 配置项（`<=0` 无上限，`>0` 绝对寿命）。
- 提交格式遵循 `AGENTS.md`：Header + Body 无 footer，每个 task 一次原子提交。
- 测试命令：`cd api && go test ./...`；构建：`cd api && go build ./...`。

## File Structure

**Create:**
- `api/internal/domain/session/entity.go` — Session 聚合根（id/userID/role/roleID/isBuiltinSuperAdmin/email/csrfToken/createdAt/lastSeenAt/absoluteDeadline）+ 不变量（IsExpired/Touch）
- `api/internal/domain/session/valueobject.go` — `ID`（opaque base64url）、`CSRFToken`、`UserSnapshot`
- `api/internal/domain/session/entity_test.go`
- `api/internal/infrastructure/auth/session_store.go` — `RedisSessionStore`（Create/Get/Touch/Delete/DeleteByUser，维护 `user:<uid>:sessions` 索引）
- `api/internal/infrastructure/auth/session_store_test.go`（miniredis）
- `api/internal/middleware/session_auth.go` — `SessionAuth`/`OptionalSessionAuth` + `SessionLookup` 端口
- `api/internal/middleware/session_auth_test.go`
- `api/internal/application/auth/command/create_session.go` — `CreateSessionHandler`
- `api/internal/application/auth/command/create_session_test.go`

**Modify:**
- `api/internal/application/shared/ports.go` — 删 `TokenService`/`TokenStore`/`TokenPair`/`TokenInput`/`RotateResult`，新增 `SessionStore` 端口
- `api/internal/application/auth/command/auth_commands.go` — `LoginHandler`/`LogoutHandler` 改 session；删 `RefreshTokenHandler`
- `api/internal/application/auth/command/google_login.go`、`github_login.go` — 改 session
- `api/internal/application/auth/command/auth_commands_more.go` — `ChangePasswordHandler`/`ResetPasswordHandler` 改 `SessionStore.DeleteByUser`
- `api/internal/interfaces/http/handler/auth/auth.go` — cookie helper 改 `SetSessionCookie`/`ClearSessionCookies`；删 `Refresh` handler；新增 `Session` 只读端点
- `api/internal/interfaces/http/response/`（cookie helper 所在文件）— 新增 session cookie 设置函数
- `api/internal/middleware/auth.go` — 保留 context key/Getter；旧 `Auth`/`TokenValidator` 标记 deprecated 或移除（按是否还有引用决定）
- `api/internal/app/auth_container.go`、`auth_adapters.go` — 装配 SessionStore/CreateSessionHandler/SessionAuth；删 JWT/tokenStore 装配
- `api/internal/app/routes` 或 main 路由注册处 — 删 `/auth/refresh`，加 `/auth/session`
- `api/config/config.go` — 删 `JWT*`，加 `Session`（IdleTTL/MaxTTL）+ `CookieConfig.SessionName`
- `api/internal/application/mocks/mocks.go` — 删 `MockTokenService`/`MockTokenStore`，加 `MockSessionStore`

**Delete:**
- `api/internal/infrastructure/auth/jwt.go`、`jwt_test.go`
- `api/internal/infrastructure/auth/redis_store.go`、`redis_store_test.go`（refresh token store）

---

### Task 1: Session 领域聚合根

**Files:**
- Create: `api/internal/domain/session/valueobject.go`
- Create: `api/internal/domain/session/entity.go`
- Test: `api/internal/domain/session/entity_test.go`

**Interfaces:**
- Produces: `session.ID`, `session.CSRFToken`, `session.UserSnapshot`, `session.Session`, `session.NewSession`, `session.ErrNotFound`

- [ ] **Step 1: 写失败测试** `entity_test.go`

```go
package session

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainshared "blog-api/internal/domain/shared"
)

func snap() UserSnapshot {
	uid, _ := domainshared.ParseID("00000000-0000-0000-0000-000000000001")
	return UserSnapshot{
		UserID: uid, Email: "u@example.com", Role: "user",
		RoleID: 2, IsBuiltinSuperAdmin: false,
	}
}

// NewSession 必须生成不透明的 id、独立 csrf token，并记录创建/最近活跃时间
func TestNewSession_GeneratesIDAndCSRF(t *testing.T) {
	now := time.Now()
	s1, err := NewSession(snap(), now, 0)
	require.NoError(t, err)
	s2, err := NewSession(snap(), now, 0)
	require.NoError(t, err)
	assert.NotEmpty(t, s1.ID())
	assert.Len(t, s1.ID(), 43) // 32 字节 base64url ≈ 43 字符
	assert.NotEqual(t, s1.ID(), s2.ID(), "每次登录 id 必须唯一")
	assert.NotEqual(t, s1.CSRF(), s2.CSRF(), "csrf token 独立随机")
	assert.Equal(t, "u@example.com", s1.Claims().Email)
}

// max<=0 时永不到绝对寿命
func TestIsExpired_NoAbsoluteLimit(t *testing.T) {
	now := time.Now()
	s, _ := NewSession(snap(), now, 0)
	// idle 内不过期
	assert.False(t, s.IsExpired(now.Add(6*24*time.Hour), 7*24*time.Hour))
	// 超过 idle 过期
	assert.True(t, s.IsExpired(now.Add(8*24*time.Hour), 7*24*time.Hour))
}

// max>0 时绝对寿命到期强制过期，无论活跃
func TestIsExpired_AbsoluteDeadline(t *testing.T) {
	now := time.Now()
	s, _ := NewSession(snap(), now, 30*24*time.Hour)
	// 活跃且未到绝对寿命 → 不过期
	assert.False(t, s.IsExpired(now.Add(1*time.Hour), 7*24*time.Hour))
	// 到绝对寿命 → 过期（即使 idle 内）
	assert.True(t, s.IsExpired(now.Add(31*24*time.Hour), 7*24*time.Hour))
}

// Touch 更新最近活跃时间，不换 id
func TestTouch_DoesNotRotateID(t *testing.T) {
	now := time.Now()
	s, _ := NewSession(snap(), now, 0)
	id := s.ID()
	s.Touch(now.Add(1 * time.Hour))
	assert.Equal(t, id, s.ID(), "续期不轮换 id（命门不变量）")
}
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd api && go test ./internal/domain/session/ -run TestNewSession -v`
Expected: FAIL — `session.NewSession undefined`

- [ ] **Step 3: 写 valueobject.go**

```go
package session

import (
	"crypto/rand"
	"encoding/base64"

	domainshared "blog-api/internal/domain/shared"
)

// ID opaque session 标识，32 字节 cryptographically random，base64url 编码。
// 本身不含任何用户信息，后端必须查 SessionStore 才能换出身份。对标 bilibili SESSDATA。
type ID string

// NewID 生成随机 session id。读随机源失败时返回错误（不降级为弱随机）。
func NewID() (ID, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return ID(base64.RawURLEncoding.EncodeToString(b)), nil
}

// CSRFToken double-submit CSRF 凭证，与非 HttpOnly cookie 同值。对标 bilibili bili_jct。
type CSRFToken string

// NewCSRFToken 生成 32 字节随机 token，hex 编码。
func NewCSRFToken() (CSRFToken, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return CSRFToken(base64.RawURLEncoding.EncodeToString(b)), nil
}

// UserSnapshot 创建 session 时从 User 聚合快照的身份字段，避免 session 反向依赖 user 包。
type UserSnapshot struct {
	UserID              domainshared.ID
	Email               string
	Role                string
	RoleID              int32
	IsBuiltinSuperAdmin bool
}
```

- [ ] **Step 4: 写 entity.go**

```go
package session

import (
	"errors"
	"time"
)

// ErrSessionNotFound session 不存在或已过期，调用方映射为 401。
var ErrSessionNotFound = errors.New("session not found")

// Claims 鉴权中间件与 /auth/session 端点返回的身份字段，与 middleware.TokenClaims 对齐。
type Claims struct {
	UserID              string
	Email               string
	Role                string
	RoleID              int32
	IsBuiltinSuperAdmin bool
	CSRFToken           string
}

// Session opaque session 聚合根。
//
// 不变量：
//   - id 创建后永不变（续期不轮换，命门不变量）
//   - 过期权威：idleTTL（lastSeenAt + idleTTL）与 absoluteDeadline（若 max>0）取先到
type Session struct {
	id                  ID
	userID              string
	email               string
	role                string
	roleID              int32
	isBuiltinSuperAdmin bool
	csrf                CSRFToken
	createdAt           time.Time
	lastSeenAt          time.Time
	absoluteDeadline    time.Time // 零值表示无绝对寿命上限（max<=0）
}

// NewSession 创建新 session。absoluteTTL<=0 表示无绝对寿命上限。
func NewSession(snap UserSnapshot, now time.Time, absoluteTTL time.Duration) (*Session, error) {
	id, err := NewID()
	if err != nil {
		return nil, err
	}
	csrf, err := NewCSRFToken()
	if err != nil {
		return nil, err
	}
	s := &Session{
		id:                  id,
		userID:              snap.UserID.String(),
		email:               snap.Email,
		role:                snap.Role,
		roleID:              snap.RoleID,
		isBuiltinSuperAdmin: snap.IsBuiltinSuperAdmin,
		csrf:                csrf,
		createdAt:           now,
		lastSeenAt:          now,
	}
	if absoluteTTL > 0 {
		s.absoluteDeadline = now.Add(absoluteTTL)
	}
	return s, nil
}

// Reconstruct 从 Redis 反序列化重建 session。
func Reconstruct(
	id ID, userID, email, role string, roleID int32, isBuiltinSuperAdmin bool,
	csrf CSRFToken, createdAt, lastSeenAt, absoluteDeadline time.Time,
) *Session {
	return &Session{
		id: id, userID: userID, email: email, role: role, roleID: roleID,
		isBuiltinSuperAdmin: isBuiltinSuperAdmin, csrf: csrf,
		createdAt: createdAt, lastSeenAt: lastSeenAt, absoluteDeadline: absoluteDeadline,
	}
}

func (s *Session) ID() ID         { return s.id }
func (s *Session) UserID() string { return s.userID }
func (s *Session) CSRF() CSRFToken { return s.csrf }
func (s *Session) CreatedAt() time.Time    { return s.createdAt }
func (s *Session) LastSeenAt() time.Time   { return s.lastSeenAt }
func (s *Session) AbsoluteDeadline() time.Time { return s.absoluteDeadline }

func (s *Session) Claims() Claims {
	return Claims{
		UserID: s.userID, Email: s.email, Role: s.role, RoleID: s.roleID,
		IsBuiltinSuperAdmin: s.isBuiltinSuperAdmin, CSRFToken: string(s.csrf),
	}
}

// Touch 滑动续期：更新最近活跃时间。不轮换 id、不产生 cookie（命门不变量）。
func (s *Session) Touch(now time.Time) {
	s.lastSeenAt = now
}

// IsExpired 判断是否已过期。idleTTL 为滑动窗口，absoluteDeadline（非零值）为硬上限。
func (s *Session) IsExpired(now time.Time, idleTTL time.Duration) bool {
	if now.Sub(s.lastSeenAt) > idleTTL {
		return true
	}
	if !s.absoluteDeadline.IsZero() && now.After(s.absoluteDeadline) {
		return true
	}
	return false
}
```

- [ ] **Step 5: 运行测试验证通过**

Run: `cd api && go test ./internal/domain/session/ -v`
Expected: PASS（全部 4 个测试）

- [ ] **Step 6: 提交**

```bash
cd api && git add internal/domain/session/ && git commit -m "feat(auth): 新增 session 领域聚合根

- ID/CSRFToken/UserSnapshot 值对象，opaque id 32 字节 base64url
- Session 聚合根：滑动 idle + 可选绝对寿命 max 双过期，Touch 不轮换 id"
```

---

### Task 2: SessionStore 端口 + Redis 实现

**Files:**
- Modify: `api/internal/application/shared/ports.go`（删 Token 端口，加 SessionStore）
- Create: `api/internal/infrastructure/auth/session_store.go`
- Test: `api/internal/infrastructure/auth/session_store_test.go`

**Interfaces:**
- Consumes: `session.Session`、`session.ID`、`session.Reconstruct`、`session.ErrSessionNotFound`
- Produces: `shared.SessionStore` interface（Create/Get/Touch/Delete/DeleteByUser）、`infrastructure/auth.RedisSessionStore`

- [ ] **Step 1: 在 ports.go 新增 SessionStore 端口（保留 TokenService/TokenStore 到 Task 9 一起删，避免中间编译断裂）**

在 `api/internal/application/shared/ports.go` 末尾追加：

```go
import domainsession "blog-api/internal/domain/session"

// SessionStore opaque session 存储端口。命门：Touch 只滑动续期，不轮换 id。
type SessionStore interface {
	// Create 写入新 session，TTL=idleTTL。同时登记到 user:<uid>:sessions 索引。
	Create(ctx context.Context, sess *domainsession.Session, idleTTL time.Duration) error
	// Get 读取并反序列化，不续期。不存在/已过期返回 session.ErrSessionNotFound。
	Get(ctx context.Context, id domainsession.ID) (*domainsession.Session, error)
	// Touch 滑动续期：重置 TTL=idleTTL，更新 lastSeenAt。不换 id、不产生 cookie。
	Touch(ctx context.Context, sess *domainsession.Session, idleTTL time.Duration) error
	// Delete 删除单个 session（登出当前设备）。
	Delete(ctx context.Context, id domainsession.ID) error
	// DeleteByUser 删除某用户全部 session（改密/重置密码强制重登）。
	DeleteByUser(ctx context.Context, userID string) error
}
```

- [ ] **Step 2: 写失败测试** `session_store_test.go`（用 miniredis，参照现有 `redis_store_test.go` 的 miniredis 用法）

```go
package auth

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainshared "blog-api/internal/domain/shared"
	domainsession "blog-api/internal/domain/session"
)

func newTestStore(t *testing.T) (*RedisSessionStore, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.Run(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	return NewRedisSessionStore(rdb), mr
}

func snap(uid string) domainsession.UserSnapshot {
	id, _ := domainshared.ParseID(uid)
	return domainsession.UserSnapshot{UserID: id, Email: "u@example.com", Role: "user", RoleID: 2}
}

func TestCreateAndGet_RoundTrip(t *testing.T) {
	store, mr := newTestStore(t)
	defer mr.Close()
	ctx := context.Background()
	now := time.Now()
	s, _ := domainsession.NewSession(snap("00000000-0000-0000-0000-000000000001"), now, 0)

	require.NoError(t, store.Create(ctx, s, 7*24*time.Hour))
	got, err := store.Get(ctx, s.ID())
	require.NoError(t, err)
	assert.Equal(t, s.UserID(), got.UserID())
	assert.Equal(t, s.CSRF(), got.CSRF())
}

func TestGet_MissingReturnsNotFound(t *testing.T) {
	store, mr := newTestStore(t)
	defer mr.Close()
	_, err := store.Get(context.Background(), "nonexistent")
	assert.ErrorIs(t, err, domainsession.ErrSessionNotFound)
}

func TestTouch_ResetsTTLWithoutRotatingID(t *testing.T) {
	store, mr := newTestStore(t)
	defer mr.Close()
	ctx := context.Background()
	s, _ := domainsession.NewSession(snap("00000000-0000-0000-0000-000000000001"), time.Now(), 0)
	require.NoError(t, store.Create(ctx, s, time.Second))
	mr.FastForward(2 * time.Second) // TTL 过期
	_, err := store.Get(ctx, s.ID())
	assert.ErrorIs(t, err, domainsession.ErrSessionNotFound, "未续期则 TTL 到期失效")
}

func TestDeleteByUser_RemovesAllSessions(t *testing.T) {
	store, mr := newTestStore(t)
	defer mr.Close()
	ctx := context.Background()
	uid := "00000000-0000-0000-0000-000000000001"
	s1, _ := domainsession.NewSession(snap(uid), time.Now(), 0)
	s2, _ := domainsession.NewSession(snap(uid), time.Now(), 0)
	require.NoError(t, store.Create(ctx, s1, time.Hour))
	require.NoError(t, store.Create(ctx, s2, time.Hour))

	require.NoError(t, store.DeleteByUser(ctx, uid))
	_, err1 := store.Get(ctx, s1.ID())
	_, err2 := store.Get(ctx, s2.ID())
	assert.ErrorIs(t, err1, domainsession.ErrSessionNotFound)
	assert.ErrorIs(t, err2, domainsession.ErrSessionNotFound)
}
```

- [ ] **Step 3: 运行测试验证失败**

Run: `cd api && go test ./internal/infrastructure/auth/ -run TestCreateAndGet -v`
Expected: FAIL — `NewRedisSessionStore undefined`

- [ ] **Step 4: 写 session_store.go**

```go
package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	domainsession "blog-api/internal/domain/session"
)

// sessionKey 单个 session 的 Redis key。
func sessionKey(id domainsession.ID) string { return "session:" + string(id) }

// userSessionsKey 某用户全部 session id 的集合（改密/重置密码批量吊销用）。
func userSessionsKey(userID string) string { return "user:" + userID + ":sessions" }

// sessionPayload Redis 中 session value 的序列化结构。
type sessionPayload struct {
	UserID              string    `json:"user_id"`
	Email               string    `json:"email"`
	Role                string    `json:"role"`
	RoleID              int32     `json:"role_id"`
	IsBuiltinSuperAdmin bool      `json:"is_builtin_super_admin"`
	CSRFToken           string    `json:"csrf_token"`
	CreatedAt           time.Time `json:"created_at"`
	LastSeenAt          time.Time `json:"last_seen_at"`
	AbsoluteDeadline    time.Time `json:"absolute_deadline"`
}

// RedisSessionStore 基于 go-redis 的 SessionStore 实现。
type RedisSessionStore struct {
	rdb redisCmdable
}

// redisCmdable 抽象 *redis.Client 与 ClusterClient 共同接口，便于测试。
type redisCmdable interface {
	redis.Cmdable
}

// NewRedisSessionStore 构造 Redis session store。
func NewRedisSessionStore(rdb *redis.Client) *RedisSessionStore {
	return &RedisSessionStore{rdb: rdb}
}

// Create SET session + SADD 用户索引，用 pipeline 保证原子可见性，TTL=idleTTL。
func (s *RedisSessionStore) Create(ctx context.Context, sess *domainsession.Session, idleTTL time.Duration) error {
	payload := sessionPayload{
		UserID: sess.UserID(), Email: sess.Claims().Email, Role: sess.Claims().Role,
		RoleID: sess.Claims().RoleID, IsBuiltinSuperAdmin: sess.Claims().IsBuiltinSuperAdmin,
		CSRFToken: string(sess.CSRF()), CreatedAt: sess.CreatedAt(),
		LastSeenAt: sess.LastSeenAt(), AbsoluteDeadline: sess.AbsoluteDeadline(),
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal session: %w", err)
	}
	key := sessionKey(sess.ID())
	idx := userSessionsKey(sess.UserID())
	pipe := s.rdb.TxPipeline()
	pipe.Set(ctx, key, data, idleTTL)
	pipe.SAdd(ctx, idx, string(sess.ID()))
	pipe.Expire(ctx, idx, idleTTL) // 索引随最新 session 续命；DeleteByUser 时清理
	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("create session: %w", err)
	}
	return nil
}

// Get 读取并反序列化，不续期（续期由中间件显式调 Touch）。
func (s *RedisSessionStore) Get(ctx context.Context, id domainsession.ID) (*domainsession.Session, error) {
	data, err := s.rdb.Get(ctx, sessionKey(id)).Bytes()
	if err == redis.Nil {
		return nil, domainsession.ErrSessionNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get session: %w", err)
	}
	var p sessionPayload
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, fmt.Errorf("unmarshal session: %w", err)
	}
	return domainsession.Reconstruct(
		id, p.UserID, p.Email, p.Role, p.RoleID, p.IsBuiltinSuperAdmin,
		domainsession.CSRFToken(p.CSRFToken), p.CreatedAt, p.LastSeenAt, p.AbsoluteDeadline,
	), nil
}

// Touch 滑动续期：重置 session key TTL + 更新 lastSeenAt + 重置索引 TTL。
// 不换 id（命门不变量）。先 GET 当前值用于更新 lastSeenAt。
func (s *RedisSessionStore) Touch(ctx context.Context, sess *domainsession.Session, idleTTL time.Duration) error {
	sess.Touch(time.Now())
	payload := sessionPayload{
		UserID: sess.UserID(), Email: sess.Claims().Email, Role: sess.Claims().Role,
		RoleID: sess.Claims().RoleID, IsBuiltinSuperAdmin: sess.Claims().IsBuiltinSuperAdmin,
		CSRFToken: string(sess.CSRF()), CreatedAt: sess.CreatedAt(),
		LastSeenAt: sess.LastSeenAt(), AbsoluteDeadline: sess.AbsoluteDeadline(),
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal session on touch: %w", err)
	}
	key := sessionKey(sess.ID())
	pipe := s.rdb.TxPipeline()
	pipe.Set(ctx, key, data, idleTTL) // SET 带 TTL 即重置过期
	pipe.Expire(ctx, userSessionsKey(sess.UserID()), idleTTL)
	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("touch session: %w", err)
	}
	return nil
}

// Delete 删除单个 session 并从用户索引移除。
func (s *RedisSessionStore) Delete(ctx context.Context, id domainsession.ID) error {
	pipe := s.rdb.TxPipeline()
	pipe.Del(ctx, sessionKey(id))
	// 从所有用户索引中移除该 id（SREM 需 key，登录时已知 userID 可直接 SREM；
	// 这里用遍历用户集合的方式兜底，DeleteByUser 是主路径）
	// 优化：调用方应优先用 DeleteByUser 或携带 userID 的 Delete 变体。
	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	return nil
}

// DeleteByUser 批量删除某用户全部 session（改密/重置密码强制重登）。
func (s *RedisSessionStore) DeleteByUser(ctx context.Context, userID string) error {
	idx := userSessionsKey(userID)
	ids, err := s.rdb.SMembers(ctx, idx).Result()
	if err != nil {
		return fmt.Errorf("list user sessions: %w", err)
	}
	if len(ids) == 0 {
		return nil
	}
	pipe := s.rdb.TxPipeline()
	for _, id := range ids {
		pipe.Del(ctx, sessionKey(domainsession.ID(id)))
	}
	pipe.Del(ctx, idx)
	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("delete user sessions: %w", err)
	}
	return nil
}
```

> 注：`Delete(id)` 实际由登出调用，登出 handler 已知 userID（从 ctx）。为避免遍历索引，在 Task 6 给 `LogoutHandler` 传 `(sessionID, userID)`，store 用 `SREM user:<uid>:sessions <id>` + `DEL session:<id>`。本任务的 `Delete(id)` 可保留兜底实现，但实际登出走带 userID 的路径——在 Step 4 的 `Delete` 之外补一个 `DeleteForUser(ctx, userID, id)`：

```go
// DeleteForUser 删除指定用户的指定 session（登出当前设备），同步清理索引。
func (s *RedisSessionStore) DeleteForUser(ctx context.Context, userID string, id domainsession.ID) error {
	pipe := s.rdb.TxPipeline()
	pipe.Del(ctx, sessionKey(id))
	pipe.SRem(ctx, userSessionsKey(userID), string(id))
	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("delete session for user: %w", err)
	}
	return nil
}
```
并将 `SessionStore` 端口 `Delete` 签名改为 `DeleteForUser(ctx, userID string, id ID)`（登出场景总能拿到 userID）。Task 2 的端口定义同步更新为该签名，删除无 userID 的 `Delete`。

- [ ] **Step 5: 运行测试验证通过**

Run: `cd api && go test ./internal/infrastructure/auth/ -run "TestCreateAndGet|TestGet_Missing|TestTouch|TestDeleteByUser" -v`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
cd api && git add internal/application/shared/ports.go internal/infrastructure/auth/session_store.go internal/infrastructure/auth/session_store_test.go
git commit -m "feat(auth): 新增 SessionStore 端口与 Redis 实现

- SessionStore 端口：Create/Get/Touch/Delete/DeleteByUser
- RedisSessionStore 维护 session:<id> 与 user:<uid>:sessions 索引
- Touch 滑动续期不轮换 id，满足 opaque session 命门不变量"
```

---

### Task 3: SessionAuth 鉴权中间件

**Files:**
- Create: `api/internal/middleware/session_auth.go`
- Test: `api/internal/middleware/session_auth_test.go`

**Interfaces:**
- Consumes: `middleware.UserIDKey/UserRoleKey/...`（复用现有 context key）、`config.CookieConfig.SessionName`、`session.Session.IsExpired`、`SessionStore`
- Produces: `middleware.SessionAuth(lookup, cookieCfg, idleTTL)`、`middleware.OptionalSessionAuth(...)`、`middleware.SessionLookup` 端口

- [ ] **Step 1: 写失败测试** `session_auth_test.go`

```go
package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	domainsession "blog-api/internal/domain/session"
)

// fakeLookup 内存版 SessionLookup，避免依赖 Redis。
type fakeLookup struct {
	sess *domainsession.Session
}

func (f *fakeLookup) Get(ctx context.Context, id domainsession.ID) (*domainsession.Session, error) {
	if f.sess != nil && f.sess.ID() == id {
		return f.sess, nil
	}
	return nil, domainsession.ErrSessionNotFound
}
func (f *fakeLookup) Touch(ctx context.Context, s *domainsession.Session, idle time.Duration) error { return nil }

func newReqWithCookie(cookieName, val string) *http.Request {
	r := httptest.NewRequest(http.MethodGet, "/protected", nil)
	if val != "" {
		r.AddCookie(&http.Cookie{Name: cookieName, Value: val})
	}
	return r
}

func TestSessionAuth_ValidCookieAuthorizes(t *testing.T) {
	s, _ := domainsession.NewSession(snapshotForTest(), time.Now(), 0)
	lookup := &fakeLookup{sess: s}
	h := SessionAuth(lookup, cookieCfgForTest(), time.Hour)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, s.UserID(), GetUserID(r.Context()))
		w.WriteHeader(http.StatusOK)
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, newReqWithCookie("mimo_session", string(s.ID())))
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestSessionAuth_MissingCookieReturns401(t *testing.T) {
	h := SessionAuth(&fakeLookup{}, cookieCfgForTest(), time.Hour)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("不应进入下游")
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, newReqWithCookie("mimo_session", ""))
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestOptionalSessionAuth_NoCookiePassesThrough(t *testing.T) {
	called := false
	h := OptionalSessionAuth(&fakeLookup{}, cookieCfgForTest(), time.Hour)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		assert.Empty(t, GetUserID(r.Context()))
		w.WriteHeader(http.StatusOK)
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, newReqWithCookie("mimo_session", ""))
	assert.True(t, called)
}
```

> 测试辅助 `snapshotForTest()`、`cookieCfgForTest()` 放同包 `*_test.go`：返回 `domainsession.UserSnapshot` 与 `config.CookieConfig{SessionName:"mimo_session",CSRFName:"mimo_csrf"}`。

- [ ] **Step 2: 运行验证失败**

Run: `cd api && go test ./internal/middleware/ -run TestSessionAuth_Valid -v`
Expected: FAIL — `SessionAuth undefined`

- [ ] **Step 3: 写 session_auth.go**

```go
package middleware

import (
	"net/http"
	"time"

	"github.com/rs/zerolog/log"

	"blog-api/config"
	domainsession "blog-api/internal/domain/session"
)

// SessionLookup session 查询与续期端口，由 infrastructure/auth.RedisSessionStore 实现。
// 中间件只依赖端口，不直接依赖 Redis。
type SessionLookup interface {
	Get(ctx context.Context, id domainsession.ID) (*domainsession.Session, error)
	Touch(ctx context.Context, sess *domainsession.Session, idleTTL time.Duration) error
}

// SessionAuth 强制 session 鉴权中间件。无/失效 cookie → 401。
//
// 命门：成功路径只 Touch（滑动续期），不轮换 id、不 Set-Cookie。
func SessionAuth(lookup SessionLookup, cookieCfg config.CookieConfig, idleTTL time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, ok := authenticateSession(w, r, lookup, cookieCfg, idleTTL, true)
			if !ok {
				return
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// OptionalSessionAuth 软鉴权（评论匿名/登录双轨）。无 cookie 放行不注入；失效 401。
func OptionalSessionAuth(lookup SessionLookup, cookieCfg config.CookieConfig, idleTTL time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if _, err := r.Cookie(cookieCfg.SessionName); err != nil {
				next.ServeHTTP(w, r)
				return
			}
			ctx, ok := authenticateSession(w, r, lookup, cookieCfg, idleTTL, true)
			if !ok {
				return
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func authenticateSession(w http.ResponseWriter, r *http.Request, lookup SessionLookup, cookieCfg config.CookieConfig, idleTTL time.Duration, touch bool) (context.Context, bool) {
	c, err := r.Cookie(cookieCfg.SessionName)
	if err != nil || c.Value == "" {
		writeUnauthorized(w)
		return nil, false
	}
	sess, err := lookup.Get(r.Context(), domainsession.ID(c.Value))
	if err != nil {
		log.Warn().Err(err).Str("path", r.URL.Path).Msg("session 鉴权失败：session 不存在或已过期")
		writeUnauthorized(w)
		return nil, false
	}
	if sess.IsExpired(time.Now(), idleTTL) {
		writeUnauthorized(w)
		return nil, false
	}
	if touch {
		if err := lookup.Touch(r.Context(), sess, idleTTL); err != nil {
			log.Warn().Err(err).Msg("session 续期失败，不影响本次鉴权")
		}
	}
	claims := sess.Claims()
	ctx := r.Context()
	ctx = context.WithValue(ctx, UserIDKey, claims.UserID)
	ctx = context.WithValue(ctx, UserRoleKey, claims.Role)
	ctx = context.WithValue(ctx, UserEmailKey, claims.Email)
	ctx = context.WithValue(ctx, UserRoleIDKey, claims.RoleID)
	ctx = context.WithValue(ctx, UserIsBuiltinSuperAdminKey, claims.IsBuiltinSuperAdmin)
	return ctx, true
}
```

> 补 `import "context"`。`writeUnauthorized`、`UserIDKey` 等已存在于 `auth.go`。

- [ ] **Step 4: 运行验证通过**

Run: `cd api && go test ./internal/middleware/ -run "SessionAuth" -v`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
cd api && git add internal/middleware/session_auth.go internal/middleware/session_auth_test.go
git commit -m "feat(auth): 新增 SessionAuth 鉴权中间件

- 读 mimo_session cookie → SessionLookup.Get → 注入 ctx → Touch 滑动续期
- 强制与可选两种模式，复用现有 context key
- 命门：成功路径只续期不轮换 id、不 Set-Cookie"
```

---

### Task 4: CreateSession command + LoginHandler 改造

**Files:**
- Create: `api/internal/application/auth/command/create_session.go`
- Modify: `api/internal/application/auth/command/auth_commands.go`（LoginHandler）
- Test: `api/internal/application/auth/command/create_session_test.go`

**Interfaces:**
- Consumes: `session.NewSession`、`SessionStore.Create`、`user.UserRepository`
- Produces: `CreateSessionHandler.Handle(ctx, CreateSessionInput) (CreateSessionOutput, error)`，其中 `CreateSessionOutput{SessionID, CSRFToken}`

- [ ] **Step 1: 写失败测试**

```go
package command

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/application/mocks"
	domainshared "blog-api/internal/domain/shared"
)

func TestCreateSession_PersistsAndReturnsID(t *testing.T) {
	repo := new(mocks.MockUserRepository)
	store := new(mocks.MockSessionStore)
	h := NewCreateSessionHandler(repo, store)

	uid := "00000000-0000-0000-0000-000000000001"
	repo.On("FindByID", mock.Anything, mock.Anything).Return(testUser(), nil)
	store.On("Create", mock.Anything, mock.Anything, mock.Anything).Return(nil).Run(func(args mock.Arguments) {
		// 校验传入的是新建 session 且 idleTTL>0
	})

	out, err := h.Handle(context.Background(), CreateSessionInput{
		UserID: uid, IdleTTL: 7 * 24 * time.Hour, MaxTTL: 0,
	})
	require.NoError(t, err)
	assert.NotEmpty(t, out.SessionID)
	assert.NotEmpty(t, out.CSRFToken)
	id, _ := domainshared.ParseID(uid)
	_ = id
	store.AssertExpectations(t)
}
```

> `mocks.MockSessionStore` 在 Task 9 随端口一起加；本任务先在 `mocks.go` 加该 mock（实现 `shared.SessionStore`）。`testUser()` 已存在于 `auth_commands_test.go`。

- [ ] **Step 2: 运行验证失败** — `cd api && go test ./internal/application/auth/command/ -run TestCreateSession -v` → FAIL（`NewCreateSessionHandler undefined`）

- [ ] **Step 3: 写 create_session.go**

```go
package command

import (
	"context"
	"time"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/shared"
	domainsession "blog-api/internal/domain/session"
)

// CreateSessionInput 创建 session 入参。MaxTTL<=0 表示无绝对寿命上限。
type CreateSessionInput struct {
	UserID  string
	IdleTTL time.Duration
	MaxTTL  time.Duration
}

// CreateSessionOutput 返回给 HTTP 层，由其写 cookie。
type CreateSessionOutput struct {
	SessionID string
	CSRFToken string
}

// CreateSessionHandler 登录成功后创建 opaque session。
type CreateSessionHandler struct {
	userRepo userRepoPort // 复用 LoginHandler 同款端口
	store    appshared.SessionStore
}

// NewCreateSessionHandler 构造。
func NewCreateSessionHandler(repo userRepoPort, store appshared.SessionStore) *CreateSessionHandler {
	return &CreateSessionHandler{userRepo: repo, store: store}
}

// Handle 取用户 → 快照 → NewSession → 持久化。
func (h *CreateSessionHandler) Handle(ctx context.Context, in CreateSessionInput) (CreateSessionOutput, error) {
	id, err := shared.ParseID(in.UserID)
	if err != nil {
		return CreateSessionOutput{}, user.ErrInvalidCredentials
	}
	u, err := h.userRepo.FindByID(ctx, id)
	if err != nil {
		return CreateSessionOutput{}, user.ErrInvalidCredentials
	}
	sess, err := domainsession.NewSession(domainsession.UserSnapshot{
		UserID: u.GetID(), Email: u.Email().String(), Role: string(u.Role()),
		RoleID: roleIDOf(u), IsBuiltinSuperAdmin: u.IsBuiltinSuperAdmin(),
	}, time.Now(), in.MaxTTL)
	if err != nil {
		return CreateSessionOutput{}, shared.Internal("创建 session 失败", err)
	}
	if err := h.store.Create(ctx, sess, in.IdleTTL); err != nil {
		return CreateSessionOutput{}, shared.Internal("持久化 session 失败", err)
	}
	return CreateSessionOutput{SessionID: string(sess.ID()), CSRFToken: string(sess.CSRF())}, nil
}
```

> `userRepoPort`、`roleIDOf` 是包内既有别名/辅助（LoginHandler 用 `user.UserRepository`）；若不存在则直接用 `user.UserRepository` 类型并内联 roleID（User 聚合当前无 RoleID() 访问器——见 Task 10 在 User 加 `RoleID() int32`，或在 snapshot 中置 0 由 handler 查 role repo 补全。**决策**：User 聚合加 `RoleID()` 访问器，Task 4 内联实现：先在 `domain/user/entity.go` 加 `roleID int32` 字段 + `RoleID()` 方法 + ReconstructUser 已含 roleID 参数位，确认后补访问器）。

- [ ] **Step 4: 改造 LoginHandler（auth_commands.go）**

把 `LoginHandler` 第 253-269 行的"生成 token pair + 存 refresh"替换为：返回 `LoginOutput{UserID}`，**不再生成 JWT**（token 由上层 CreateSession 统一创建）。新签名：

```go
type LoginOutput struct {
	UserID string
}

// Handle 仅校验凭证与账户状态，返回 userID。session 创建交由 CreateSessionHandler（HTTP 层编排）。
func (h *LoginHandler) Handle(ctx context.Context, in LoginInput) (LoginOutput, error) {
	// 1. 查找用户（保留原逻辑）
	// 2. 校验密码（保留）
	// 3. 校验邮箱已验证 + 账户启用（保留）
	// 4. 返回 userID，不再 GenerateTokenPair / tokenStore.Save
	return LoginOutput{UserID: u.GetID().String()}, nil
}
```

构造函数 `NewLoginHandler(repo, hasher)` —— **删除 tokenService、tokenStore 参数**。相应更新 `auth_container.go` 的装配（Task 10）。

- [ ] **Step 5: 运行验证通过**

Run: `cd api && go test ./internal/application/auth/command/ -v`
Expected: PASS（含新 CreateSession 测试；旧 Login 测试若有依赖 TokenPair 需同步改）

- [ ] **Step 6: 提交**

```bash
cd api && git add internal/application/auth/command/create_session.go internal/application/auth/command/create_session_test.go internal/application/auth/command/auth_commands.go internal/domain/user/entity.go internal/application/mocks/mocks.go
git commit -m "feat(auth): 新增 CreateSessionHandler 并改造 LoginHandler

- CreateSessionHandler：用户快照 → NewSession → SessionStore.Create
- LoginHandler 剥离 JWT/refresh，仅校验凭证返回 userID
- User 聚合补 RoleID 访问器供 session 快照使用"
```

---

### Task 5: GoogleLogin / GithubLogin 改造

**Files:**
- Modify: `api/internal/application/auth/command/google_login.go`
- Modify: `api/internal/application/auth/command/github_login.go`
- Modify: 对应 `*_test.go`（若存在）

**Interfaces:**
- Consumes: 与 Task 4 相同的剥离模式（不再返 TokenPair，返 userID）
- Produces: `GoogleLoginOutput{UserID}`、`GithubLoginOutput{UserID}`

- [ ] **Step 1: 写/改测试** — 现有 google/github login 测试断言 `out.TokenPair` 改为断言 `out.UserID` 非空；mock 不再期待 `GenerateTokenPair`/`Save`。

- [ ] **Step 2: 运行验证失败** — `go test ./internal/application/auth/command/ -run "Google|Github"`

- [ ] **Step 3: 改实现** — 与 LoginHandler 同构：校验 OAuth credential → 找到/创建用户 → 返回 `UserID`。删除构造函数的 `tokenService`/`tokenStore` 参数。session 创建统一由 HTTP 层调 `CreateSessionHandler`。

- [ ] **Step 4: 运行验证通过**

- [ ] **Step 5: 提交**

```bash
git add internal/application/auth/command/google_login.go internal/application/auth/command/github_login.go internal/application/auth/command/*_test.go
git commit -m "refactor(auth): Google/Github login 剥离 token 返回 userID

- 与 LoginHandler 对齐，session 创建统一由 CreateSessionHandler 负责
- 删除构造函数的 tokenService/tokenStore 依赖"
```

---

### Task 6: LogoutHandler 改造（删当前 session）

**Files:**
- Modify: `api/internal/application/auth/command/auth_commands.go`（LogoutHandler）
- Test: 同 `auth_commands_test.go` 或新建 `logout_test.go`

**Interfaces:**
- Consumes: `SessionStore.DeleteForUser(ctx, userID, sessionID)`
- Produces: `LogoutInput{UserID, SessionID}`

- [ ] **Step 1: 写测试**

```go
func TestLogout_DeletesCurrentSession(t *testing.T) {
	store := new(mocks.MockSessionStore)
	h := NewLogoutHandler(store)
	store.On("DeleteForUser", mock.Anything, "uid-1", domainsession.ID("sid-1")).Return(nil)
	err := h.Handle(context.Background(), LogoutInput{UserID: "uid-1", SessionID: "sid-1"})
	require.NoError(t, err)
	store.AssertExpectations(t)
}
```

- [ ] **Step 2: 验证失败**

- [ ] **Step 3: 改实现**

```go
type LogoutInput struct {
	UserID    string
	SessionID string
}

type LogoutHandler struct {
	store appshared.SessionStore
}

func NewLogoutHandler(store appshared.SessionStore) *LogoutHandler {
	return &LogoutHandler{store: store}
}

// Handle 删除当前 session（登出当前设备），不影响该用户其他设备。
func (h *LogoutHandler) Handle(ctx context.Context, in LogoutInput) error {
	return h.store.DeleteForUser(ctx, in.UserID, domainsession.ID(in.SessionID))
}
```

> 失败须记日志（ADR-0001 不变量 3 精神迁移）：`if err := ...; err != nil { log.Error().Err(err)...; return shared.Internal(...) }`。

- [ ] **Step 4: 验证通过**

- [ ] **Step 5: 提交**

```bash
git add internal/application/auth/command/auth_commands.go
git commit -m "refactor(auth): LogoutHandler 改为删除当前 session

- LogoutInput 携带 sessionID，调 SessionStore.DeleteForUser
- 仅登出当前设备，不影响同用户其他登录"
```

---

### Task 7: ChangePassword / ResetPassword 改造（吊销该用户全部 session）

**Files:**
- Modify: `api/internal/application/auth/command/auth_commands_more.go`
- Test: 对应测试文件

**Interfaces:**
- Consumes: `SessionStore.DeleteByUser(ctx, userID)`
- Produces: 两个 handler 构造函数从 `tokenStore` 改为 `sessionStore`

- [ ] **Step 1: 写测试** — 改密/重置成功后断言 `sessionStore.DeleteByUser(ctx, userID)` 被调用一次（替代旧 `tokenStore.Delete`）。

- [ ] **Step 2: 验证失败**

- [ ] **Step 3: 改实现** — 把两个 handler 持有的 `tokenStore appshared.TokenStore` 改为 `sessionStore appshared.SessionStore`；密码更新成功后调 `sessionStore.DeleteByUser(ctx, userID)` 强制该用户全部设备重登。构造函数参数同步改。

- [ ] **Step 4: 验证通过** — `go test ./internal/application/auth/command/`

- [ ] **Step 5: 提交**

```bash
git add internal/application/auth/command/auth_commands_more.go internal/application/auth/command/*_test.go
git commit -m "refactor(auth): 改密/重置密码吊销用户全部 session

- ChangePassword/ResetPassword 改用 SessionStore.DeleteByUser
- 密码变更后强制该用户所有设备重新登录"
```

---

### Task 8: HTTP handler cookie 层 + /auth/session 只读端点

**Files:**
- Modify: `api/internal/interfaces/http/response/`（cookie helper 文件，定位 `SetAuthTokenCookies`/`ClearAuthCookies` 所在文件）
- Modify: `api/internal/interfaces/http/handler/auth/auth.go`

**Interfaces:**
- Consumes: `CreateSessionOutput`、`config.CookieConfig.SessionName`、`middleware.GetUserID`/新增 `GetSessionID`
- Produces: `response.SetSessionCookie(w, sessionID, csrf, cookieCfg, idleTTL)`、`response.ClearSessionCookies(w, cookieCfg)`、`Handler.Session(w,r)`

- [ ] **Step 1: 在 response 包加 session cookie helper**（替代 SetAuthTokenCookies）

```go
// SetSessionCookie 下发 mimo_session(HttpOnly) + mimo_csrf(非 HttpOnly)。
// session id 经 cookie 传递，前端无需读取 session 值；csrf 供前端回传。
func SetSessionCookie(w http.ResponseWriter, sessionID, csrf string, cfg config.CookieConfig, idleTTL time.Duration) {
	http.SetCookie(w, &http.Cookie{
		Name: cfg.SessionName, Value: sessionID, Path: "/",
		Domain: cfg.Domain, MaxAge: int(idleTTL.Seconds()),
		Secure: cfg.Secure, HttpOnly: true, SameSite: cfg.SameSiteMode(),
	})
	http.SetCookie(w, &http.Cookie{
		Name: cfg.CSRFName, Value: csrf, Path: "/",
		Domain: cfg.Domain, MaxAge: int(idleTTL.Seconds()),
		Secure: cfg.Secure, HttpOnly: false, SameSite: cfg.SameSiteMode(),
	})
}

// ClearSessionCookies 登出/失效时清除 session + csrf cookie。
func ClearSessionCookies(w http.ResponseWriter, cfg config.CookieConfig) {
	for _, name := range []string{cfg.SessionName, cfg.CSRFName} {
		http.SetCookie(w, &http.Cookie{
			Name: name, Value: "", Path: "/", Domain: cfg.Domain,
			MaxAge: -1, Secure: cfg.Secure, HttpOnly: name == cfg.SessionName,
			SameSite: cfg.SameSiteMode(),
		})
	}
}
```

- [ ] **Step 2: 改 Login/Google/Github handler** — 调 `login.Handle` 拿 `UserID` → 调 `createSession.Handle` 拿 `CreateSessionOutput` → `response.SetSessionCookie(...)`。响应体改为 `{"user_id": ...}`（不再返 access_token）。删除 `generateCSRFToken` 调用（csrf 由 session 自带）。

- [ ] **Step 3: 改 Logout handler** — 从 ctx 取 sessionID（见 Step 5 加 getter）调 `logout.Handle` → `ClearSessionCookies`。

- [ ] **Step 4: 新增只读 Session 端点**（供 SSR，命门：不续期不 Set-Cookie）

```go
// Session GET /auth/session（SSR 探活，只读）
//
// 命门：只返回 claims，绝不续期、绝不 Set-Cookie。续期由后续真实业务请求的
// SessionAuth 中间件做。SSR 拿到 claims 即可判断登录态与角色。
func (h *Handler) Session(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	if userID == "" {
		response.RespondError(w, r, user.ErrInvalidCredentials) // 401
		return
	}
	response.RespondOK(w, map[string]any{
		"user_id":              userID,
		"role":                 interfacesmw.GetUserRoleFromContext(r),
		"email":                interfacesmw.GetUserEmailFromContext(r),
		"is_builtin_super_admin": interfacesmw.GetUserIsBuiltinSuperAdminFromContext(r),
	})
}
```

> 该端点挂在 `OptionalSessionAuth` + 不带 Touch 的只读查询路径上——为满足"不续期"，新增一个 `SessionAuthReadOnly` 中间件变体（`authenticateSession(..., touch=false)`），专供 `/auth/session`。

- [ ] **Step 5: middleware 加 SessionID 注入 + getter** — `SessionAuth` 在注入 ctx 时同时存 `sessionID`：`ctx = context.WithValue(ctx, SessionIDKey, string(sess.ID()))`，加 `GetSessionID(ctx)`。

- [ ] **Step 6: 写 handler 测试** — 用 `httptest` 验证 Login 响应 Set-Cookie 含 `mimo_session` + `mimo_csrf`；Session 端点只读不续期（mock lookup 期待 `Get` 不期待 `Touch`）。

- [ ] **Step 7: 运行验证 + 提交**

```bash
git add internal/interfaces/http/response/ internal/interfaces/http/handler/auth/ internal/middleware/session_auth.go
git commit -m "feat(auth): handler cookie 层改 session + 新增只读 /auth/session

- SetSessionCookie/ClearSessionCookies 取代 token cookie
- Login/Google/Github 编排 CreateSession 并下发 session cookie
- /auth/session 只读探活端点，不续期不 Set-Cookie（SSR 命门）
- SessionAuth 注入 sessionID 供登出使用"
```

---

### Task 9: 删除 JWT/refresh/rotation 遗产 + config 重构

**Files:**
- Delete: `api/internal/infrastructure/auth/jwt.go`、`jwt_test.go`、`redis_store.go`、`redis_store_test.go`
- Delete: `RefreshTokenHandler`（auth_commands.go）+ 其测试
- Modify: `api/internal/application/shared/ports.go`（删 `TokenService`/`TokenStore`/`TokenPair`/`TokenInput`/`Claims`/`RotateResult`）
- Modify: `api/internal/application/mocks/mocks.go`（删 `MockTokenService`/`MockTokenStore`）
- Modify: `api/internal/app/auth_adapters.go`（删 `TokenServiceAdapter`）
- Modify: `api/config/config.go`（删 `JWT*`，加 `Session{IdleTTL,MaxTTL}` + `CookieConfig.SessionName`）
- Modify: 路由注册（删 `/auth/refresh`，加 `/auth/session` GET）

**Interfaces:** 无新契约，纯删除 + 配置迁移。

- [ ] **Step 1: 删除文件与死代码** — `git rm` 四个 infra 文件；删除 `RefreshTokenHandler` 及 `auth_commands_test.go` 中 `TestRefresh_*` 四个测试；删除 ports.go 中 Token 相关类型；删除 mocks 与 adapter。

- [ ] **Step 2: 改 config.go** — 删 `JWTPrivateKeyPath/JWTPublicKeyPath/JWTAccessTokenTTL/JWTRefreshTokenTTL/JWTAllowEphemeralKey` 与对应校验；加：

```go
type SessionConfig struct {
	IdleTTL time.Duration // 滑动续期窗口
	MaxTTL  time.Duration // 绝对寿命，<=0 无上限
}
// Config 加：Session SessionConfig
// CookieConfig 加：SessionName string（默认 mimo_session）
// 校验：Session.IdleTTL>0；Cookie.SessionName 非空
// config.example.yaml 对应更新
```

- [ ] **Step 3: 改路由** — 找到路由注册文件（`internal/interfaces/http/router` 或 main），删 `r.Post("/auth/refresh", ...)`，加 `r.Get("/auth/session", h.Session)`（挂在 `OptionalSessionAuth` 只读变体后）；`/auth/login` 等 CSRF 豁免列表保持。

- [ ] **Step 4: 编译验证**

Run: `cd api && go build ./...`
Expected: 无编译错误（所有 Token 引用已清）

- [ ] **Step 5: 测试验证**

Run: `cd api && go test ./...`
Expected: 全绿（除被删的 refresh 测试）

- [ ] **Step 6: 提交**

```bash
git rm internal/infrastructure/auth/jwt.go internal/infrastructure/auth/jwt_test.go internal/infrastructure/auth/redis_store.go internal/infrastructure/auth/redis_store_test.go
git add -A
git commit -m "refactor(auth): 删除 JWT/refresh/rotation 遗产

- 删 JWTService/RedisTokenStore/RefreshTokenHandler/TokenService/TokenStore 端口
- 删 /auth/refresh 端点，加 /auth/session 只读端点
- config 删 JWT 字段，加 Session(IdleTTL/MaxTTL) 与 Cookie.SessionName
- 无兼容层，ADR-0001/0002 superseded"
```

---

### Task 10: auth_container 装配 + 集成测试

**Files:**
- Modify: `api/internal/app/auth_container.go`、`auth_adapters.go`
- Modify: 装配 SessionAuth 中间件的入口（main 或 router 装配处）
- Test: `api/internal/app/auth_integration_test.go`（新建）

**Interfaces:**
- Consumes: 所有前序 task 产物
- Produces: 可运行的 opaque session 鉴权链路

- [ ] **Step 1: 重写 NewAuthContainer**

```go
func NewAuthContainer(db, redisClient, cfg, emailSender, bus, settingsSvc) (*AuthContainer, error) {
	userRepo := gormrepo.NewUserRepository(db)
	roleRepo := gormrepo.NewRoleRepository(db)
	sessionStore := infraauth.NewRedisSessionStore(redisClient)
	hasher := authcmd.NewBcryptHasher()

	register := authcmd.NewRegisterUserHandler(userRepo, codeStore, emailSender, hasher, bus)
	login := authcmd.NewLoginHandler(userRepo, hasher)            // 无 token 依赖
	google := authcmd.NewGoogleLoginHandler(userRepo, cfg.GoogleClientID, hasher)
	github := authcmd.NewGithubLoginHandler(userRepo, cfg.GithubClientID, cfg.GithubClientSecret, hasher)
	createSession := authcmd.NewCreateSessionHandler(userRepo, sessionStore)
	logout := authcmd.NewLogoutHandler(sessionStore)
	verify := authcmd.NewVerifyEmailHandler(userRepo, codeStore)
	forgot := authcmd.NewForgotPasswordHandler(userRepo, codeStore, emailSender, hasher)
	reset := authcmd.NewResetPasswordHandler(userRepo, codeStore, hasher, sessionStore)
	changePwd := authcmd.NewChangePasswordHandler(userRepo, hasher, sessionStore)
	getMe := authquery.NewGetMeHandler(userRepo, roleRepo)
	ensureSuperAdmin := authcmd.NewEnsureSuperAdminHandler(userRepo, hasher)

	authHandler := authhttp.NewHandler(
		register, login, google, github, createSession, logout, verify, forgot, reset,
		updatePf, changePwd, getMe, settingsSvc, cfg.Cookie, cfg.Session,
	)
	return &AuthContainer{AuthHandler: authHandler, EnsureSuperAdmin: ensureSuperAdmin, SessionStore: sessionStore}, nil
}
```

> `AuthContainer` 用 `SessionStore` 取代 `JWTService`；中间件装配处用 `middleware.SessionAuth(sessionStore, cfg.Cookie, cfg.Session.IdleTTL)` 取代 `middleware.Auth(jwtValidator, middleware.WithAccessCookie(...))`。

- [ ] **Step 2: 写集成测试** `auth_integration_test.go`（miniredis + httptest + 真实 handler 链）

覆盖端到端契约：
1. `POST /auth/login` → 响应 `Set-Cookie: mimo_session=...; mimo_csrf=...`，body 含 `user_id`
2. 用该 cookie `GET /auth/session` → 200，body 含 user_id/role（且 mock 期待**不调 Touch**，验证只读命门）
3. 用该 cookie `GET` 任一受保护端点 → 200，且 session TTL 被重置（调 Touch）
4. `POST /auth/logout`（带 cookie + CSRF header）→ 200 + `Set-Cookie: ...Max-Age=0`
5. logout 后再用该 cookie `GET /auth/session` → 401
6. `PATCH /auth/password` 成功后，该用户**另一** session 也失效（DeleteByUser）

- [ ] **Step 3: 运行验证**

Run: `cd api && go test ./internal/app/ -run TestAuthIntegration -v && go test ./...`
Expected: 全绿

- [ ] **Step 4: 提交**

```bash
git add internal/app/ internal/interfaces/http/router/
git commit -m "feat(auth): 装配 opaque session 鉴权链路 + 集成测试

- NewAuthContainer 改装 SessionStore/CreateSession/SessionAuth
- 集成测试覆盖 login→cookie→SSR 探活→受保护请求→logout 全链路
- 验证 /auth/session 只读不续期、改密吊销全部 session"
```

---

## Self-Review（已逐项核对）

1. **Spec 覆盖**：ADR-0003 的 cookie 清单（Task 1/8）、生命周期 idle+max（Task 1）、纯 opaque 删 JWT（Task 9）、命门 SSR 只读不续期（Task 3/8）、登录三方式保留（Task 4/5）、账号端点改 session（Task 7）、强制重登无兼容层（Task 9 删除即可，不写双轨）均有对应 task。
2. **Placeholder 扫描**：无 TBD/TODO；Task 5/7 的"同构改造"附了完整契约与测试要求，非空泛引用；roleID 访问器缺口在 Task 4 明确补。
3. **类型一致**：`SessionStore.DeleteForUser(ctx, userID, id)` 在 Task 2 端口、Task 6 调用一致；`SessionLookup`（Task 3）与 `SessionStore`（Task 2）的 Get/Touch 签名一致；`CreateSessionOutput{SessionID,CSRFToken}`（Task 4）与 Task 8 handler 消费一致。

## Execution Handoff

Plan 已保存至 `docs/superpowers/plans/2026-07-06-auth-opaque-session-backend.md`。两种执行方式：

1. **Subagent-Driven（推荐）** — 每个 task 派 fresh subagent，task 间 review，迭代快。
2. **Inline Execution** — 本会话内用 executing-plans 批量执行，带 checkpoint review。

哪种？
