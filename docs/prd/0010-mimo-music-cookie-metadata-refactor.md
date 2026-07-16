# PRD: mimo-music cookie 传递从 proto 字段迁移到 gRPC metadata

> 状态：待实现
> 关联：[架构 ADR](../adr/mimo-music-architecture.md) §4.5 接缝签名、[列表响应统一实体 ADR](../adr/mimo-music-list-response-single-entity.md)
> 范围：把网易云 cookie 从 proto request 字段迁移到 gRPC metadata，凭证出域，业务模型干净。优先于 Phase 5 功能扩展。

## Problem Statement

地基阶段把「调用方持有的网易云登录态 cookie」作为 `string cookie` 字段塞进了 14 处 proto request message（auth/artist/fm/playlist/recommend/user 六个域）。这违反 gRPC 凭证传递的业界规范：

- **凭证污染业务模型**：cookie 是传输层凭证，不是领域实体属性。它出现在 proto message 里让每个写操作/auth 接口的请求体都带一个非业务字段，gateway 暴露 REST 时 cookie 变成请求体字段——更是反模式（REST 认证走 header）。
- **职责混淆**：cookie 是「转发给上游网易云的凭证」，不是「对 mimo-music 自身的认证」。混在同一字段会让未来 mimo-music 自身鉴权（ADR §4.5 规划的 auth interceptor）和上游凭证传递打架。
- **业界共识明确**：gRPC 官方 auth 文档、Google AIP、Netflix 生产实践一致推荐凭证走 metadata，由 interceptor 统一提取，不进 proto 字段。

这是地基阶段跳过的协议层基础设施债，在 Phase 5 新增更多写操作前必须清偿——否则 Phase 5 的写操作会延续错误模式，债越滚越大。

## Solution

建立「metadata 传递 + interceptor 提取 + context 注入」的凭证传递链路，删除所有 proto cookie 字段。

### 凭证传递链路

```
调用方
  ├─ gRPC 客户端：metadata["x-netease-cookie"] = "<网易云cookie>"
  └─ REST 客户端（gateway）：HTTP header "Grpc-Metadata-X-Netease-Cookie: <网易云cookie>"
        ↓
grpc-gateway 自动桥接（Grpc-Metadata- 前缀剥离 → metadata key "x-netease-cookie"）
        ↓
gRPC server: cookie interceptor
  ├─ metadata.FromIncomingContext(ctx) 提取 "x-netease-cookie"
  └─ context.WithValue(ctx, cookieKey{}, cookie)  ← 注入 context
        ↓
service 方法（恒一行，不感知 cookie 来源）
        ↓
engine 从 context 取 cookie（不再从参数接收）
  ├─ 有 context cookie：用调用方指定的上游登录态（cookie override 路径）
  └─ 无 context cookie：走 session 池选取（Execute 路径，读操作默认）
        ↓
transport（不变）：setCommonHeaders(req, cookie) → HTTP Cookie header → 网易云上游
```

### cookie 的两条来源（保持不变）

cookie 重构不改 cookie 的语义来源，只改传递机制：

- **session 池 cookie**（engine 内部）：读操作默认走 `session.GetAvailable` 选取匿名/登录池 cookie，不在 proto 也不在 metadata，engine 内部处理。不变。
- **调用方显式 cookie**（写操作/auth/特定登录态查询）：从 proto 字段迁移到 metadata `x-netease-cookie`，interceptor 注入 context，engine 从 context 取。

### grpc-gateway 桥接

grpc-gateway 默认转发 `Grpc-Metadata-` 前缀的 HTTP header 到 gRPC metadata。REST 调用方传 `Grpc-Metadata-X-Netease-Cookie` header，gateway 自动转成 metadata key `x-netease-cookie`。无需自定义 gateway middleware。

### 为何不用 Authorization header

网易云 cookie 是「上游凭证」，不是「对 mimo-music 的 bearer token」。`Authorization` 语义是「我是谁（对 mimo-music）」，应留给未来 mimo-music 自身鉴权。用自定义 `x-netease-cookie` 让两类凭证职责分离。

### proto 版本

保持 `music/v1`，直接删 cookie 字段。mimo-music 无 external consumer（mimo-blog api 对接尚未开始），不存在 breaking change 保护问题。

## User Stories

1. 作为 gRPC 调用方，我想通过 metadata 传递网易云 cookie，这样请求 message 保持纯业务字段。
2. 作为 REST 调用方（经 gateway），我想通过 HTTP header 传递网易云 cookie，这样符合 REST 凭证走 header 的惯例。
3. 作为服务维护者，我想让 cookie 传递统一走一条 interceptor 链路，这样所有写操作/auth 接口不用各自处理 cookie 取值。
4. 作为服务维护者，我想让 mimo-music 自身鉴权（未来）和上游网易云凭证传递分离，这样两者的 auth 语义不打架。
5. 作为调用方，当我不传 cookie 时，读操作应自动用 session 池的匿名/登录态 cookie，这样无需每次手动传凭证。
6. 作为调用方，当我传了 cookie，写操作应使用我指定的网易云登录态，这样能用特定账号操作（如收藏歌单到指定账号）。
7. 作为开发者，我想让 engine 从 context 取 cookie（而非参数），这样 service 方法签名更简洁、cookie 来源对 service 透明。
8. 作为 auth 接口调用方，登录/登出/登录态查询仍能正常工作，只是 cookie 传递方式从字段变成 header。

## Implementation Decisions

### proto 层：删除 14 处 cookie 字段

六个域的 proto message 删除 `string cookie = N` 字段：
- `auth.proto`：`LoginStatusRequest.cookie`、`LogoutRequest.cookie`（`Session.cookie` 是响应字段，保留——它是 session 实体的凭证属性）
- `artist.proto`：`ArtistSubscribeRequest.cookie`
- `fm.proto`：`GetPersonalFMRequest.cookie`
- `playlist.proto`：`SubscribeRequest.cookie`、`CreateRequest.cookie`、`DeleteRequest.cookie`、`UpdateNameRequest.cookie`、`UpdateDescRequest.cookie`、`UpdateTagsRequest.cookie`、`UpdateTracksRequest.cookie`
- `recommend.proto`：`GetDailyRecommendRequest.cookie`
- `user.proto`：`AccountRequest.cookie`

删除后 `make proto` 重新生成 stub。proto3 删字段后编号不复用（留空即可，无需 `reserved`，因为无 external consumer）。

### interceptor 层：cookie 提取与 context 注入

新建 `internal/server/interceptor.go`（或 `internal/netease/` 下，取决于 server 装配位置）：

- `CookieInterceptor`（gRPC UnaryServerInterceptor）：从 `metadata.FromIncomingContext(ctx)` 读 `x-netease-cookie`，用自定义 context key 注入 `ctx = context.WithValue(ctx, cookieKey{}, cookie)`。
- 提供包级辅助 `CookieFromContext(ctx) string` 供 engine 调用。
- 无 cookie 时注入空字符串（engine 据此判断走 session 池）。
- 这是 ADR §4.5 时序图规划的 interceptor 链的第一个实现（recovery/trace/log/rate/auth 后续补，但 cookie interceptor 是其中一环）。

### engine 层：cookie 来源从参数改为 context

- `RawDoWithCookieAndInput` 签名去掉 `cookieOverride string` 参数，改为从 `ctx` 取（`CookieFromContext(ctx)`）。
- `doOnceWithCookie` 同步去 cookie 参数，从 ctx 取。
- `executeWithCookie`（service 包辅助）去掉 cookie 参数：`executeWithCookie(eng, ctx, ep, req)`——cookie 在 ctx 里。
- transport 层不变（`setCommonHeaders(req, cookie)` 仍是 cookie 注入 HTTP header 的终点）。
- 读操作路径（`RawDo` → session 池）不变。

### service 层：统一去 cookie 参数

- 所有写操作 service 方法不再 `req.GetCookie()`，直接 `executeWithCookie(eng, ctx, ep, req)`。
- auth service（LoginStatus/Logout）的 cookie 来源从 `req.GetCookie()` 改为 context。
- service 方法全部恒一行（cookie 在 ctx，对 service 透明）。

### server 装配

`server.NewApp` 的 `grpc.NewServer()` 加 `grpc.UnaryInterceptor(cookieInterceptor)`（或链式 `grpc.ChainUnaryInterceptor` 为未来 recovery/trace 留位）。

### ADR 更新

架构 ADR §4.5 补充 cookie 传递机制（metadata → interceptor → context → engine），修正「第三条执行路径」小节里 cookie 来源描述（从「请求字段」改为「context，由 interceptor 从 metadata 注入」）。

## Testing Decisions

测试原则：只测外部行为，不测实现细节。两个 seam，复用已有测试模式。

### seam 1：interceptor 单元测试（metadata → context 映射）

新建 `interceptor_test.go`，纯函数测试：
- metadata 含 `x-netease-cookie` → `CookieFromContext(ctx)` 返回该值
- metadata 不含 → 返回空字符串
- 多值 metadata 边界

这是 cookie 重构的入口行为：**metadata 必须被正确提取并注入 context**。table-driven + testify，对齐 `go-testing-guide.md` 规范。

### seam 2：engine e2e 测试（context cookie → 上游 HTTP 请求）

复用 code-review 修复时建的 `WithBaseURL` + httptest 脚手架（`execute_e2e_test.go`）：
- context 注入 cookie → Execute/engine 调用 → mock server 断言收到的 HTTP 请求带正确 `Cookie` header
- 这锁住 cookie 重构最核心的行为：**cookie 必须最终到达上游请求，不能在中途丢失**

这是 cookie 重构的价值断言：无论传递链路怎么改，cookie 必须到达网易云。用 httptest mock 验证请求 header。

### 不测的

- service 层：恒一行，lint 机械校验。
- transport 层：`setCommonHeaders` 不变，已有行为。
- grpc-gateway 桥接：是 gateway 内置行为，不测框架。

## Out of Scope

- mimo-music 自身鉴权（mimo-music 限制谁能调用）：本 PRD 只做上游网易云 cookie 传递，不涉及 mimo-music 自己的 auth。`Authorization` header 留给未来的自鉴权。
- ADR §4.5 时序图里的其他 interceptor（recovery/trace/log/rate/auth）：本 PRD 只实现 cookie interceptor，其余后置。但 server 装配用 `ChainUnaryInterceptor` 为它们留位。
- session 池 cookie 选取逻辑：不变。
- Rust client / OpenAPI 文档更新：cookie 传递方式变化需同步到 client 文档，但属独立收尾工作。
- Phase 5 功能扩展：本 PRD 是 Phase 5 的前置，不涉及任何新网易云接口。

## Further Notes

### 优先级

本 PRD 优先于 Phase 5（0011/0012/0013）执行。理由：Phase 5 会新增约 5-8 个写操作，若先做 Phase 5，这些写操作会用 proto cookie 字段，重构时连带清理量增大。proto 是唯一契约，cookie 字段是 breaking change 的源头，越早改成本越低。

### 迁移策略

一次性 breaking change，proto 保持 v1。无 external consumer（mimo-blog api 对接尚未开始），不存在兼容保护。删字段直接删，不用 deprecated 过渡、不用 reserved（proto3 无 external consumer 时编号不复用无风险）。

### 编号说明

本 PRD 编号 0010。Phase 5 的三个 PRD 顺延为 0011（5a 读类扩展）/ 0012（5b 数字专辑）/ 0013（5c MV/视频/排行榜）。

### 相关 ADR

- [列表响应统一实体 ADR](../adr/mimo-music-list-response-single-entity.md)：与本 PRD 同属 Phase 5 前置的架构决策，已写。
- 架构 ADR §4.5：cookie 传递机制落地后补充。
