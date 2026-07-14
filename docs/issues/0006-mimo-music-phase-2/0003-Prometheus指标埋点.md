# Issue-0003：Prometheus 指标埋点

## Parent

PRD：`../../prd/0006-mimo-music-phase-2.md`（user story 4；Implementation Decisions - Prometheus metrics）

## What to build

`observability/metrics.go` 定义 Phase 2 全量指标：request_total / request_duration / cache_hits / cache_misses / upstream_errors / upstream_latency / cookie_health_status。server middleware 记录 HTTP 请求指标（量 + 耗时），service 层在缓存命中/未命中、上游调用处埋点，worker 在 Cookie 健康检查结果处更新 cookie_health_status。新增 `GET /metrics` 端点暴露 Prometheus 文本格式。这是可观测性的主干——所有后续切片（装饰器、轮换）的状态都靠这些指标暴露。

## Acceptance criteria

- [ ] `observability/metrics.go` 定义 7 个指标（counter / histogram / gauge 类型正确）
- [ ] server middleware 记录 request_total（按 method/path/status 标签）和 request_duration
- [ ] service 层埋点 cache_hits / cache_misses / upstream_errors / upstream_latency
- [ ] cookie_health_status gauge 反映 worker 健康检查结果
- [ ] `GET /metrics` 端点暴露 Prometheus 文本格式（无认证，供 scrape）
- [ ] 指标递增测试：构造缓存命中/未命中、上游成功/失败场景，断言 counter 递增
- [ ] 指标命名遵循 Prometheus 规范（`mimomusic_*` 前缀、snake_case、带 help）
- [ ] 所有导出符号有 godoc 注释

## Blocked by

无 —— 可与 Issue-0001 并行，独立于 Redis。
