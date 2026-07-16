# Issue-0001：cookie 传递迁移到 gRPC metadata

## Parent

PRD：`../../prd/0010-mimo-music-cookie-metadata-refactor.md`

## What to build

一条完整的端到端 vertical slice：把网易云 cookie 的传递从 proto request 字段迁移到 gRPC metadata，切穿所有层（proto → interceptor → context → engine → service → server 装配）。

调用方把网易云 cookie 放进 gRPC metadata（`x-netease-cookie`）或 REST header（`Grpc-Metadata-X-Netease-Cookie`，gateway 自动桥接）。新建 cookie interceptor 从 metadata 提取并注入 context。engine 从 context 取 cookie（不再从参数接收）。service 方法恒一行，cookie 对 service 透明。transport 层不变（`setCommonHeaders` 仍是 cookie 到 HTTP header 的终点）。

这是一个不可分的原子切片：proto 删字段后 engine/service 必须同步改才编译，中间态不编译。

## 改动链路（按实现顺序）

1. **interceptor 基础设施**：新建 cookie interceptor（`UnaryServerInterceptor`），从 `metadata.FromIncomingContext(ctx)` 读 `x-netease-cookie`，用自定义 context key 注入；提供 `CookieFromContext(ctx) string` 辅助。无 cookie 时注入空字符串。
2. **engine 改 cookie 来源**：`RawDoWithCookieAndInput` / `doOnceWithCookie` 去掉 `cookieOverride string` 参数，改从 ctx 取（`CookieFromContext`）。`executeWithCookie`（service 包辅助）去掉 cookie 参数。transport 层不变。
3. **service 统一去 cookie 参数**：所有写操作 service 方法不再 `req.GetCookie()`，改 `executeWithCookie(eng, ctx, ep, req)`。auth service（LoginStatus/Logout）的 cookie 来源从 `req.GetCookie()` 改为 context。
4. **proto 删 14 处 cookie 字段**：六个域（auth/artist/fm/playlist/recommend/user）的 request message 删 `string cookie = N`。`Session.cookie`（响应字段）保留。`make proto` 重新生成。
5. **server 装配**：`server.NewApp` 的 `grpc.NewServer()` 加 `grpc.ChainUnaryInterceptor(cookieInterceptor)`（链式，为未来 recovery/trace/rate/auth interceptor 留位）。
6. **ADR 更新**：架构 ADR §4.5 补 cookie 传递机制，修正「第三条执行路径」小节 cookie 来源描述。

## Acceptance criteria

- [ ] cookie interceptor 从 metadata 提取 `x-netease-cookie` 注入 context，`CookieFromContext(ctx)` 可读出
- [ ] interceptor 单元测试：metadata 有/无 cookie、多值边界（table-driven + testify，对齐 go-testing-guide.md）
- [ ] engine 的 `RawDoWithCookieAndInput` 签名去掉 cookie 参数，从 context 取
- [ ] engine e2e 测试：context 注入 cookie → mock server（WithBaseURL + httptest）断言收到的 HTTP 请求带正确 Cookie header
- [ ] `executeWithCookie` 辅助去掉 cookie 参数：`executeWithCookie(eng, ctx, ep, req)`
- [ ] 所有写操作 service 方法恒一行（cookie 在 ctx，对 service 透明）
- [ ] proto 删除 14 处 `string cookie` 字段，`Session.cookie` 响应字段保留
- [ ] `make proto` 生成成功
- [ ] server 用 `grpc.ChainUnaryInterceptor` 装配 cookie interceptor
- [ ] 全量测试通过（`go test ./internal/...`）
- [ ] `go vet` 通过、`make proto-lint`（buf lint）通过
- [ ] 架构 ADR §4.5 cookie 传递机制说明更新

## Blocked by

无 —— 可立即开始。这是 Phase 5 功能扩展的前置。
