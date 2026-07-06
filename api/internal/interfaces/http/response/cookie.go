// Package response 内的 Cookie 辅助函数
//
// 集中管理鉴权 Cookie 的下发/清除，保证所有 handler 使用一致的 Secure/SameSite/HttpOnly
// 策略。auth handler 在调用 RespondOK / RespondMessage 之前调用本文件函数：
//
//	response.SetSessionCookie(w, sess.SessionID, sess.CSRFToken, out.UserID, cfg, idleTTL)
//	response.RespondOK(w, body)
package response

import (
	"net/http"
	"time"

	"blog-api/config"
)

// CSRFCookieMaxAge CSRF double-submit Cookie 的 MaxAge（秒）
//
// 取 7 天，与默认 session idle TTL 对齐，确保 CSRF Cookie 覆盖整个 session 生命周期，
// 让用户在 7 天活跃窗口内做任何写操作都不会因 CSRF Cookie 先过期而被 403。
// CSRF Cookie 在每次 login 时都会重发（随 session cookie），活跃用户实际不会见到它过期。
const CSRFCookieMaxAge = 7 * 24 * 3600

// UIDCookieName 前端可读的 user_id Cookie 名。
// 供不挂 useMe 的轻量组件直接读取当前 user_id（如评论卡片判断是不是自己发的）。
const UIDCookieName = "mimo_uid"

// SetSessionCookie 下发 opaque session 相关 Cookie：mimo_session(HttpOnly) + mimo_csrf + mimo_uid。
//
// session id 经 HttpOnly Cookie 传递，前端不读取；mimo_csrf 供前端回传 X-CSRF-Token；
// mimo_uid 供前端轻量组件直接读 user_id。必须在 WriteHeader 前调用。
// MaxAge 取 idleTTL，与 session 滑动续期窗口对齐，活跃用户 cookie 随 session 一起续命。
func SetSessionCookie(w http.ResponseWriter, sessionID, csrfToken, userID string, cfg config.CookieConfig, idleTTL time.Duration) {
	http.SetCookie(w, &http.Cookie{
		Name: cfg.SessionName, Value: sessionID, Path: "/",
		Domain: cfg.Domain, MaxAge: int(idleTTL.Seconds()),
		Secure: cfg.Secure, HttpOnly: true, SameSite: cfg.SameSiteMode(),
	})
	if csrfToken != "" {
		http.SetCookie(w, &http.Cookie{
			Name: cfg.CSRFName, Value: csrfToken, Path: "/",
			Domain: cfg.Domain, MaxAge: int(idleTTL.Seconds()),
			Secure: cfg.Secure, HttpOnly: false, SameSite: cfg.SameSiteMode(),
		})
	}
	if userID != "" {
		http.SetCookie(w, &http.Cookie{
			Name: UIDCookieName, Value: userID, Path: "/",
			Domain: cfg.Domain, MaxAge: int(idleTTL.Seconds()),
			Secure: cfg.Secure, HttpOnly: false, SameSite: cfg.SameSiteMode(),
		})
	}
}

// ClearSessionCookies 清除 mimo_session + mimo_csrf + mimo_uid。
// MaxAge=-1 让浏览器立即删除；logout 与 session 失效时调用。
// 三个 Cookie 的 Path 必须与 SetSessionCookie 一致，否则浏览器不会删除。
func ClearSessionCookies(w http.ResponseWriter, cfg config.CookieConfig) {
	for _, name := range []string{cfg.SessionName, cfg.CSRFName, UIDCookieName} {
		http.SetCookie(w, &http.Cookie{
			Name: name, Value: "", Path: "/",
			Domain: cfg.Domain, MaxAge: -1,
			Secure: cfg.Secure, HttpOnly: name == cfg.SessionName,
			SameSite: cfg.SameSiteMode(),
		})
	}
}
