package middleware

import (
	"log"
	"net/http"
	"runtime/debug"
)

// Recoverer panic 恢复中间件
// 捕获处理器中的 panic，返回 500 错误而非崩溃
func Recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				// 输出 panic 信息和堆栈
				log.Printf("[PANIC] %v\n%s", err, debug.Stack())

				// 返回 500 错误响应
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte(`{"error":"服务器内部错误"}`))
			}
		}()

		next.ServeHTTP(w, r)
	})
}
