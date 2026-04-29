package middleware

import (
	"log"
	"net/http"
	"time"
)

// responseWriter 包装 http.ResponseWriter 以捕获状态码
type responseWriter struct {
	http.ResponseWriter
	// statusCode HTTP 响应状态码
	statusCode int
}

// WriteHeader 重写 WriteHeader 方法，记录状态码
func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// Logger 请求日志中间件
// 记录每个请求的 HTTP 方法、路径、状态码和处理耗时
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 记录请求开始时间
		start := time.Now()

		// 包装 ResponseWriter 以捕获状态码
		wrapped := &responseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		// 将请求传递给下一个处理器
		next.ServeHTTP(wrapped, r)

		// 计算请求处理耗时
		duration := time.Since(start)

		// 输出请求日志
		log.Printf("[%s] %s %s -> %d (%v)",
			r.Method,
			r.URL.Path,
			r.RemoteAddr,
			wrapped.statusCode,
			duration,
		)
	})
}
