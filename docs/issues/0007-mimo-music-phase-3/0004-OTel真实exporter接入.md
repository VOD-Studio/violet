# Issue-0004：OTel 真实 exporter 接入

## Parent

PRD：`../../prd/0007-mimo-music-phase-3.md`（user story 5；Implementation Decisions - OTel 跨服务传播）

## What to build

把 `observability/tracer.go` 从 noop exporter 切到真实 OTLP exporter，让 span 真能发到 Tempo / Jaeger / Collector。当前 `InitTracer()` 的 `NewTracerProvider` 没传 `WithExporter`，span 只在进程内生成 trace_id 供日志关联，不导出。

本切片只做 exporter 侧：config 增加 OTel 段（exporter 类型 `none` / `otlp-grpc` / `otlp-http`、endpoint、service name、sample ratio），`InitTracer` 按 config 选择 exporter——`none` 保留 noop 行为作为本地开发默认值，`otlp-grpc` / `otlp-http` 创建对应 exporter 挂到 `BatchSpanProcessor`。sample ratio 用 `ParentBased(TraceIDRatioBased(r))`，既尊重上游采样决策又能控制本地根 span 采样率。shutdown 函数要保证 exporter flush，避免进程退出丢 span。

bootstrap 侧把 `InitTracer` 改成接收 config 参数（或新增 OTel provider set），server 和 worker 的 main.go 启动时用新签名初始化、defer shutdown。worker 虽然是 Asynq 任务驱动，同样需要独立 tracer provider 导出任务 span。

## Acceptance criteria

- [x] config 增加 `OTel` 段：`Exporter`（none / otlp-grpc / otlp-http）、`Endpoint`、`ServiceName`、`SampleRatio`
- [x] `config.Default()` 给 OTel 段默认值（Exporter=none、ServiceName=mimo-music、SampleRatio=1.0）
- [x] `config.Load()` 读 `MIMO_MUSIC_OTEL_*` 环境变量覆盖默认值
- [x] `observability/tracer.go` 的 `InitTracer` 按 exporter 类型构造：none 走 noop，otlp-grpc/otlp-http 走真实 exporter + BatchSpanProcessor
- [x] sampler 改为 `ParentBased(TraceIDRatioBased(SampleRatio))`，默认全采样
- [x] shutdown 函数保证 exporter flush（`tp.Shutdown` 前导出缓冲 span）
- [x] server 和 worker 的 main.go 用新签名初始化 tracer，defer shutdown
- [x] config.example.yaml 增加 OTel 配置示例
- [x] tracetest in-memory exporter 单测：非 none 类型时 span 被导出，none 时不导出
- [x] 所有导出符号有 godoc 注释

## Blocked by

无 —— 与 SDK 切片（0001-0003）无耦合，可并行。是 OTel 侧的入口切片。
