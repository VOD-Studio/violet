# Issue-0010：后端登录链路改 session（CreateSession + Login/Google/Github + Logout）

## Parent

PRD-0002（`docs/prd/0002-登录态opaque-session重构.md`）

## What to build

把三种登录入口（邮箱密码 / GitHub / Google）与登出从 JWT 改为创建 / 删除 opaque session。session 创建统一由新增的 CreateSessionHandler 编排，各 login handler 剥离 token、只返回 userID。

- CreateSessionHandler：用户快照 → NewSession → SessionStore.Create，返回 {SessionID, CSRFToken}
- LoginHandler：剥离 GenerateTokenPair / Save refresh，仅校验凭证返回 userID
- GoogleLogin / GithubLogin：同构剥离，返回 userID
- LogoutHandler：改为 DeleteForUser(userID, sessionID)，登出当前设备

## Acceptance criteria
- [ ] `create_session.go`：CreateSessionHandler，Handle 返回 CreateSessionOutput{SessionID, CSRFToken}
- [ ] `create_session_test.go`：mock userRepo + MockSessionStore，断言返回非空 id/csrf 且 store.Create 被调
- [ ] LoginHandler 改造：`NewLoginHandler(repo, hasher)`（删 tokenService / tokenStore 参数），Handle 返回 LoginOutput{UserID}
- [ ] Google / Github login 同构改造，构造函数删 token 依赖，返回 {UserID}
- [ ] LogoutHandler 改造：`NewLogoutHandler(sessionStore)`，LogoutInput{UserID, SessionID}，调 DeleteForUser；失败记日志（ADR-0001 不变量 3 精神迁移）
- [ ] User 聚合补 `RoleID()` 访问器（session 快照需要）
- [ ] mocks.go 新增 MockSessionStore
- [ ] 现有 Login / Google / Github / Logout 测试同步改断言（不再期待 GenerateTokenPair / Save / Rotate）
- [ ] `go test ./internal/application/auth/command/` 全绿

## Blocked by
- Issue-0009（SessionStore 端口 + session 聚合根）
