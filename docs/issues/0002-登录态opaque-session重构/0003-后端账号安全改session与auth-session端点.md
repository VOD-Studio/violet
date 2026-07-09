# Issue-0003：后端账号安全改 session + cookie 层 + /auth/session 只读端点

## Parent

PRD-0002（`../../prd/0002-登录态opaque-session重构.md`）

## What to build

账号安全端点（改密 / 重置密码）改为吊销用户全部 session；HTTP handler cookie 层从 token 改 session；新增 SSR 专用的只读 /auth/session 探活端点（命门不变量①：不续期、不 Set-Cookie）。

- ChangePassword / ResetPassword：tokenStore.Delete → SessionStore.DeleteByUser，密码变更强制该用户全部设备重登
- response 包：SetSessionCookie / ClearSessionCookies 取代 SetAuthTokenCookies / ClearAuthCookies
- Login / Google / Github handler：编排 CreateSession + SetSessionCookie，响应体返 user_id（不再返 access_token）
- 新增 GET /auth/session：读 ctx claims 返回 user_id / role / email，**只读不续期不写 cookie**

## Acceptance criteria
- [ ] ChangePassword / ResetPassword 持有 sessionStore，密码更新成功调 DeleteByUser(ctx, userID)，构造函数参数从 tokenStore 改 sessionStore
- [ ] 改密 / 重置测试：断言 DeleteByUser 被调一次（替代旧 Delete）
- [ ] response.SetSessionCookie：下发 mimo_session(HttpOnly) + mimo_csrf(非 HttpOnly)，MaxAge=idleTTL
- [ ] response.ClearSessionCookies：清两个 cookie（MaxAge=-1）
- [ ] Login / Google / Github handler：调 login → createSession → SetSessionCookie；响应体 {user_id}；删除 generateCSRFToken 调用（csrf 由 session 自带）
- [ ] Logout handler：从 ctx 取 sessionID 调 logout → ClearSessionCookies
- [ ] middleware 加 SessionIDKey 注入 + GetSessionID(ctx) getter
- [ ] SessionAuth 只读变体（touch=false），/auth/session 挂 OptionalSessionAuth + 只读
- [ ] Handler.Session：读 ctx，未登录 401，已登录返回 claims；测试断言 lookup.Get 被调、**Touch 不被调**（命门不变量①）
- [ ] handler 测试（httptest）：Login 响应 Set-Cookie 含 mimo_session + mimo_csrf；Session 只读不续期
- [ ] `go test ./interfaces/http/handler/auth/` 全绿

## Blocked by
- Issue-0001（SessionAuth + SessionLookup）
- Issue-0002（CreateSessionHandler + login 返回 userID）
