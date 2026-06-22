package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// stubValidator TokenValidator 的测试 stub
type stubValidator struct {
	claims *TokenClaims
	err    error
	called bool
}

func (s *stubValidator) ParseToken(tokenString string) (*TokenClaims, error) {
	s.called = true
	return s.claims, s.err
}

// newAuthenticatedRequest 构造带 Authorization header 和/或 cookie 的请求
func newAuthenticatedRequest(t *testing.T, header, cookieName, cookieValue string) *http.Request {
	t.Helper()
	r := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	if header != "" {
		r.Header.Set("Authorization", header)
	}
	if cookieName != "" && cookieValue != "" {
		r.AddCookie(&http.Cookie{Name: cookieName, Value: cookieValue})
	}
	return r
}

// TestExtractToken_PrefersHeader Authorization header 优先于 cookie
// 兼容 SSR server 端调用（server 端不读 cookie，显式注入 header）
func TestExtractToken_PrefersHeader(t *testing.T) {
	r := newAuthenticatedRequest(t, "Bearer header-token", "mimo_access", "cookie-token")

	token, source := extractToken(r, "mimo_access")
	assert.Equal(t, "header-token", token)
	assert.Equal(t, "header", source)
}

// TestExtractToken_FallsBackToCookie header 缺失时回退 cookie
// 这是 HttpOnly Cookie 鉴权方案的核心路径（浏览器自动携带 cookie）
func TestExtractToken_FallsBackToCookie(t *testing.T) {
	r := newAuthenticatedRequest(t, "", "mimo_access", "cookie-token")

	token, source := extractToken(r, "mimo_access")
	assert.Equal(t, "cookie-token", token)
	assert.Equal(t, "cookie", source)
}

// TestExtractToken_NoCredentials 两处都没有 token，返回空
func TestExtractToken_NoCredentials(t *testing.T) {
	r := newAuthenticatedRequest(t, "", "", "")

	token, source := extractToken(r, "mimo_access")
	assert.Empty(t, token)
	assert.Empty(t, source)
}

// TestExtractToken_MalformedHeaderIgnoredThenCookie header 格式错误时回退 cookie
// 防止 header 写了但格式错（如 "Token xxx"）导致 cookie 失效
func TestExtractToken_MalformedHeaderIgnoredThenCookie(t *testing.T) {
	r := newAuthenticatedRequest(t, "Token not-bearer-format", "mimo_access", "cookie-token")

	token, source := extractToken(r, "mimo_access")
	assert.Equal(t, "cookie-token", token)
	assert.Equal(t, "cookie", source)
}

// TestExtractToken_CookieDisabled accessCookieName 为空时不读 cookie
// 测试默认行为（未配置 WithAccessCookie）下不依赖 cookie
func TestExtractToken_CookieDisabled(t *testing.T) {
	r := newAuthenticatedRequest(t, "", "mimo_access", "cookie-token")

	token, source := extractToken(r, "")
	assert.Empty(t, token, "cookie 名为空时不应读 cookie")
	assert.Empty(t, source)
}

// TestExtractToken_EmptyCookieValueIgnored cookie 存在但值为空时忽略
// （clear cookie 后浏览器可能仍发空值 cookie）
func TestExtractToken_EmptyCookieValueIgnored(t *testing.T) {
	r := newAuthenticatedRequest(t, "", "mimo_access", "")

	token, source := extractToken(r, "mimo_access")
	assert.Empty(t, token)
	assert.Empty(t, source)
}

// TestAuth_RejectsMissingCredentials 完整中间件：无凭据返回 401
func TestAuth_RejectsMissingCredentials(t *testing.T) {
	validator := &stubValidator{claims: &TokenClaims{UserID: "u1"}}
	mw := Auth(validator, WithAccessCookie("mimo_access"))

	called := false
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}))

	r := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	assert.False(t, called, "无凭据不应调用下游 handler")
	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.False(t, validator.called, "不应调用 validator")
}

// TestAuth_AcceptsHeaderCredential 完整中间件：Bearer header 通过
func TestAuth_AcceptsHeaderCredential(t *testing.T) {
	validator := &stubValidator{claims: &TokenClaims{UserID: "u1", Role: "user"}}
	mw := Auth(validator, WithAccessCookie("mimo_access"))

	var ctxUserID string
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctxUserID = GetUserID(r.Context())
	}))

	r := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	r.Header.Set("Authorization", "Bearer valid-token")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "u1", ctxUserID)
	assert.True(t, validator.called)
}

// TestAuth_AcceptsCookieCredential 完整中间件：cookie 通过（核心新增路径）
func TestAuth_AcceptsCookieCredential(t *testing.T) {
	validator := &stubValidator{claims: &TokenClaims{UserID: "u1", Role: "user"}}
	mw := Auth(validator, WithAccessCookie("mimo_access"))

	var ctxUserID string
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctxUserID = GetUserID(r.Context())
	}))

	r := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	r.AddCookie(&http.Cookie{Name: "mimo_access", Value: "valid-token"})
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "u1", ctxUserID)
	assert.True(t, validator.called)
}
