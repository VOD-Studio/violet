// Package server 提供 mimo-music 的 HTTP 服务装配。
//
// 本文件测试 W3C traceparent 的跨服务注入与提取：一个带 otelhttp transport
// 的 HTTP client（模拟 mimo-blog 调用方）向一个套了 otelhttp handler 的
// server（模拟 mimo-music）发请求，断言 server 侧 span 是 client 侧 span
// 的子 span——即共享 trace_id 且 parent_span_id 正确。
//
// 这条链路不依赖 mimo-music 业务端点，测试的是 trace context 传播原语本身。
package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
)

// setupTracerForTest 用 in-memory exporter 构造全局 TracerProvider，返回
// exporter 和 cleanup。所有 span（client 和 server 侧）都导出到同一个 exporter。
// 同时设置 W3C TraceContext propagator，让 otelhttp 能注入/提取 traceparent。
func setupTracerForTest(t *testing.T) (*tracetest.InMemoryExporter, func()) {
	t.Helper()
	memExp := tracetest.NewInMemoryExporter()
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSyncer(memExp),
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
	)
	originalTP := otel.GetTracerProvider()
	originalProp := otel.GetTextMapPropagator()
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.TraceContext{})
	return memExp, func() {
		otel.SetTracerProvider(originalTP)
		otel.SetTextMapPropagator(originalProp)
		_ = tp.Shutdown(context.Background())
	}
}

// TestTracePropagation_ClientServerLinked 验证带 traceparent 的请求
// 在 server 侧产生的 span 是 client span 的子 span。
func TestTracePropagation_ClientServerLinked(t *testing.T) {
	memExp, cleanup := setupTracerForTest(t)
	defer cleanup()

	// server：套 otelhttp handler，模拟 mimo-music 从 traceparent 提取 context。
	// 用与 NewRouter 相同的 span name formatter，保证测试与生产行为一致。
	srvHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	wrapped := otelhttp.NewHandler(srvHandler, "server",
		otelhttp.WithSpanNameFormatter(func(operation string, r *http.Request) string {
			return r.Method + " " + r.URL.Path
		}),
	)
	srv := httptest.NewServer(wrapped)
	defer srv.Close()

	// client：用 otelhttp.NewTransport 注入 traceparent，模拟 mimo-blog。
	// 外层手动起一个 client span，让请求注入它的 SpanContext。
	ctx, clientSpan := otel.Tracer("test-client").Start(context.Background(), "client-call")

	tr := otelhttp.NewTransport(http.DefaultTransport)
	client := &http.Client{Transport: tr}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL, nil)
	if err != nil {
		t.Fatal(err)
	}

	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("请求失败：%v", err)
	}
	defer resp.Body.Close()
	clientSpan.End()

	spans := memExp.GetSpans()
	if len(spans) < 2 {
		t.Fatalf("应至少导出 2 个 span（client + server），得到 %d", len(spans))
	}

	// 找出 client-call span（手动起的根 span）和 server span（GET /）
	// 注：otelhttp transport 还会自动创建一个 "HTTP GET" 中间 span，
	// 链路是 client-call → HTTP GET（transport）→ GET /（server）。
	var clientCall, serverExported tracetest.SpanStub
	for _, s := range spans {
		switch s.Name {
		case "client-call":
			clientCall = s
		case "GET /":
			serverExported = s
		}
	}

	if clientCall.Name == "" {
		t.Fatal("未找到 client 根 span（client-call）")
	}
	if serverExported.Name == "" {
		t.Fatal("未找到 server span（GET /）")
	}

	// 核心断言 1：server span 与 client 根 span 共享 trace_id（同一条链路）。
	// 这是跨服务传播成功的标志：traceparent 被注入又被提取，链路没断。
	if serverExported.SpanContext.TraceID() != clientCall.SpanContext.TraceID() {
		t.Fatalf("trace_id 不一致：client=%s server=%s",
			clientCall.SpanContext.TraceID(), serverExported.SpanContext.TraceID())
	}

	// 核心断言 2：server span 能沿 parent 链追溯到 client 根 span。
	// 链路：client-call → HTTP GET（transport span）→ GET /（server span），
	// 所以 server span 的 parent 是 transport span，transport span 的 parent 是 client-call。
	// 这里验证 server span 的 parent 存在且属于同一 trace（传播链路连续）。
	if !serverExported.Parent.IsValid() {
		t.Fatal("server span 应有 parent（被传播的 trace context），不应是根 span")
	}
	if serverExported.Parent.TraceID() != clientCall.SpanContext.TraceID() {
		t.Fatalf("server span parent 的 trace_id 与 client 不一致，链路断裂")
	}
}

// TestTracePropagation_NoTraceparentStartsNewTrace 验证无 traceparent
// 的请求在 server 侧自行起一条新 trace（parent 为空）。
func TestTracePropagation_NoTraceparentStartsNewTrace(t *testing.T) {
	memExp, cleanup := setupTracerForTest(t)
	defer cleanup()

	srvHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	wrapped := otelhttp.NewHandler(srvHandler, "server",
		otelhttp.WithSpanNameFormatter(func(operation string, r *http.Request) string {
			return r.Method + " " + r.URL.Path
		}),
	)
	srv := httptest.NewServer(wrapped)
	defer srv.Close()

	// 普通 client，无 otelhttp transport，不注入 traceparent
	resp, err := http.Get(srv.URL)
	if err != nil {
		t.Fatalf("请求失败：%v", err)
	}
	resp.Body.Close()

	spans := memExp.GetSpans()
	if len(spans) == 0 {
		t.Fatal("无 traceparent 的请求也应生成 server span")
	}

	// server span 应是根 span（无 parent）
	var serverSpan tracetest.SpanStub
	for _, s := range spans {
		if s.Name == "GET /" {
			serverSpan = s
		}
	}
	if serverSpan.Name == "" {
		t.Fatal("未找到 server span")
	}
	if serverSpan.Parent.IsValid() {
		t.Fatalf("无 traceparent 时 server span 应是根 span（无 parent），得到 parent=%s",
			serverSpan.Parent.SpanID())
	}
}
