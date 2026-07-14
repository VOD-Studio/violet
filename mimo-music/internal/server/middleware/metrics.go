// Package middleware 提供 mimo-music HTTP 服务的横切中间件。
package middleware

import (
	"net/http"
	"strconv"
	"time"

	"github.com/VOD-Studio/mimo-music/observability"
)

// ensureRecorder 确保 ResponseWriter 被 statusRecorder 包装。
//
// 多个中间件（Logging / Metrics）都需要读状态码，
// 已包装时直接复用，避免双重包装导致外层读不到内层状态。
func ensureRecorder(w http.ResponseWriter) *statusRecorder {
	if rec, ok := w.(*statusRecorder); ok {
		return rec
	}
	return &statusRecorder{ResponseWriter: w, status: 200}
}

// Metrics 是 Prometheus 指标中间件。
//
// 记录每个请求的 request_total（按 method / path / status 标签）
// 和 request_duration。path 用实际 URL 路径，端点固定不会产生高基数。
func Metrics(m *observability.Metrics) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rec := ensureRecorder(w)
			start := time.Now()
			next.ServeHTTP(rec, r)
			elapsed := time.Since(start).Seconds()

			m.RequestTotal.WithLabelValues(r.Method, r.URL.Path, strconv.Itoa(rec.status)).Inc()
			m.RequestDuration.WithLabelValues(r.Method, r.URL.Path).Observe(elapsed)
		})
	}
}
