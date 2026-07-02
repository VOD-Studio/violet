// Package middleware 内的 CSRF 防护
//
// 采用 double-submit cookie 模式（OWASP 推荐）：
//
//  1. 后端在 login/refresh 时下发非 HttpOnly 的 mimo_csrf cookie（已在 step 1 实现）
//  2. 前端 JS 读取该 cookie 值，在每个写请求的 X-CSRF-Token header 中回传
//  3. 本中间件校验 cookie 值与 header 值相等，否则拒绝
//
// 安全性原理：攻击者诱导用户访问 evil.com 时，虽然浏览器会自动携带 mimo_csrf cookie
// 到 API，但 evil.com 的 JS 受同源策略限制无法读取 api 的 cookie 内容，
// 因此无法构造 X-CSRF-Token header 与 cookie 值匹配。
//
// 注意事项：
//   - 仅保护 state-changing 方法（POST/PUT/PATCH/DELETE），GET/HEAD/OPTIONS 免验
//   - cookie 与 header 值用 subtle.ConstantTimeCompare 比较，防时序攻击
//   - 与 SameSite=Lax（cookie 默认）形成纵深防御
package middleware

import (
	"crypto/subtle"
	"net/http"

	"blog-api/config"
	"blog-api/internal/interfaces/http/response"

	"github.com/rs/zerolog/log"
)

// CSRFHeaderName 前端回传 CSRF token 的请求头名
//
// 必须在 CORS AllowedHeaders 中（已在 main.go 通过 WithCSRFHeader 配置）
const CSRFHeaderName = "X-CSRF-Token"

// safeMethods 免验 CSRF 的 HTTP 方法（幂等且不改状态）
var safeMethods = map[string]bool{
	http.MethodGet:     true,
	http.MethodHead:    true,
	http.MethodOptions: true,
}

// CSRF double-submit cookie 校验中间件
//
// 参数：
//   - cookieCfg: 用于读取 CSRF cookie 名
//   - exemptPaths: 额外豁免的路径前缀（如 "/auth/csrf-token" 取 token 端点本身）
//
// 校验顺序：
//  1. GET/HEAD/OPTIONS 直接放行
//  2. 路径在豁免列表中直接放行
//  3. 读 X-CSRF-Token header 与 mimo_csrf cookie，缺失或不等 → 403
//
// 为什么不豁免 /auth/login：login CSRF 是真实攻击向量（攻击者用受害者身份
// 绑定攻击者密码的账号），必须防护。未登录访问通过先 GET /auth/csrf-token 取 cookie。
func CSRF(cookieCfg config.CookieConfig, exemptPaths []string) func(http.Handler) http.Handler {
	exemptSet := make(map[string]bool, len(exemptPaths))
	for _, p := range exemptPaths {
		exemptSet[p] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 1. 幂等方法免验
			if safeMethods[r.Method] {
				next.ServeHTTP(w, r)
				return
			}

			// 2. 显式豁免路径
			if exemptSet[r.URL.Path] {
				next.ServeHTTP(w, r)
				return
			}

			// 3. 提取 header 与 cookie 值
			headerToken := r.Header.Get(CSRFHeaderName)
			var cookieToken string
			if c, err := r.Cookie(cookieCfg.CSRFName); err == nil {
				cookieToken = c.Value
			}

			// 4. 校验：两者都存在且相等
			if !csrfTokensMatch(cookieToken, headerToken) {
				log.Warn().
					Str("method", r.Method).
					Str("path", r.URL.Path).
					Str("ip", getClientIP(r)).
					Bool("has_cookie", cookieToken != "").
					Bool("has_header", headerToken != "").
					Msg("CSRF 校验失败")
				respondCSRFError(w, r)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// csrfTokensMatch 用常量时间比较防时序攻击
//
// 要求：
//   - 两值长度均 > 0
//   - 两值相等
//
// subtle.ConstantTimeCompare 返回 1 表示相等；长度不同时立即返回 0，
// 长度信息会泄露但 token 本身是随机串，长度泄露不构成威胁。
func csrfTokensMatch(a, b string) bool {
	if len(a) == 0 || len(b) == 0 {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// respondCSRFError 返回 403 + 统一错误格式
//
// 用 response.WriteJSON 写入，保持与 RespondError 一致的错误信封
func respondCSRFError(w http.ResponseWriter, r *http.Request) {
	resp := struct {
		Error     string `json:"error"`
		Message   string `json:"message"`
		RequestID string `json:"request_id,omitempty"`
	}{
		Error:     "FORBIDDEN",
		Message:   "CSRF 校验失败：缺少或无效的 X-CSRF-Token",
		RequestID: response.GetRequestID(r),
	}
	response.WriteJSON(w, http.StatusForbidden, resp)
}
