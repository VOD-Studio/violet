// Package middleware 提供 HTTP 中间件，处理认证、日志、限流等横切关注点
package middleware

import (
	"net/http"

	"github.com/go-chi/cors"
	"github.com/rs/zerolog/log"
)

// CORS 跨域资源共享中间件
// 允许前端应用跨域访问 API 接口
func CORS(next http.Handler) http.Handler {
	corsHandler := cors.Handler(cors.Options{
		// 允许的前端域名列表，生产环境应替换为实际域名
		AllowedOrigins: []string{
			"http://localhost:3000",  // Next.js 开发服务器
			"http://localhost:5173",  // Vite 开发服务器
			"https://yourdomain.com", // 生产环境域名
		},
		// 允许的 HTTP 方法
		AllowedMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		// 允许的请求头
		AllowedHeaders: []string{"Accept", "Authorization", "Content-Type", "X-Requested-With"},
		// 允许前端读取的响应头
		ExposedHeaders: []string{"X-Total-Count"},
		// 允许携带 Cookie 等凭证信息
		AllowCredentials: true,
		// 预检请求缓存时间，单位秒
		MaxAge: 300,
	})

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
