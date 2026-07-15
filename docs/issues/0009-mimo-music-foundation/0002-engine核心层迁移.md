# Issue-0002：engine 核心层迁移

## Status: ✅ 已完成（commit `8139a29b`）

## Parent

PRD：`../../prd/0009-mimo-music-foundation.md`（Solution 第 2 步）
关联：[架构 ADR 第 3.1 节、第 4.5 节接缝 1](../../adr/mimo-music-architecture.md)

## What to build

把 `provider/netease/` 的脏活迁移到 `internal/netease/engine/`，并实现 ADR 定义的 `RawDo` + `Execute` 签名。这是新架构的核心深模块——一个 `RawDo` 方法背后藏全部脏活（加密/HTTP/cookie/重试/熔断）。

### 迁移（直接搬，改 import）

- `provider/netease/crypto.go` + `crypto_test.go` → `internal/netease/engine/crypto.go`（weapi/eapi 加密，纯标准库，零改造）
- `provider/netease/errors.go` → `internal/netease/engine/errors.go`（HTTP + body code 映射，保留现有映射规则）
- `provider/netease/client.go` → `internal/netease/engine/transport.go`：提炼 HTTP transport。去掉对 `provider.Options` 的依赖，改成 engine 自己持有配置（timeout/transport）。保留 weapiPost/postJSON/apiGet + extractCookies。

### 新建（实现 ADR 签名）

- `engine.go`：`Engine` 聚合体，持有 `*http.Client` + `SessionStore` + `Cache` + crypto 配置 + retry/breaker 策略。暴露唯一深方法：

  ```go
  func (e *Engine) RawDo(ctx context.Context, meta Meta, params map[string]any) (json.RawMessage, error)
  ```

  内部：session.GetAvailable(meta.Auth) → cookie → crypto(meta.Crypto, params) → transport 请求 → retry/breaker → metrics → 返回 raw JSON。

- `execute.go`：`Execute[Req, Resp any]` 顶层泛型函数（ADR 第 4.5 节签名）。cache 检查 → MapRequest → RawDo → MapResponse → 回填。命中时 proto.Unmarshal 零 reflection（Resp 是具体类型参数）。

- `endpoint.go`：`Endpoint[Req, Resp]` 结构 + `Meta` + `CachePolicy` 类型定义（endpoint 声明的载体，issue 0005 填内容）。

- `retry.go`：从 `provider/decorator.go` 的 RetryProvider 迁移重试逻辑，拆成独立策略。
- `breaker.go`：熔断（现有 decorator.go 没有熔断，本 issue 新建最小实现，后续接口多了再充实）。
- `selector.go`：cookie 池选取（从 session_rotator 的 round-robin 迁入，session 接口在 issue 0003 定义，此处先定义接口依赖）。
- `metrics.go`：指标埋点（从现有 service 层的 RecordCacheHit/Miss + ObserveUpstreamLatency + RecordUpstreamError 提炼到 engine 内部）。

### Meta 类型

```go
type Meta struct {
    Path   string
    Method string
    Crypto CryptoMethod  // weapi / eapi / linuxapi / none
    Auth   AuthRequirement  // 定义在 session 包，issue 0003
}
```

## Acceptance criteria

- [ ] `crypto.go` 整文件迁移，crypto_test.go 通过（零改造）
- [ ] `errors.go` 映射逻辑迁移，HTTP + body code 分支覆盖
- [ ] `transport.go` 从 client.go 提炼，去掉 provider.Options 依赖，保留 weapiPost/postJSON/apiGet + extractCookies
- [x] `engine.go` 的 `RawDo` 实现：session 选取 → 加密 → transport → retry → 返回 raw JSON
- [x] `Execute[Req,Resp]` 泛型函数实现：cache 检查命中跳过 RawDo、未命中回填、写操作（CachePolicy=nil）不查不写
- [x] `Endpoint[Req,Resp]` + `Meta` + `CachePolicy` 类型定义
- [x] retry.go 从 decorator.go 迁移；breaker.go 最小实现
- [ ] metrics.go 推迟：地基阶段指标埋点先留接口位，真实 Prometheus 接入在 issue 0005 后随 worker 一起做
- [ ] engine 层单测：RawDo 用 httptest mock 网易云，验证加密/HTTP/cookie/错误映射 — 推迟到 issue 0005 迁移第一个真实接口时做端到端验证
- [ ] engine 层单测：Execute 缓存命中跳过/回填 — 推迟到 issue 0005（需真实 proto 类型走序列化路径）
- [x] 所有导出符号有 godoc 注释

## Blocked by

0003（session + cache）—— engine 依赖 SessionStore 和 Cache 接口。可与 0003 并行设计接口，但 RawDo 的实现依赖两者就位。

> 注：0002 和 0003 有接口层的循环依赖（engine 依赖 session/cache 接口，session/cache 是 engine 的依赖倒置接口）。实际操作：先在 0002 定义 Meta/AuthRequirement 等类型，0003 实现 SessionStore/Cache 接口，两者接口对齐后并行推进实现。
