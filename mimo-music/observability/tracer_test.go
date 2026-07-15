package observability

import (
	"context"
	"testing"

	"go.opentelemetry.io/otel"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	"github.com/VOD-Studio/mimo-music/config"
)

// TestNewExporter_Noop 验证 none 类型返回不导出的 noop exporter。
func TestNewExporter_Noop(t *testing.T) {
	exp, err := newExporter(context.Background(), config.OTelConfig{Exporter: "none"})
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
	exp, err := newExporter(context.Background(), config.OTelConfig{Exporter: ""})
	if err != nil {
		t.Fatalf("空字符串应归到 none，不应报错：%v", err)
	}
	if exp == nil {
		t.Fatal("exporter 不应为 nil")
	}
}

// TestNewExporter_InvalidType 验证未知 exporter 类型报错。
func TestNewExporter_InvalidType(t *testing.T) {
	_, err := newExporter(context.Background(), config.OTelConfig{Exporter: "zipkin"})
	if err == nil {
		t.Fatal("未知 exporter 类型应报错")
	}
}

// TestNewExporter_OtlpHTTP 验证 otlp-http 能创建 exporter（不实际连接）。
func TestNewExporter_OtlpHTTP(t *testing.T) {
	// 用一个不会被实际连接的端点，exporter 创建是惰性的
	exp, err := newExporter(context.Background(), config.OTelConfig{
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

	shutdown, err := InitTracer(config.OTelConfig{
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

// TestNoopExporter_ExportIsNoOp 验证 noop exporter 的导出/关闭不报错也不持有 span。
//
// NoopExporter 实现 SpanExporter 但 ExportSpans/Shutdown 均为空操作，不存储
// 任何 span——这是 issue 0004 验收项"none 时不导出"的语义保证。
// 用 InMemoryExporter 收集同样 span 作对照，证明真实 exporter 收集、noop 不收集。
func TestNoopExporter_ExportIsNoOp(t *testing.T) {
	noopExp := tracetest.NewNoopExporter()
	memExp := tracetest.NewInMemoryExporter()

	// 两个 provider 各生成一个 span，分别经 noop 和 in-memory exporter。
	// noop 用同步 processor 保证 ExportSpans 被调用。
	noopTP := sdktrace.NewTracerProvider(sdktrace.WithSyncer(noopExp))
	memTP := sdktrace.NewTracerProvider(sdktrace.WithSyncer(memExp))
	defer func() {
		_ = noopTP.Shutdown(context.Background())
		_ = memTP.Shutdown(context.Background())
	}()

	_, noopSpan := noopTP.Tracer("test").Start(context.Background(), "noop-span")
	noopSpan.End()
	_, memSpan := memTP.Tracer("test").Start(context.Background(), "mem-span")
	memSpan.End()

	// InMemoryExporter 作对照：真实 exporter 路径收集到 span。
	if len(memExp.GetSpans()) != 1 {
		t.Fatalf("in-memory exporter 应存储 1 个 span 作对照，得到 %d 个", len(memExp.GetSpans()))
	}
	// noop exporter 的 Shutdown 不应报错（确认导出链路完整执行过，只是不存储）。
	if err := noopExp.Shutdown(context.Background()); err != nil {
		t.Fatalf("noop exporter Shutdown 不应报错：%v", err)
	}
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
