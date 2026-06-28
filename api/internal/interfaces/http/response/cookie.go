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
	"time"

	"blog-api/config"
)

// AuthCookieMaxAge access token Cookie 的 MaxAge（秒）
// 与 JWTAccessTokenTTL 解耦：取一个保守的固定值，实际过期以 JWT claims 为准
// 设置 1 小时避免每次请求都重写 Cookie，同时不让 Cookie 比 JWT 活得太久
const AuthCookieMaxAge = 3600

// RefreshCookiePath refresh token Cookie 的 Path。
//
// 必须匹配 refresh/logout 路由的实际挂载路径（chi 以 full path 匹配 cookie）：
//   r.Route("/api/v1", ...) → v1.Route("/auth", ...) → /api/v1/auth/*
// Cookie Path 是 URL 路径前缀，浏览器仅当请求路径等于或位于该前缀下时才发送。
// 历史上误写为 "/auth"，导致请求 /api/v1/auth/refresh 时浏览器不附带 refresh
// cookie，后端读到"缺少 refresh_token"。Set 与 Clear 必须用同一值，否则无法清除。
const RefreshCookiePath = "/api/v1/auth"

// SetAuthTokenCookies 下发 access + refresh 两个 HttpOnly Cookie
//
// 同时下发一个非 HttpOnly 的 CSRF double-submit Cookie（供前端读取回传 X-CSRF-Token）。
// 必须在 WriteHeader（即 RespondOK / RespondMessage）之前调用。
//
// 参数：
//   - w: HTTP 响应写入器
//   - access: access token 字符串
//   - refresh: refresh token 字符串
//   - csrfToken: CSRF double-submit token（由上层生成，见 middleware/csrf.go）
//   - cfg: Cookie 配置
func SetAuthTokenCookies(w http.ResponseWriter, access, refresh, csrfToken string, cfg config.CookieConfig) {
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

	// refresh token：HttpOnly（JS 不可读）+ 长 MaxAge（与 JWTRefreshTokenTTL 对齐）
	// Path 限定 /api/v1/auth：仅 refresh/logout 路由会收到，缩小暴露面。
	refreshCookie := &http.Cookie{
		Name:     cfg.RefreshName,
		Value:    refresh,
		Path:     RefreshCookiePath,
		Domain:   cfg.Domain,
		MaxAge:   int((168 * time.Hour).Seconds()), // 7 天，与默认 refresh TTL 一致
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
			MaxAge:   AuthCookieMaxAge,
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
