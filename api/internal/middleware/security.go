// Package middleware 提供 HTTP 中间件，处理认证、日志、限流等横切关注点
package middleware

import (
	"net/http"

	"github.com/rs/zerolog/log"
)

// SecurityHeaders HTTP 安全头中间件
// 设置安全相关的响应头以增强应用安全性
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 防止 MIME 类型嗅探
		w.Header().Set("X-Content-Type-Options", "nosniff")
		// 禁止页面被嵌入到 iframe 中
		w.Header().Set("X-Frame-Options", "DENY")
		// 控制 Referrer 信息泄露
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		// 禁用浏览器权限 API
		w.Header().Set("Permissions-Policy", "geolocation=(), camera=(), microphone=()")

		log.Debug().
			Str("method", r.Method).
			Str("path", r.URL.Path).
			Msg("应用安全头")

		next.ServeHTTP(w, r)
	})
}
