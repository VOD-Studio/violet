// Package observability 提供 mimo-music 的可观测性基础设施。
package observability

import (
	"context"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
)

// InitTracer 初始化 OTel tracer。
//
// Phase 1 使用 noop exporter：只为生成 trace_id 供日志关联，
// 不导出 span 数据到外部系统。
// Phase 3 接入真实 exporter（Jaeger / Tempo）和跨服务传播。
//
// 必须在 InitLogger 之前调用，确保 otel_handler 能拿到有效 SpanContext。
func InitTracer() (shutdown func(context.Context) error, err error) {
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.TraceContext{})

	return tp.Shutdown, nil
}

// StartSpan 在当前 context 上开启一个新 span，返回带 span 的 context 和 span。
//
// 供 handler / service 在关键操作处调用，自动生成 trace_id 注入日志。
func StartSpan(ctx context.Context, name string) (context.Context, trace.Span) {
	return otel.Tracer("mimo-music").Start(ctx, name)
}
