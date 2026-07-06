# Issue-0014：前端 SSR 改 /auth/session 只读探活

## Parent

PRD-0002（`docs/prd/0002-登录态opaque-session重构.md`）

## What to build

前端 SSR 鉴权改为调后端只读 /auth/session 拿 claims，去掉任何 JWT 验签 / refresh / Set-Cookie 期望。这是命门不变量①在前端的落地——SSR 只读不写。

## Acceptance criteria
- [ ] SSR 取用户改为调 GET /auth/session（经 `getServerHttpClient` 转发 cookie），返回 claims 或视为未登录
- [ ] 删除任何前端 JWT 验签 / jose 引用 / access cookie 直验逻辑（本就未实施，确认无残留）
- [ ] SSR 不触发 /auth/refresh、不期望 Set-Cookie
- [ ] router context 的 auth 字段存 /auth/session 返回的 claims（user_id / role 等）
- [ ] beforeLoad 守卫读 context.auth 判登录 / 角色
- [ ] 首屏：已登录用户 SSR 即拿到登录态（无 hydration 闪烁）；未登录渲染游客视图
- [ ] 完整 UserDTO 仍由客户端 useMe（GET /auth/me）按需拉
- [ ] `pnpm typecheck && pnpm test` 全绿；手动验证 Network 无 SSR refresh、无 Set-Cookie

## Blocked by
- Issue-0011（/auth/session 只读端点就位）
- Issue-0012（后端集成通过）
