# PRD-0002：登录态 opaque session 重构

> 状态：ready-for-agent
> 北极星：把登录态从 access/refresh JWT 切换为 opaque session（对标 bilibili SESSDATA），根治 SSR 持续掉登录、消除前端补丁堆叠，登录入口与账号流程一律保留。
> 范围：前后端认证架构重写（保留 TanStack Start + Go 技术栈，无兼容层）。
> 适用项目领域词汇：见 `CONTEXT.md` 认证章节（Session ID、滑动续期、绝对寿命、命门不变量）；决策依据见 `../adr/0003-login-opaque-session.md` 与 `../adr/auth-architecture-selection.md`。

## Problem Statement

作为博客的用户——读者评论、作者发文、管理员审核——我在登录后会**莫名其妙掉登录**：页面刷新或停留一段时间后登录态消失，需要反复重登。根因是 SSR 鉴权链路的一个架构性卡点：TanStack Start 的 server function 以 JSON-over-fetch 返回，refresh 时下发的 `Set-Cookie` 不透传到浏览器，浏览器永远收不到新 cookie。

为缓解它，前端已经叠加了一层又一层补丁：`authGate`（401 挂起重放）、`refresh-queue`（跨 tab 互斥）、`AuthDebugPanel`（调试面板）、主动刷新定时器、双链重放。这些补丁复杂、脆弱、治标不治本——只要 access token 短命就必然要 refresh，refresh 在 SSR 场景就必然撞透传卡点。ADR-0001 补了 rotation 不变量、ADR-0002 规划了 SSR 直验 JWT（从未实施），都没根治。

同时 cookie 安全属性、跨域一致性、SSR 首屏登录态等多个维度都有问题——这是全方位的认证失败，不是单一 bug。

## Solution

**用 opaque session cookie 取代 access/refresh JWT。** cookie 仍是鉴权载体（HttpOnly + SameSite=lax + Secure），但 cookie 内容从 JWT 换成不透明 session id；后端查 Redis session 鉴权。

决定性理由：opaque session 让 SSR **只读 cookie 判登录、不刷新、不写 cookie**，物理上绕开 TanStack Start 的 Set-Cookie 透传卡点。续期只由后端中间件对真实请求做——写 Redis expiry，不轮换 id、不 Set-Cookie。

### cookie 清单（精简）
- `mimo_session`（HttpOnly，opaque id）—— 对标 bilibili SESSDATA
- `mimo_csrf`（非 HttpOnly，double-submit）—— 对标 bilibili bili_jct，保留现有机制
- `mimo_uid` 本期不做（YAGNI）

### 生命周期
- 滑动续期（idle）：每个真实请求重置 Redis expiry
- 绝对寿命（max）配置项：`<=0` 无上限（默认），`>0` 到点强制重登

### 命门不变量（方案成立的全部前提）
1. SSR 只读 session、绝不续期、绝不 Set-Cookie
2. 续期只由后端中间件对真实请求做：写 Redis、不轮换 id、不 Set-Cookie

## Goals
- 根治 SSR 掉登录（绕开透传卡点）
- 删除前端全部补丁层（authGate / refresh-queue / AuthDebugPanel / 主动刷新 / 双链重放）
- 删除后端 JWT / refresh / rotation 全部遗产（无兼容层）
- 保留邮箱密码 + GitHub + Google 三种登录 + 注册 / 忘记密码 / 重置密码 / 邮箱验证 / 改密码全流程
- cookie 安全属性正确（HttpOnly + SameSite=lax + Secure）

## Non-goals
- 不引入第三方 auth（better-auth / clerk / supabase auth）
- 不换技术栈（保留 TanStack Start + Go）
- 不做多设备「列出 / 踢除设备」管理（YAGNI，留待将来）
- 不做 mimo_uid cookie（YAGNI）
- 不做旧 JWT → 新 session 的双轨迁移（强制重登）

## Architecture 决策摘要
详见 `../adr/0003-login-opaque-session.md`。被否决方案：保留 JWT 修透传（治标）、opaque + JWT 混合（请回复杂度）、引入 better-auth（黑盒）。ADR-0001、ADR-0002 标记 superseded。

## 验收标准（高层）
- [ ] 登录（任一方式）后浏览器只收到 mimo_session + mimo_csrf cookie，属性正确
- [ ] SSR 页面首屏拿到登录态（调 /auth/session），Network 无 Set-Cookie、无 refresh 请求
- [ ] 长时间活跃不掉登录（滑动续期生效）
- [ ] max>0 时到绝对寿命强制重登；max<=0 永不下线
- [ ] 登出清 cookie + 删 session，受保护请求 401
- [ ] 改密 / 重置密码后该用户全部设备 session 失效
- [ ] 后端无 JWT / refresh / rotation 代码，go build + go test 全绿
- [ ] 前端无 authGate / refresh-queue / AuthDebugPanel，pnpm typecheck + test 全绿

## Issue 拆分

后端：
- Issue-0001 后端 session 基础设施（聚合根 + Store + 中间件）
- Issue-0002 后端登录链路改 session（CreateSession + Login/Google/Github + Logout）
- Issue-0003 后端账号安全改 session + cookie 层 + /auth/session 只读端点
- Issue-0004 后端清理 JWT 遗产 + 装配 + 集成测试

前端：
- Issue-0005 前端删补丁层 + http 拦截器改 401 直接踢
- Issue-0006 前端 SSR 改 /auth/session 只读探活
- Issue-0007 前端登录 / 登出消费 session cookie

详细执行蓝图（TDD bite-sized task）见 `../superpowers/plans/2026-07-06-auth-opaque-session-backend.md`（后端，已就绪）；前端 plan 待 Issue-0005-0015 契约稳定后补。
