// Package worker 提供 mimo-music 的异步任务 worker。
package worker

import (
	"context"
	"testing"

	"github.com/hibiken/asynq"
	"go.opentelemetry.io/otel"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
)

// TestTraceMiddleware_CreatesSpan 验证 TraceMiddleware 为任务创建 span。
func TestTraceMiddleware_CreatesSpan(t *testing.T) {
	memExp := tracetest.NewInMemoryExporter()
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSyncer(memExp),
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
	)
	originalTP := otel.GetTracerProvider()
	otel.SetTracerProvider(tp)
	defer func() {
		otel.SetTracerProvider(originalTP)
		_ = tp.Shutdown(context.Background())
	}()

	// 模拟任务被处理
	called := false
	inner := asynq.HandlerFunc(func(ctx context.Context, t *asynq.Task) error {
		called = true
		return nil
	})
	wrapped := TraceMiddleware(inner)

	task := asynq.NewTask("cookie:health", nil)
	if err := wrapped.ProcessTask(context.Background(), task); err != nil {
		t.Fatalf("处理任务不应报错：%v", err)
	}
	if !called {
		t.Fatal("内部 handler 应被调用")
	}

	spans := memExp.GetSpans()
	if len(spans) != 1 {
		t.Fatalf("应导出 1 个 span，得到 %d", len(spans))
	}
	want := "asynq cookie:health"
	if spans[0].Name != want {
		t.Fatalf("span 命名不符：得到 %q，期望 %q", spans[0].Name, want)
	}
	// 任务 span 应是根 span（定时任务无上游 trace）
	if spans[0].Parent.IsValid() {
		t.Fatal("任务 span 应是根 span（无 parent）")
	}
}
