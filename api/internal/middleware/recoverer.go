package middleware

import (
	"net/http"
	"runtime/debug"

	"github.com/rs/zerolog/log"
)

// Recoverer panic 恢复中间件
// 捕获处理器中的 panic，返回 500 错误而非崩溃
func Recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				// 记录 panic 信息和堆栈
				log.Error().
					Str("method", r.Method).
					Str("path", r.URL.Path).
					Str("ip", getClientIP(r)).
					Interface("panic", err).
					Str("stack", string(debug.Stack())).
					Msg("捕获 panic")

				// 返回 500 错误响应
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte(`{"error":"服务器内部错误"}`))
			}
		}()

		next.ServeHTTP(w, r)
	})
}
