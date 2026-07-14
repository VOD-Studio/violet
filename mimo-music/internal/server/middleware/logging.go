// Package middleware 提供 mimo-music HTTP 服务的横切中间件。
package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"

	"github.com/VOD-Studio/mimo-music/observability"
)

// ctxKeyRequestID 是 request_id 的 context key。
type ctxKeyRequestID struct{}

// statusRecorder 包装 ResponseWriter，捕获状态码。
type statusRecorder struct {
	http.ResponseWriter
	status int
}

// WriteHeader 捕获响应状态码。
func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// Logging 是 HTTP 访问日志中间件。
//
// 自动为每个请求生成 request_id，注入 context，
// 请求结束时记录访问日志（method / path / status / duration_ms / request_id）。
// 下游通过 observability.ContextLogger(ctx) 取出带 request_id 的 logger。
func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		reqID := middleware.GetReqID(r.Context())

		// 用 request_id 派生子 logger，存入 context 供下游取用
		reqLogger := slog.Default().With(slog.String(observability.FieldRequestID, reqID))
		ctx := observability.WithLogger(r.Context(), reqLogger)
		ctx = context.WithValue(ctx, ctxKeyRequestID{}, reqID)

		ww := &statusRecorder{ResponseWriter: w, status: 200}
		next.ServeHTTP(ww, r.WithContext(ctx))

		reqLogger.Info("http_request",
			slog.String(observability.FieldMethod, r.Method),
			slog.String(observability.FieldPath, r.URL.Path),
			slog.Int(observability.FieldStatus, ww.status),
			slog.Int64(observability.FieldDurationMS, time.Since(start).Milliseconds()),
		)
	})
}
