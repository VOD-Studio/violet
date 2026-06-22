// Package middleware 提供 HTTP 中间件，处理认证、日志、限流等横切关注点
package middleware

import (
	"net/http"

	"github.com/go-chi/cors"
	"github.com/rs/zerolog/log"
)

// CORSOption CORS 中间件的可选配置
type CORSOption func(*cors.Options)

// WithCSRFHeader 在 AllowedHeaders 中追加 CSRF 自定义请求头
//
// double-submit CSRF 防护要求前端在请求中携带 X-CSRF-Token，
// 浏览器预检（OPTIONS）会校验该 header 是否在 AllowedHeaders 中，缺失会导致请求被拒。
func WithCSRFHeader(header string) CORSOption {
	return func(o *cors.Options) {
		o.AllowedHeaders = append(o.AllowedHeaders, header)
	}
}

// NewCORS 创建跨域资源共享中间件
//
// allowedOrigins 必须是显式来源列表（禁止使用 "*"，因为 AllowCredentials=true 时
// go-chi/cors 会拒绝通配符，浏览器也会拒绝携带 Cookie）。
// opts 用于追加自定义 header（如 CSRF）。
func NewCORS(allowedOrigins []string, opts ...CORSOption) func(http.Handler) http.Handler {
	options := cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Requested-With"},
		ExposedHeaders:   []string{"X-Total-Count"},
		AllowCredentials: true, // 必须 true，Cookie 才能跨域携带
		MaxAge:           300,
	}
	for _, opt := range opts {
		opt(&options)
	}

	corsHandler := cors.Handler(options)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" && r.Method == "OPTIONS" {
				log.Debug().
					Str("origin", origin).
					Str("method", r.Method).
					Str("path", r.URL.Path).
					Msg("CORS 预检请求")
			}
			corsHandler(next).ServeHTTP(w, r)
		})
	}
}

// CORS 默认 CORS 中间件（向后兼容）
//
// Deprecated: 改用 NewCORS(allowedOrigins) 以使用配置驱动的来源列表。
// 保留是为了不破坏现有测试与未迁移的调用点。
func CORS(next http.Handler) http.Handler {
	return NewCORS([]string{
		"http://localhost:3000",
		"http://localhost:5173",
	})(next)
}
