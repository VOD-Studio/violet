package middleware

import (
	"net/http"
	"time"

	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog/log"
)

func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		wrapped := chimiddleware.NewWrapResponseWriter(w, r.ProtoMajor)

		next.ServeHTTP(wrapped, r)

		duration := time.Since(start)
		status := wrapped.Status()
		if status == 0 {
			status = http.StatusOK
		}

		logger := log.Info()
		if status >= 500 {
			logger = log.Error()
		} else if status >= 400 {
			logger = log.Warn()
		}

		logger.
			Str("source", "http").
			Str("request_id", GetRequestID(r)).
			Str("method", r.Method).
			Str("path", r.URL.Path).
			Str("ip", getClientIP(r)).
			Int("status", status).
			Dur("duration", duration).
			Msg("HTTP 请求")
	})
}
