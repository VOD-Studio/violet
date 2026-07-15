// Package observability 提供 mimo-music 的可观测性基础设施。
package observability

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	semconv "go.opentelemetry.io/otel/semconv/v1.41.0"
	"go.opentelemetry.io/otel/trace"

	"github.com/VOD-Studio/mimo-music/config"
)

// OTelConfig 是 tracer 初始化所需的配置。
//
// 从 config.OTelConfig 映射，避免 observability 反向依赖 config 包时
// 把整个 Config 拉进来（observability 只需要 OTel 段）。
//
// 实际上为简化依赖，这里直接接收 config.OTelConfig。如果未来 observability
// 需要脱离 config 包独立测试，再抽成本结构。
type OTelConfig = config.OTelConfig

// InitTracer 初始化 OTel tracer，按 config 选择 exporter。
//
// exporter 类型：
//   - none：noop exporter，不导出 span（本地开发默认）。
//   - otlp-grpc：通过 gRPC 发到 OTLP collector。
//   - otlp-http：通过 HTTP 发到 OTLP collector。
//
// sampler 用 ParentBased(TraceIDRatioBased)，既尊重上游采样决策
// 又能控制本地根 span 采样率。
//
// 必须在 InitLogger 之前调用，确保 otel_handler 能拿到有效 SpanContext。
func InitTracer(otelCfg OTelConfig) (shutdown func(context.Context) error, err error) {
	exp, err := newExporter(context.Background(), otelCfg)
	if err != nil {
		return nil, fmt.Errorf("创建 OTel exporter 失败: %w", err)
	}

	res, err := resource.Merge(
		resource.Default(),
		resource.NewWithAttributes(semconv.SchemaURL,
			semconv.ServiceName(otelCfg.ServiceName),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("创建 OTel resource 失败: %w", err)
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp),
		sdktrace.WithSampler(sdktrace.ParentBased(sdktrace.TraceIDRatioBased(otelCfg.SampleRatio))),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.TraceContext{})

	return tp.Shutdown, nil
}

// newExporter 按 exporter 类型创建 span exporter。
//
// none 返回 noop（Noop 模式：span 仍生成但不导出）；otlp-grpc / otlp-http
// 创建对应协议的 exporter，endpoint 是 collector 地址。
func newExporter(ctx context.Context, cfg OTelConfig) (sdktrace.SpanExporter, error) {
	switch cfg.Exporter {
	case "", "none":
		// 空字符串兜底归到 none，避免配置缺失时崩溃。
		// tracetest.NoopExporter 实现 SpanExporter 接口但不导出，
		// span 仍生成 trace_id 供日志关联，只是不发到外部后端。
		return tracetest.NewNoopExporter(), nil
	case "otlp-grpc":
		return otlptracegrpc.New(ctx,
			otlptracegrpc.WithEndpoint(cfg.Endpoint),
			// 本地开发常无 TLS，生产应在 collector 侧终止 TLS 后用 insecure，
			// 或改用 otlp-http + TLS。这里默认 insecure，由部署侧保证网络安全。
			otlptracegrpc.WithInsecure(),
		)
	case "otlp-http":
		return otlptracehttp.New(ctx,
			otlptracehttp.WithEndpoint(cfg.Endpoint),
			otlptracehttp.WithInsecure(),
		)
	default:
		return nil, fmt.Errorf("不支持的 OTel exporter 类型: %s", cfg.Exporter)
	}
}

// StartSpan 在当前 context 上开启一个新 span，返回带 span 的 context 和 span。
//
// 供 handler / service 在关键操作处调用，自动生成 trace_id 注入日志。
func StartSpan(ctx context.Context, name string) (context.Context, trace.Span) {
	return otel.Tracer("mimo-music").Start(ctx, name)
}
