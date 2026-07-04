// Package response 内的 Cookie 辅助函数
//
// 集中管理鉴权 Cookie 的下发/清除，保证所有 handler 使用一致的 Secure/SameSite/HttpOnly
// 策略。auth handler 在调用 RespondOK / RespondMessage 之前调用本文件函数：
//
//	response.SetAuthTokenCookies(w, pair, cfg)
//	response.RespondOK(w, body)
package response

import (
	"net/http"

	"blog-api/config"
)

// AuthCookieMaxAge access token Cookie 的 MaxAge（秒）
//
// 与 JWTAccessTokenTTL 故意解耦：Cookie 只是「信封」，真正的过期判据是 access JWT
// 的 exp claim（由 middleware.Auth 校验）。取一个比默认 access TTL（15m）更长的固定
// 值（1h），目的是让信封不必在每次 /auth/refresh 续期（每 15m 一次）时都被重写，
// 减少无谓的 Cookie 下发。代价是 access JWT 过期后信封仍残留约 45 分钟——无害，
// 因为过期的 JWT 会被中间件拒绝，残留 Cookie 不会造成越权。
const AuthCookieMaxAge = 3600

// CSRFCookieMaxAge CSRF double-submit Cookie 的 MaxAge（秒）
//
// 取 7 天，与默认 refresh token TTL 对齐，确保 CSRF Cookie 覆盖整个 refresh 生命周期。
// 注意：POST /auth/refresh 本身被显式豁免 CSRF 校验（见 main.go 豁免列表），所以
// 本常量保护的不是 refresh，而是其余所有写操作（logout、改密码、发文章等）——
// 让用户在 7 天 refresh 窗口内做任何写操作都不会因 CSRF Cookie 先过期而被 403。
// CSRF Cookie 在每次 login/refresh 时都会重发，活跃用户实际不会见到它过期。
const CSRFCookieMaxAge = 7 * 24 * 3600

// RefreshCookiePath refresh token Cookie 的 Path。
//
// 用 "/" 而非 "/api/v1/auth"：refresh cookie 必须对所有路由可见，否则 SSR 拿不到它。
// SSR server 收到的 cookie 来自浏览器加载页面时的请求（如 GET /posts），该请求路径
// 不在 /api/v1/auth 下，浏览器按 Path 前缀规则不会附带 Path=/api/v1/auth 的 cookie，
// 导致 SSR 转发给后端的请求缺少 refresh token → empty_refresh_token → 静默掉登录。
//
// 安全性不依赖 Path 限定：HttpOnly 防 JS 读取（XSS 偷不走），SameSite=lax 防 CSRF，
// Secure（生产）防明文传输。Path=/ 是业界（Supabase/Next-Auth/SuperTokens）的标准做法。
// Set 与 Clear 必须用同一值，否则浏览器不会删除。
const RefreshCookiePath = "/"

// SetAuthTokenCookies 下发 access + refresh 两个 HttpOnly Cookie
//
// 同时下发一个非 HttpOnly 的 CSRF double-submit Cookie（供前端读取回传 X-CSRF-Token）。
// 必须在 WriteHeader（即 RespondOK / RespondMessage）之前调用。
//
// refresh Cookie 的 MaxAge 取 ttls.Refresh，与其承载的 refresh JWT 的 exp 对齐，
// 避免「JWT 仍有效但 Cookie 已被浏览器删除」导致用户被迫重新登录。
// access Cookie 的 MaxAge 取 AuthCookieMaxAge（见其注释，与 access TTL 解耦）。
//
// 参数：
//   - w: HTTP 响应写入器
//   - access: access token 字符串
//   - refresh: refresh token 字符串
//   - csrfToken: CSRF double-submit token（由上层生成，见 middleware/csrf.go）
//   - cfg: Cookie 配置
//   - ttls: access/refresh JWT 过期时长（用于设置 refresh Cookie 的 MaxAge）
func SetAuthTokenCookies(w http.ResponseWriter, access, refresh, csrfToken string, cfg config.CookieConfig, ttls config.TokenTTLs) {
	// access token：HttpOnly（JS 不可读）+ 短 MaxAge
	accessCookie := &http.Cookie{
		Name:     cfg.AccessName,
		Value:    access,
		Path:     "/",
		Domain:   cfg.Domain,
		MaxAge:   AuthCookieMaxAge,
		Secure:   cfg.Secure,
		HttpOnly: true,
		SameSite: cfg.SameSiteMode(),
	}
	http.SetCookie(w, accessCookie)

	// refresh token：HttpOnly（JS 不可读）+ MaxAge 与 refresh JWT exp 对齐
	// Path=/：必须对所有路由可见，否则 SSR 拿不到（见 RefreshCookiePath 注释）。
	refreshCookie := &http.Cookie{
		Name:     cfg.RefreshName,
		Value:    refresh,
		Path:     RefreshCookiePath,
		Domain:   cfg.Domain,
		MaxAge:   int(ttls.Refresh.Seconds()),
		Secure:   cfg.Secure,
		HttpOnly: true,
		SameSite: cfg.SameSiteMode(),
	}
	http.SetCookie(w, refreshCookie)

	// CSRF double-submit：非 HttpOnly（前端 JS 必须能读取以回传 X-CSRF-Token）
	// Path 为 "/" 保证所有路由都能读到；安全分析见 middleware/csrf.go 注释
	if csrfToken != "" {
		csrfCookie := &http.Cookie{
			Name:     cfg.CSRFName,
			Value:    csrfToken,
			Path:     "/",
			Domain:   cfg.Domain,
			MaxAge:   CSRFCookieMaxAge,
			Secure:   cfg.Secure,
			HttpOnly: false,
			SameSite: cfg.SameSiteMode(),
		}
		http.SetCookie(w, csrfCookie)
	}
}

// ClearAuthCookies 清除 access + refresh + CSRF 三个 Cookie
//
// 通过设置 MaxAge=-1 让浏览器立即删除。logout handler 必须调用此函数。
// 三个 Cookie 的 Path 必须与 SetAuthTokenCookies 完全一致，否则浏览器不会删除。
func ClearAuthCookies(w http.ResponseWriter, cfg config.CookieConfig) {
	for _, c := range []struct {
		name     string
		path     string
		httpOnly bool
	}{
		{cfg.AccessName, "/", true},
		{cfg.RefreshName, RefreshCookiePath, true},
		{cfg.CSRFName, "/", false},
	} {
		http.SetCookie(w, &http.Cookie{
			Name:     c.name,
			Value:    "",
			Path:     c.path,
			Domain:   cfg.Domain,
			MaxAge:   -1,
			Secure:   cfg.Secure,
			HttpOnly: c.httpOnly,
			SameSite: cfg.SameSiteMode(),
		})
	}
}
