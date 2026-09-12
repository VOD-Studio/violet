package middleware

import (
	"fmt"
	"net/http"
	"runtime/debug"

	"github.com/rs/zerolog/log"
)

func Recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Error().
					Str("source", "http").
					Str("request_id", GetRequestID(r)).
					Str("method", r.Method).
					Str("path", r.URL.Path).
					Str("ip", getClientIP(r)).
					Str("error", fmt.Sprint(err)).
					Str("stack", string(debug.Stack())).
					Msg("捕获 panic")

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte(`{"error":"服务器内部错误"}`))
			}
		}()

		next.ServeHTTP(w, r)
	})
}
