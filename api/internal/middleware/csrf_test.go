package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"

	"blog-api/config"
)

// testCSRFCfg 构造测试用 Cookie 配置
func testCSRFCfg() config.CookieConfig {
	return config.CookieConfig{
		CSRFName: "mimo_csrf",
		Secure:   false,
		SameSite: "lax",
	}
}

// callCSRF 构造请求并调用 CSRF 中间件，返回 (status, downstreamCalled)
func callCSRF(t *testing.T, method, path string, cfg config.CookieConfig, exempt []string, setHeader, setCookie string) (int, bool) {
	t.Helper()
	mw := CSRF(cfg, exempt)
	called := false
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	r := httptest.NewRequest(method, path, nil)
	if setHeader != "" {
		r.Header.Set(CSRFHeaderName, setHeader)
	}
	if setCookie != "" {
		r.AddCookie(&http.Cookie{Name: cfg.CSRFName, Value: setCookie})
	}
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	return w.Code, called
}

// TestCSRF_SafeMethodsBypass GET/HEAD/OPTIONS 免验
// 这些方法幂等且不改状态，不需要 CSRF 防护
func TestCSRF_SafeMethodsBypass(t *testing.T) {
	cfg := testCSRFCfg()
	for _, m := range []string{http.MethodGet, http.MethodHead, http.MethodOptions} {
		t.Run(m, func(t *testing.T) {
			// 不带任何 CSRF 凭据也应通过
			status, called := callCSRF(t, m, "/posts", cfg, nil, "", "")
			assert.Equal(t, http.StatusOK, status, "%s 应免验通过", m)
			assert.True(t, called, "%s 应调用下游 handler", m)
		})
	}
}

// TestCSRF_PostWithMatchingTokens cookie 与 header 相等时通过（核心成功路径）
func TestCSRF_PostWithMatchingTokens(t *testing.T) {
	cfg := testCSRFCfg()
	status, called := callCSRF(t, http.MethodPost, "/posts", cfg, nil, "token-abc", "token-abc")
	assert.Equal(t, http.StatusOK, status)
	assert.True(t, called, "匹配的 token 应放行")
}

// TestCSRF_PostWithoutHeader 缺失 X-CSRF-Token header → 403
func TestCSRF_PostWithoutHeader(t *testing.T) {
	cfg := testCSRFCfg()
	status, called := callCSRF(t, http.MethodPost, "/posts", cfg, nil, "", "token-abc")
	assert.Equal(t, http.StatusForbidden, status)
	assert.False(t, called, "缺失 header 不应调用下游")
}

// TestCSRF_PostWithoutCookie 缺失 mimo_csrf cookie → 403
func TestCSRF_PostWithoutCookie(t *testing.T) {
	cfg := testCSRFCfg()
	status, called := callCSRF(t, http.MethodPost, "/posts", cfg, nil, "token-abc", "")
	assert.Equal(t, http.StatusForbidden, status)
	assert.False(t, called, "缺失 cookie 不应调用下游")
}

// TestCSRF_PostWithMismatchedTokens cookie 与 header 不等 → 403
// 这是 CSRF 攻击的典型场景：攻击者只能伪造 header（如 query 参数），
// 但无法让其与受害者的 cookie 值匹配
func TestCSRF_PostWithMismatchedTokens(t *testing.T) {
	cfg := testCSRFCfg()
	status, called := callCSRF(t, http.MethodPost, "/posts", cfg, nil, "attacker-forged", "real-user-token")
	assert.Equal(t, http.StatusForbidden, status)
	assert.False(t, called, "不匹配的 token 应拒绝")
}

// TestCSRF_PostWithoutEither 完全无凭据 → 403
func TestCSRF_PostWithoutEither(t *testing.T) {
	cfg := testCSRFCfg()
	status, called := callCSRF(t, http.MethodPost, "/posts", cfg, nil, "", "")
	assert.Equal(t, http.StatusForbidden, status)
	assert.False(t, called)
}

// TestCSRF_ExemptPathBypass 豁免路径 POST 也免验
// 用于确实无法用 CSRF 的端点（如第三方 webhook 回调，当前项目无）
func TestCSRF_ExemptPathBypass(t *testing.T) {
	cfg := testCSRFCfg()
	status, called := callCSRF(t, http.MethodPost, "/webhook", cfg, []string{"/webhook"}, "", "")
	assert.Equal(t, http.StatusOK, status)
	assert.True(t, called, "豁免路径应放行")
}

// TestCSRF_AllStateChangingMethodsRequired 所有写方法都校验
func TestCSRF_AllStateChangingMethodsRequired(t *testing.T) {
	cfg := testCSRFCfg()
	for _, m := range []string{http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete} {
		t.Run(m, func(t *testing.T) {
			status, _ := callCSRF(t, m, "/posts/1", cfg, nil, "", "")
			assert.Equal(t, http.StatusForbidden, status, "%s 应被 CSRF 校验", m)
		})
	}
}

// TestCSRF_ErrorResponseShape 错误响应格式与统一信封一致
// 必须包含 error/message 字段，前端按统一格式处理
func TestCSRF_ErrorResponseShape(t *testing.T) {
	cfg := testCSRFCfg()
	mw := CSRF(cfg, nil)
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))

	r := httptest.NewRequest(http.MethodPost, "/posts", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	body := w.Body.String()
	assert.Contains(t, body, `"error"`)
	assert.Contains(t, body, `"message"`)
	assert.Contains(t, body, "CSRF")
}

// TestCSRFTokensMatch_TableDriven 常量时间比较函数覆盖
func TestCSRFTokensMatch_TableDriven(t *testing.T) {
	cases := []struct {
		name string
		a, b string
		want bool
	}{
		{"both empty", "", "", false},
		{"a empty", "", "x", false},
		{"b empty", "x", "", false},
		{"equal", "token-abc", "token-abc", true},
		{"unequal same length", "token-abc", "token-xyz", false},
		{"unequal different length", "short", "longer-string", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, csrfTokensMatch(tc.a, tc.b))
		})
	}
}
