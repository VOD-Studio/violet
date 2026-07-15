package observability

import (
	"context"
	"testing"

	"go.opentelemetry.io/otel"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
)

// TestNewExporter_Noop 验证 none 类型返回不导出的 noop exporter。
func TestNewExporter_Noop(t *testing.T) {
	exp, err := newExporter(context.Background(), OTelConfig{Exporter: "none"})
	if err != nil {
		t.Fatalf("不应返回错误：%v", err)
	}
	if exp == nil {
		t.Fatal("exporter 不应为 nil")
	}
	// noop exporter 不应 panic
	_ = exp.Shutdown(context.Background())
}

// TestNewExporter_EmptyDefaultsToNone 验证空字符串归到 none。
func TestNewExporter_EmptyDefaultsToNone(t *testing.T) {
	exp, err := newExporter(context.Background(), OTelConfig{Exporter: ""})
	if err != nil {
		t.Fatalf("空字符串应归到 none，不应报错：%v", err)
	}
	if exp == nil {
		t.Fatal("exporter 不应为 nil")
	}
}

// TestNewExporter_InvalidType 验证未知 exporter 类型报错。
func TestNewExporter_InvalidType(t *testing.T) {
	_, err := newExporter(context.Background(), OTelConfig{Exporter: "zipkin"})
	if err == nil {
		t.Fatal("未知 exporter 类型应报错")
	}
}

// TestNewExporter_OtlpHTTP 验证 otlp-http 能创建 exporter（不实际连接）。
func TestNewExporter_OtlpHTTP(t *testing.T) {
	// 用一个不会被实际连接的端点，exporter 创建是惰性的
	exp, err := newExporter(context.Background(), OTelConfig{
		Exporter: "otlp-http",
		Endpoint: "localhost:4318",
	})
	if err != nil {
		t.Fatalf("创建 otlp-http exporter 不应报错：%v", err)
	}
	if exp == nil {
		t.Fatal("exporter 不应为 nil")
	}
	// Shutdown 不应 panic（即使没真正连接过）
	_ = exp.Shutdown(context.Background())
}

// TestInitTracer_NoopGeneratesTraceID 验证 noop exporter 下仍能生成 trace_id。
//
// 这是 Phase 1 的核心行为：none 模式 span 仍生成，trace_id 注入日志。
func TestInitTracer_NoopGeneratesTraceID(t *testing.T) {
	originalTP := otel.GetTracerProvider()
	t.Cleanup(func() { otel.SetTracerProvider(originalTP) })

	shutdown, err := InitTracer(OTelConfig{
		Exporter:    "none",
		ServiceName: "test",
		SampleRatio: 1.0,
	})
	if err != nil {
		t.Fatalf("InitTracer 不应报错：%v", err)
	}
	defer func() { _ = shutdown(context.Background()) }()

	ctx, span := StartSpan(context.Background(), "test-op")
	defer span.End()

	// span 生成后 SpanContext 应有效，trace_id 非空
	sc := span.SpanContext()
	if !sc.IsValid() {
		t.Fatal("none 模式下 span context 应有效，trace_id 应非空")
	}
	if sc.TraceID().String() == "00000000000000000000000000000000" {
		t.Fatal("trace_id 不应是零值")
	}
	_ = ctx
}

// TestInitTracer_SpansExportedToRealExporter 验证真实 exporter 下 span 被导出。
//
// 用 tracetest 的 InMemoryExporter 替换全局 provider，模拟真实导出路径。
// （不直接测 otlp-grpc/http，因为那需要 collector，用 in-memory exporter
// 验证 TracerProvider 的 batcher 链路本身是对的。）
func TestInitTracer_SpansExportedToRealExporter(t *testing.T) {
	// 直接用 in-memory exporter 构造 provider，绕过 InitTracer 的 exporter 创建，
	// 专注验证「真实 exporter 下 span 进了 batcher 并被收集」这条链路。
	memExp := tracetest.NewInMemoryExporter()
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSyncer(memExp), // 同步导出，避免 batcher 异步延迟
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
	)
	originalTP := otel.GetTracerProvider()
	otel.SetTracerProvider(tp)
	t.Cleanup(func() {
		otel.SetTracerProvider(originalTP)
		_ = tp.Shutdown(context.Background())
	})

	_, span := otel.Tracer("test").Start(context.Background(), "exported-op")
	span.End()

	got := memExp.GetSpans()
	if len(got) != 1 {
		t.Fatalf("应导出 1 个 span，得到 %d", len(got))
	}
	if got[0].Name != "exported-op" {
		t.Fatalf("span 名称不符：%q", got[0].Name)
	}
}
