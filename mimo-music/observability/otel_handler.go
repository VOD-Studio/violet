// Package observability 提供 mimo-music 的可观测性基础设施。
package observability

import (
	"context"
	"log/slog"

	"go.opentelemetry.io/otel/trace"
)

// otelHandler 包装 slog.Handler，从 ctx 的 SpanContext 提取 trace_id / span_id
// 自动注入每条日志。
//
// 这样在 Loki / Grafana 里可以从一条日志直接跳到对应 trace 瀑布图，
// 实现"日志-指标-追踪"三支柱打通。
type otelHandler struct {
	next slog.Handler
}

func newOtelHandler(next slog.Handler) slog.Handler {
	return &otelHandler{next: next}
}

// Handle 从 ctx 提取 trace 信息注入日志 record。
func (h *otelHandler) Handle(ctx context.Context, r slog.Record) error {
	if span := trace.SpanFromContext(ctx); span.SpanContext().IsValid() {
		r.AddAttrs(
			slog.String(FieldTraceID, span.SpanContext().TraceID().String()),
			slog.String(FieldSpanID, span.SpanContext().SpanID().String()),
		)
	}
	return h.next.Handle(ctx, r)
}

// WithAttrs 委托给下层 handler。
func (h *otelHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &otelHandler{next: h.next.WithAttrs(attrs)}
}

// WithGroup 委托给下层 handler。
func (h *otelHandler) WithGroup(name string) slog.Handler {
	return &otelHandler{next: h.next.WithGroup(name)}
}

// Enabled 委托给下层 handler。
func (h *otelHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.next.Enabled(ctx, level)
}
