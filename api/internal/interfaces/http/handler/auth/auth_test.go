package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"blog-api/config"
	authcmd "blog-api/internal/application/auth/command"
	"blog-api/internal/application/mocks"
	domainsession "blog-api/internal/domain/session"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
	"blog-api/internal/middleware"
)

// testCookieCfg 测试用 Cookie 配置（与默认 mimo_session/mimo_csrf 名对齐）。
func testCookieCfg() config.CookieConfig {
	return config.CookieConfig{
		CSRFName:    "mimo_csrf",
		SessionName: "mimo_session",
		Secure:      false,
		SameSite:    "lax",
	}
}

// hashedTestUser 构造一个邮箱已验证、账户启用、密码为 bcrypt 哈希的 *User。
// plainPassword 是该用户密码的明文，供 login 请求体回填。
func hashedTestUser(t *testing.T, plainPassword string) *domainuser.User {
	t.Helper()
	hasher := authcmd.NewBcryptHasher()
	hash, err := hasher.Hash(plainPassword)
	require.NoError(t, err)
	uid, _ := domainshared.ParseID("00000000-0000-0000-0000-000000000001")
	email, _ := domainuser.ParseEmail("u@example.com")
	username, _ := domainuser.ParseUsername("alice")
	return domainuser.ReconstructUser(
		uid, email, username, hash, "", "", domainuser.RoleUser,
		nil, nil, false, true, true, time.Time{}, time.Time{},
	)
}

// TestLogin_SetsSessionAndCSRFCookies 验证登录成功后下发 mimo_session + mimo_csrf cookie，body 含 user_id。
// 对应 Issue-0003：Login handler 调 createSession → SetSessionCookie，响应体 {user_id}。
func TestLogin_SetsSessionAndCSRFCookies(t *testing.T) {
	const plainPwd = "pass-word-123"
	u := hashedTestUser(t, plainPwd)

	userRepo := new(mocks.MockUserRepository)
	sessionStore := new(mocks.MockSessionStore)
	hasher := authcmd.NewBcryptHasher()

	login := authcmd.NewLoginHandler(userRepo, hasher)
	createSession := authcmd.NewCreateSessionHandler(userRepo, sessionStore)

	// login 走 FindByEmail；createSession 走 FindByID
	email, _ := domainuser.ParseEmail("u@example.com")
	userRepo.On("FindByEmail", mock.Anything, email).Return(u, nil)
	userRepo.On("FindByID", mock.Anything, u.GetID()).Return(u, nil)
	sessionStore.On("Create", mock.Anything, mock.Anything, mock.Anything).Return(nil)

	h := NewHandler(
		nil, login, nil, nil, nil, createSession,
		nil, nil, nil, nil, nil, nil, nil,
		testCookieCfg(),
		config.SessionConfig{IdleTTL: time.Hour, MaxTTL: 0},
	)

	body := `{"email":"u@example.com","password":"` + plainPwd + `"}`
	req := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(body))
	rec := httptest.NewRecorder()
	h.Login(rec, req)

	require.Equal(t, http.StatusOK, rec.Code, "登录应返回 200")

	// 响应体含 user_id，不含 access_token
	var env struct {
		Data map[string]any `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &env))
	assert.Equal(t, u.GetID().String(), env.Data["user_id"])
	assert.NotContains(t, env.Data, "access_token", "session 链路不返回 access_token")

	// Set-Cookie 含 mimo_session 与 mimo_csrf
	cookies := rec.Result().Cookies()
	var hasSession, hasCSRF bool
	for _, c := range cookies {
		switch c.Name {
		case "mimo_session":
			hasSession = true
			assert.True(t, c.HttpOnly, "mimo_session 必须 HttpOnly")
			assert.NotEmpty(t, c.Value)
		case "mimo_csrf":
			hasCSRF = true
			assert.False(t, c.HttpOnly, "mimo_csrf 必须非 HttpOnly（前端需读取）")
		}
	}
	assert.True(t, hasSession, "响应应下发 mimo_session cookie")
	assert.True(t, hasCSRF, "响应应下发 mimo_csrf cookie")

	sessionStore.AssertNumberOfCalls(t, "Create", 1)
}

// TestSession_ReturnsClaimsWhenAuthenticated 验证 /auth/session 已登录时返回 claims。
// 对应 Issue-0003：Handler.Session 读 ctx claims 返回 user_id/role/email。
func TestSession_ReturnsClaimsWhenAuthenticated(t *testing.T) {
	h := NewHandler(
		nil, nil, nil, nil, nil, nil,
		nil, nil, nil, nil, nil, nil, nil,
		testCookieCfg(),
		config.SessionConfig{IdleTTL: time.Hour},
	)

	// 模拟 SessionAuthReadOnly 注入的 context（中间件层已测 Touch 不被调用）
	ctx := context.WithValue(context.Background(), middleware.UserIDKey, "user-123")
	ctx = context.WithValue(ctx, middleware.UserRoleKey, "admin")
	ctx = context.WithValue(ctx, middleware.UserEmailKey, "a@b.c")
	ctx = context.WithValue(ctx, middleware.UserIsBuiltinSuperAdminKey, false)

	req := httptest.NewRequest(http.MethodGet, "/auth/session", nil).WithContext(ctx)
	rec := httptest.NewRecorder()
	h.Session(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var env struct {
		Data map[string]any `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &env))
	assert.Equal(t, "user-123", env.Data["user_id"])
	assert.Equal(t, "admin", env.Data["role"])
	assert.Equal(t, "a@b.c", env.Data["email"])
	// 不续期、不写 cookie（命门不变量①）
	assert.Empty(t, rec.Result().Cookies(), "/auth/session 不得 Set-Cookie")
}

// TestSession_Returns401WhenUnauthenticated 验证 /auth/session 未登录时返回 401。
func TestSession_Returns401WhenUnauthenticated(t *testing.T) {
	h := NewHandler(
		nil, nil, nil, nil, nil, nil,
		nil, nil, nil, nil, nil, nil, nil,
		testCookieCfg(),
		config.SessionConfig{IdleTTL: time.Hour},
	)

	req := httptest.NewRequest(http.MethodGet, "/auth/session", nil)
	rec := httptest.NewRecorder()
	h.Session(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// TestLogout_DeletesCurrentSessionAndClearsCookies 验证登出从 ctx 取 sessionID 调 DeleteForUser 并清 cookie。
// 对应 Issue-0003：Logout handler 从 ctx 取 sessionID 调 logout → ClearSessionCookies。
func TestLogout_DeletesCurrentSessionAndClearsCookies(t *testing.T) {
	sessionStore := new(mocks.MockSessionStore)
	logout := authcmd.NewLogoutHandler(sessionStore)

	// 断言 DeleteForUser 收到 ctx 注入的 sessionID（而非空串）
	sessionStore.On("DeleteForUser", mock.Anything, "user-1", domainsession.ID("sess-abc")).Return(nil)

	h := NewHandler(
		nil, nil, nil, nil, logout, nil,
		nil, nil, nil, nil, nil, nil, nil,
		testCookieCfg(),
		config.SessionConfig{IdleTTL: time.Hour},
	)

	ctx := context.WithValue(context.Background(), middleware.UserIDKey, "user-1")
	ctx = context.WithValue(ctx, middleware.SessionIDKey, "sess-abc")
	req := httptest.NewRequest(http.MethodPost, "/auth/logout", nil).WithContext(ctx)
	rec := httptest.NewRecorder()
	h.Logout(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	sessionStore.AssertNumberOfCalls(t, "DeleteForUser", 1)

	// 清 cookie：三个 cookie 都应 MaxAge=-1
	cookies := rec.Result().Cookies()
	require.GreaterOrEqual(t, len(cookies), 2, "应清除 mimo_session 与 mimo_csrf")
	for _, c := range cookies {
		assert.Equal(t, -1, c.MaxAge, "cookie %s 应被清除（MaxAge=-1）", c.Name)
	}
}
