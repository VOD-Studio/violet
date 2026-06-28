package response

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/config"
)

// testCookieCfg 构造测试用 Cookie 配置
//
// Secure=false 以便 dev 环境跑通；SameSite=lax 是默认推荐值
func testCookieCfg() config.CookieConfig {
	return config.CookieConfig{
		AccessName:  "mimo_access",
		RefreshName: "mimo_refresh",
		CSRFName:    "mimo_csrf",
		Secure:      false,
		SameSite:    "lax",
	}
}

// TestSetAuthTokenCookies_SetsAllThreeCookies 验证 access + refresh + CSRF 三个 Cookie 全部下发
func TestSetAuthTokenCookies_SetsAllThreeCookies(t *testing.T) {
	w := httptest.NewRecorder()
	cfg := testCookieCfg()

	SetAuthTokenCookies(w, "access-token", "refresh-token", "csrf-token", cfg)

	cookies := w.Result().Cookies()
	names := cookieNames(cookies)
	assert.ElementsMatch(t, []string{"mimo_access", "mimo_refresh", "mimo_csrf"}, names)
}

// TestSetAuthTokenCookies_AccessCookieIsHttpOnly access token 必须 HttpOnly（防 XSS 偷取）
func TestSetAuthTokenCookies_AccessCookieIsHttpOnly(t *testing.T) {
	w := httptest.NewRecorder()
	cfg := testCookieCfg()

	SetAuthTokenCookies(w, "access-token", "refresh-token", "csrf-token", cfg)

	c := findCookie(t, w.Result().Cookies(), "mimo_access")
	assert.True(t, c.HttpOnly, "access cookie 必须 HttpOnly")
	assert.Equal(t, "access-token", c.Value)
	assert.Equal(t, "/", c.Path)
}

// TestSetAuthTokenCookies_RefreshCookieScopedToAuth refresh cookie Path 限定 /api/v1/auth，
// 匹配 refresh/logout 路由的实际挂载路径（chi 以 full path 匹配 cookie），
// 缩小暴露面（仅 refresh 与 logout 端点会收到）
func TestSetAuthTokenCookies_RefreshCookieScopedToAuth(t *testing.T) {
	w := httptest.NewRecorder()
	cfg := testCookieCfg()

	SetAuthTokenCookies(w, "access-token", "refresh-token", "csrf-token", cfg)

	c := findCookie(t, w.Result().Cookies(), "mimo_refresh")
	assert.True(t, c.HttpOnly, "refresh cookie 必须 HttpOnly")
	assert.Equal(t, RefreshCookiePath, c.Path, "refresh cookie Path 必须匹配 refresh/logout 路由前缀")
	assert.Equal(t, "refresh-token", c.Value)
}

// TestSetAuthTokenCookies_CSRFCookieNotHttpOnly CSRF double-submit cookie
// 必须非 HttpOnly——前端 JS 要读取它以回传 X-CSRF-Token header
func TestSetAuthTokenCookies_CSRFCookieNotHttpOnly(t *testing.T) {
	w := httptest.NewRecorder()
	cfg := testCookieCfg()

	SetAuthTokenCookies(w, "access-token", "refresh-token", "csrf-token", cfg)

	c := findCookie(t, w.Result().Cookies(), "mimo_csrf")
	assert.False(t, c.HttpOnly, "CSRF cookie 必须非 HttpOnly（前端要读取）")
	assert.Equal(t, "csrf-token", c.Value)
}

// TestSetAuthTokenCookies_EmptyCSRFTokenSkipsCookie 空 CSRF token 不下发该 cookie
// （auth handler 在 rand.Read 失败时返回空串，此时不应下发空值 cookie）
func TestSetAuthTokenCookies_EmptyCSRFTokenSkipsCookie(t *testing.T) {
	w := httptest.NewRecorder()
	cfg := testCookieCfg()

	SetAuthTokenCookies(w, "access-token", "refresh-token", "", cfg)

	cookies := w.Result().Cookies()
	for _, c := range cookies {
		assert.NotEqual(t, "mimo_csrf", c.Name, "空 CSRF token 不应下发 cookie")
	}
}

// TestSetAuthTokenCookies_SameSiteMode 验证 SameSite 配置正确映射到枚举
func TestSetAuthTokenCookies_SameSiteMode(t *testing.T) {
	cases := []struct {
		config string
		want   http.SameSite
	}{
		{"lax", http.SameSiteLaxMode},
		{"strict", http.SameSiteStrictMode},
		{"none", http.SameSiteNoneMode},
	}
	for _, tc := range cases {
		t.Run(tc.config, func(t *testing.T) {
			w := httptest.NewRecorder()
			cfg := testCookieCfg()
			cfg.SameSite = tc.config

			SetAuthTokenCookies(w, "a", "r", "c", cfg)

			c := findCookie(t, w.Result().Cookies(), "mimo_access")
			assert.Equal(t, tc.want, c.SameSite)
		})
	}
}

// TestClearAuthCookies_RemovesAllThree 清除时 MaxAge=-1 让浏览器删除
// 关键：Path 必须与 SetAuthTokenCookies 一致，否则浏览器不会删除
func TestClearAuthCookies_RemovesAllThree(t *testing.T) {
	w := httptest.NewRecorder()
	cfg := testCookieCfg()

	ClearAuthCookies(w, cfg)

	cookies := w.Result().Cookies()
	require.Len(t, cookies, 3, "必须清除 access + refresh + CSRF 三个 cookie")
	for _, c := range cookies {
		assert.Equal(t, -1, c.MaxAge, "%s cookie MaxAge 必须为 -1", c.Name)
		assert.Empty(t, c.Value, "%s cookie Value 必须清空", c.Name)
	}
}

// TestClearAuthCookies_PathMatchesSet refresh cookie Path 必须与 SetAuthTokenCookies 一致，
// 否则浏览器不会真正删除
func TestClearAuthCookies_PathMatchesSet(t *testing.T) {
	cfg := testCookieCfg()

	setW := httptest.NewRecorder()
	SetAuthTokenCookies(setW, "a", "r", "c", cfg)
	clearW := httptest.NewRecorder()
	ClearAuthCookies(clearW, cfg)

	setRefresh := findCookie(t, setW.Result().Cookies(), "mimo_refresh")
	clearRefresh := findCookie(t, clearW.Result().Cookies(), "mimo_refresh")
	assert.Equal(t, setRefresh.Path, clearRefresh.Path,
		"清除时 Path 必须与设置时一致，否则浏览器不会删除")
}

// findCookie 在 cookie 列表中按名查找，找不到则 fail
func findCookie(t *testing.T, cookies []*http.Cookie, name string) *http.Cookie {
	t.Helper()
	for _, c := range cookies {
		if c.Name == name {
			return c
		}
	}
	t.Fatalf("cookie %s 未找到", name)
	return nil
}

// cookieNames 提取 cookie 名列表
func cookieNames(cookies []*http.Cookie) []string {
	names := make([]string, 0, len(cookies))
	for _, c := range cookies {
		names = append(names, c.Name)
	}
	return names
}
