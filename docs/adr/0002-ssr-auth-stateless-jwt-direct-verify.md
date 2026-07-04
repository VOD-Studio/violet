# SSR 鉴权：直验 access JWT，不做 refresh

Status: accepted

## 背景

前台路由采用 SSR（TanStack Start），后台路由 `ssr: false`。原 SSR 鉴权链路：`__root.beforeLoad` 调 `getCurrentUser` server function → 内部用 axios 调后端 `GET /auth/me` → 失败返回 null。

该链路存在一个架构性缺陷：SSR 使用的 axios 实例（`getServerHttpClient`）注册了与客户端相同的 401 拦截器。access token 过期时，SSR 会触发 `POST /auth/refresh`——refresh 在服务端进程内能成功（200），但 **TanStack Start 的 server function 以 JSON over fetch 返回，Set-Cookie 响应头不会自动透传给浏览器**（见 [jilles.me - TanStack Start Server Functions: How They Work](https://jilles.me/tanstack-start-server-functions-how-they-work/)）。结果浏览器永远收不到新 cookie，持续掉登录，用户必须手动重登。

此前还修过两层相关问题：refresh cookie Path 限定 `/api/v1/auth` 导致 SSR 拿不到 refresh cookie（已改 `/`）；跨 tab refresh race（已改 queue 模式）。但 SSR 吞 Set-Cookie 的根因只有重构 SSR 鉴权方式才能根治。

## 决策

保持 access/refresh JWT 直接进 cookie 的 **stateless** 模型（access 验签即鉴权，零 DB 开销），但改变 SSR 的鉴权与续期职责划分：

1. **SSR 直验 access JWT**：用 TanStack Start middleware 读 `mimo_access` cookie，用 `jose` + 后端公钥（ES256）验签，把 claims（user_id/email/role + exp）注入 router context。**不再调 HTTP `/auth/me`**。
2. **SSR 不做 refresh**：access 过期 → middleware 返回未登录 → 页面渲染游客视图 → 客户端 hydrate 后，axios 401 拦截器调 `/auth/refresh`（真实 HTTP 端点，Set-Cookie 正确写入浏览器）→ 重放。
3. **hydrate 后 arm 主动刷新定时器**：middleware 验签拿到 access JWT 的 `exp`，hydrate 后用剩余时间 `scheduleRefresh`，填补"页面刷新后定时器丢失"的缺口。
4. **完整 UserDTO 交给客户端**：SSR 只用 claims（够判登录态 + 角色），细粒度 permissions 由客户端 `useMe`（`GET /auth/me`）按需拉取。
5. **写 cookie 的操作走后端 HTTP 端点**：login/refresh/logout 保持客户端直接调后端，不经 server function。

## 备选方案

- **全面切到 opaque session ID**：cookie 存不透明 ID，后端查 Redis/DB 拿用户。完全对齐 TanStack 官方 Authentication Server Primitives，易撤销、多设备管理。但每次受保护请求多一次查询，且是大重构。**否决**：当前 stateless 模型的性能优势值得保留，且 SSR bug 的根因不在 session 模型，而在 SSR 的 HTTP 绕行。
- **SSR 验 JWT + 内部直调 /auth/me（不走 axios 拦截器）**：保持现有查询完整 UserDTO 的能力，去掉拦截器竞态。**否决**：仍绕一圈 HTTP，且 SSR 拿完整 UserDTO 的需求可由客户端 useMe 满足，不值得为它保留 HTTP 绕行。

## 业界依据

- [TanStack Start: Authentication Server Primitives](https://tanstack.com/start/latest/docs/framework/react/guide/authentication-server-primitives)：session lookup 应作为 middleware，直接读 cookie。
- [Auth.js: Refresh Token Rotation](https://authjs.dev/guides/refresh-token-rotation)：SSR 端需要写 cookie 时，必须确保 Set-Cookie 透传；server function 的 JSON-over-fetch 不保证透传，server route 更可靠。
- [WorkOS: TanStack Start authentication guide (2026)](https://workos.com/blog/tanstack-start-authentication-guide)：middleware 做会话查找 + 注入 typed context 是推荐模式。

## Consequences

- **新增依赖**：前端引入 `jose`（Node 端 JWT 验签，零依赖、支持 ES256）。
- **公钥分发**：`jwt_public_key.pem` 需对 Node 进程可访问（dev 读 `api/jwt_public_key.pem`，生产通过 env/path 配置）。公钥可公开，无私钥泄露风险。
- **SSR 权限粒度降级**：SSR 守卫只能判登录态 + 角色（claims 里的 role），细粒度 permissions 判断推迟到客户端 hydrate 后。对当前路由守卫（admin:access、role 判断）足够。
- **access 过期瞬间的渲染**：access 过期时 SSR 渲染游客视图，hydrate 后客户端 refresh 成功恢复登录态——会有极短的"游客→登录"闪烁。可接受，比"持续掉登录必须重登"好。
- **不违反 ADR-0001**：refresh token 轮换不变量全部由后端 `RefreshTokenHandler` + `RedisTokenStore.Rotate` 保证，SSR 不参与 refresh，不影响这些不变量。
