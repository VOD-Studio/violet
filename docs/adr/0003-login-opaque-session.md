# 登录态：opaque session 取代 access/refresh JWT
Status: accepted（架构决策已定，待实施）

## 背景

当前登录态基于 access/refresh JWT + HttpOnly cookie（见 ADR-0001、ADR-0002）。该模型在实践中暴露出根因性问题与复杂度爆炸：

1. **SSR 掉登录根因未根治**：TanStack Start 的 server function 以 JSON-over-fetch 返回，`Set-Cookie` 响应头不透传浏览器。SSR 调 `/auth/me` 触发 refresh → refresh 在服务端进程内成功但浏览器收不到新 cookie → 持续掉登录（详见 `../archive/ssr-auth-refactor-handoff.md`）。ADR-0002 提出的「SSR 直验 access JWT + 不做 refresh」方案从未实施（`src/start.ts` 不存在、`jose` 未引入、无 middleware），且即使实施仍是治标——只要 access 短命就必然要 refresh，refresh 必然涉及 Set-Cookie，在 SSR 场景就撞透传卡点。

2. **补丁堆叠**：为缓解掉登录与 401 风暴，前端叠加了 `authGate`（401 挂起重放）、`refresh-queue`（跨 tab 互斥）、`AuthDebugPanel`（调试）、主动刷新定时器、双链重放等多层机制（`src/shared/api/auth-gate.ts` 等）。这些是症状层补丁，复杂且脆弱。

3. **JWT 的无状态收益是幻觉**：refresh token 已用 Redis 白名单（单槽 + 轮换 + 家族重用检测，见 ADR-0001），并非纯无状态；每次 refresh 多次 Redis 操作。所谓「省一次 Redis 查询」的性能优势对本项目（单后端、博客级流量）无意义。

业界调研（`ssr-auth-refactor-handoff.md`）：bilibili（SESSDATA）、GitHub、Discord、Google 均采用 opaque session cookie 模型，而非浏览器侧 JWT。

## 决策

**用 opaque session cookie 取代 access/refresh JWT。** cookie 仍是鉴权载体（HttpOnly + SameSite=lax + Secure），但 cookie 内容从 JWT 换成不透明 session id；后端查 Redis session 鉴权。

### cookie 清单（精简）

| cookie | 内容 | HttpOnly | 作用 | 对标 |
|---|---|---|---|---|
| `mimo_session` | opaque session id，cryptographically random ≥256-bit | 是 | 鉴权凭证，浏览器自动携带，后端查 Redis | bilibili SESSDATA |
| `mimo_csrf` | CSRF token | 否，前端读 | double-submit，回传 `X-CSRF-Token` 比对 | bilibili bili_jct |
| `mimo_uid`（可选） | user_id | 否 | 前端直读，省一次拉取 | bilibili DedeUserID |

### 生命周期

- **滑动续期（idle timeout）**：后端中间件对每个带有效 session 的真实请求延长 Redis expiry（`EXPIRE`），**不轮换 session id、不产生 Set-Cookie**。
- **绝对寿命（max）配置项**：`max <= 0`（0 或 -1）→ 无上限（默认，活跃永不下线）；`max > 0` → 从登录起算最长存活 max，到点强制重登。
- 实际过期 = min(滑动到期, 绝对到期[若启用])。

### 后端鉴权模型：纯 opaque

每个受保护请求：中间件读 `mimo_session` → Redis `GET session:<id>` → 注入 user context → 滑动续期。**彻底删除** access/refresh JWT 签发、rotation、token family、reuse-detection、`jose`、`/auth/refresh`、refresh token 白名单单槽逻辑。鉴权成本 = 一次 Redis GET，微秒级且本就在热路径。

### 命门不变量（方案成立的全部前提）

1. **SSR 只读 session、绝不续期、绝不 Set-Cookie**：SSR 拿到 cookie 后调后端只读端点（如 `/auth/session`）换 user claims，全程不写 cookie → 彻底绕开 TanStack Start 透传卡点。
2. **续期只由后端中间件对真实请求做**：写 Redis expiry、不轮换 id、不 Set-Cookie → SSR 转发的请求即使被续期也不产生 cookie。

这两条守住后，「SSR 掉登录 → 401 风暴 → authGate 补丁」整条因果链物理断掉——因为再也没有「SSR 想写 cookie 但写不进浏览器」这件事。

### 登录方式与迁移

- **登录方式**：保留现有全部登录方式——邮箱密码 + GitHub OAuth + Google OAuth。无论哪种方式校验通过 → 后端创建 session → Set-Cookie（真正 HTTP 响应，直出浏览器，不撞透传）→ 重定向前台。前端 LoginDialog 的邮箱密码表单与 OAuth 按钮均不变。
- **迁移**：强制重登，无兼容层。上线后旧 access/refresh JWT cookie 全部失效，所有用户重登一次换发新 session cookie；不维护双轨、不做旧 JWT 向新 session 的任何转换/兼容代码。

## 备选方案

- **ADR-0002 方向（SSR 直验 access JWT + 不 refresh）**：否决。需引入 `jose` + 公钥分发，access 短命仍要客户端 refresh，未根治透传；且方向 A 自身从未实施。ADR-0002 当初以「stateless 性能优势值得保留」「根因不在 session 模型」否决 opaque session，已被实践证伪：refresh 白名单本就查 Redis，无状态收益是幻觉；opaque session 恰能彻底绕开根因。
- **opaque + 短期 access JWT 混合**：否决。rotation/双过期回归，refresh 换发新 JWT 重新撞透传，违背简化初衷；JWT 无状态收益对本项目无用。
- **引入 better-auth 等第三方 auth**：否决（当前决策范围）。引入新依赖、与 Go 后端需适配层、黑盒度高；技术栈已定为自建。

## 业界依据

- bilibili：SESSDATA（HttpOnly opaque session）+ bili_jct（CSRF double-submit）+ DedeUserID（前端可读 uid）。
- GitHub / Discord / Google：opaque session cookie，传统 SSR 直出 Set-Cookie。
- OWASP Session Management Cheat Sheet：idle timeout（短）+ absolute timeout（长）组合为推荐实践。

## Consequences

**删除（前端）**：`authGate`、`refresh-queue`、`AuthDebugPanel`、主动刷新定时器、双链 401 重放、access JWT 验签（`jose` 不引入）。401 = 直接踢重登，无 refresh/重放。

**删除（后端）**：access/refresh JWT 签发、rotation（Lua `rotateScript`）、reuse-detection、refresh token 白名单、`/auth/refresh`。

**新增（后端）**：session 聚合根 + Redis 存储（`session:<id>` → {user_id, role, csrf_token, created_at, ...}）、session 中间件（读 cookie + 查 session + 注入 user context + 滑动续期）、`/auth/session`（只读，供 SSR）、login/logout 改为创建/删除 session。

**重写（后端账号管理端点）**：register / forgot-password / reset-password / verify-email / change-password 按 opaque session 方案重写，不保留任何旧 tokenStore / JWT 逻辑、无向后兼容层——改密码、重置密码后删除该用户全部 session（强制重登），对齐 opaque session 的可即时吊销特性。

**简化（SSR）**：SSR 调只读 `/auth/session` 拿 claims，不验签、不 refresh、不 Set-Cookie。删 ADR-0002 规划的 `jose` / 公钥 / middleware 验签。

**ADR 状态变更**：
- ADR-0001（refresh rotation invariants）：**superseded**——rotation 整套删除，不变量 1、2 不再适用；不变量 3（吊销不可静默失败）的精神迁移到 session 删除（登出删 session 失败须记日志处理）。
- ADR-0002（SSR 直验 JWT）：**superseded**——SSR 改为读 opaque session，不再直验 JWT。

## 开放问题（实现期细化，不阻塞架构定调）

1. 安全细节：session id 编码（base64url）、SameSite 取值、跨子域 domain、并发 session 数限制（默认多设备并存，对标 bilibili）。
2. 登出协议：删 Redis session + Clear-Cookie 的端点与响应契约。
3. Redis schema：`session:<id>` value 结构、是否维护 `user:<uid>:sessions` 集合以支持「列出 / 踢除设备」。
