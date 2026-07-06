package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"blog-api/config"
	domainshared "blog-api/internal/domain/shared"
	domainsession "blog-api/internal/domain/session"
)

// fakeLookup 内存版 SessionLookup，避免依赖 Redis。touched 记录是否被调 Touch。
type fakeLookup struct {
	sess    *domainsession.Session
	touched bool
}

func (f *fakeLookup) Get(_ context.Context, id domainsession.ID) (*domainsession.Session, error) {
	if f.sess != nil && f.sess.ID() == id {
		return f.sess, nil
	}
	return nil, domainsession.ErrSessionNotFound
}
func (f *fakeLookup) Touch(_ context.Context, _ *domainsession.Session, _ time.Duration) error {
	f.touched = true
	return nil
}

// testSnapMW 构造测试用 UserSnapshot。
func testSnapMW() domainsession.UserSnapshot {
	uid, _ := domainshared.ParseID("00000000-0000-0000-0000-000000000001")
	return domainsession.UserSnapshot{UserID: uid, Email: "u@example.com", Role: "user", RoleID: 2}
}

// testCookieCfg 构造测试用 CookieConfig。
func testCookieCfg() config.CookieConfig {
	return config.CookieConfig{SessionName: "mimo_session", CSRFName: "mimo_csrf"}
}

// reqWithCookie 构造带指定 cookie 的请求，val 为空表示不带。
func reqWithCookie(name, val string) *http.Request {
	r := httptest.NewRequest(http.MethodGet, "/protected", nil)
	if val != "" {
		r.AddCookie(&http.Cookie{Name: name, Value: val})
	}
	return r
}

// TestSessionAuth_ValidCookieAuthorizes 有效 cookie → 注入 ctx + 下游被调用 + Touch 续期。
func TestSessionAuth_ValidCookieAuthorizes(t *testing.T) {
	s, _ := domainsession.NewSession(testSnapMW(), time.Now(), 0)
	lookup := &fakeLookup{sess: s}
	h := SessionAuth(lookup, testCookieCfg(), time.Hour)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, s.UserID(), GetUserID(r.Context()))
		assert.Equal(t, string(s.ID()), GetSessionID(r.Context()))
		w.WriteHeader(http.StatusOK)
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, reqWithCookie("mimo_session", string(s.ID())))
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.True(t, lookup.touched, "成功路径应 Touch 续期")
}

// TestSessionAuth_MissingCookieReturns401 无 cookie → 401，下游不调用。
func TestSessionAuth_MissingCookieReturns401(t *testing.T) {
	h := SessionAuth(&fakeLookup{}, testCookieCfg(), time.Hour)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("不应进入下游")
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, reqWithCookie("mimo_session", ""))
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// TestSessionAuth_InvalidCookieReturns401 session 不存在 → 401。
func TestSessionAuth_InvalidCookieReturns401(t *testing.T) {
	lookup := &fakeLookup{} // 无 sess，Get 返回 ErrSessionNotFound
	h := SessionAuth(lookup, testCookieCfg(), time.Hour)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("不应进入下游")
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, reqWithCookie("mimo_session", "stale-id"))
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// TestOptionalSessionAuth_NoCookiePassesThrough 无 cookie → 放行不注入。
func TestOptionalSessionAuth_NoCookiePassesThrough(t *testing.T) {
	called := false
	h := OptionalSessionAuth(&fakeLookup{}, testCookieCfg(), time.Hour)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		assert.Empty(t, GetUserID(r.Context()))
		w.WriteHeader(http.StatusOK)
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, reqWithCookie("mimo_session", ""))
	assert.True(t, called)
}

// TestSessionAuthReadOnly_DoesNotTouch 只读模式不调 Touch（命门不变量①）。
func TestSessionAuthReadOnly_DoesNotTouch(t *testing.T) {
	s, _ := domainsession.NewSession(testSnapMW(), time.Now(), 0)
	lookup := &fakeLookup{sess: s}
	h := SessionAuthReadOnly(lookup, testCookieCfg(), time.Hour)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, reqWithCookie("mimo_session", string(s.ID())))
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.False(t, lookup.touched, "只读探活不应 Touch 续期")
}
