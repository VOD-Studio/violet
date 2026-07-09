# Issue-0007：前端登录 / 登出消费 session cookie

## Parent

PRD-0002（`../../prd/0002-登录态opaque-session重构.md`）

## What to build

前端登录 / 登出流程改为消费后端下发的 session cookie，不再处理 access / refresh token。LoginDialog（邮箱密码）+ GitHub / Google OAuth callback 成功后，仅 refetch useMe 拿用户信息，cookie 由后端 Set-Cookie 自动管理。

## Acceptance criteria
- [ ] useGithubLoginMutation / Google 登录 / 邮箱密码 login：成功后不再处理 token，仅 `queryClient.refetchQueries(authKeys.me())` + 关闭弹窗 / 跳转
- [ ] 删除前端存储 / 读取 access_token、refresh_token 的逻辑
- [ ] LoginDialog 保留邮箱密码表单 + OAuth 按钮（UI 不变）
- [ ] OAuth callback 路由（`auth.github.callback.tsx`）：成功后 refetch me + 跳转首页
- [ ] 登出：调 POST /auth/logout（带 X-CSRF-Token），成功后清 query cache + 跳登录
- [ ] CSRF token：前端从 mimo_csrf cookie 读取放 X-CSRF-Token header（`getCookie` 已存在于 `shared/lib/cookies.ts`）
- [ ] `pnpm typecheck && pnpm test` 全绿

## Blocked by
- Issue-0002（login 返回 cookie 不返 token）
- Issue-0004（后端集成通过）
