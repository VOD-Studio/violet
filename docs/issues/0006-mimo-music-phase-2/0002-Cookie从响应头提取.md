# Issue-0002：Cookie 从响应头提取

## Parent

PRD：`../../prd/0006-mimo-music-phase-2.md`（user story 3；Implementation Decisions - Cookie 提取）

## What to build

修改 `netease/client.go` 的 `weapiPost` / `postJSON`，从 HTTP 响应头 `Set-Cookie` 提取并拼接成完整 Cookie 字符串返回。`AuthService.LoginByCellphone` / `CheckQrcode` 的返回值 Cookie 字段改为用从响应头提取的真实值，而不是直接拿整个 body 当 Cookie。这是让登录态真正可用的关键——Phase 1 登录返回的 Cookie 不可用，后续带登录态的请求都依赖这一步。提取逻辑要合并多次 Set-Cookie、去重、保留必要字段。

## Acceptance criteria

- [ ] `netease/client.go` 的 `weapiPost` / `postJSON` 从响应头 `Set-Cookie` 提取 Cookie，拼成 `k=v; k=v` 字符串
- [ ] `AuthService.LoginByCellphone` 返回的 Cookie 字段为响应头提取的真实值（非整个 body）
- [ ] `AuthService.CheckQrcode` 在 code=803（登录成功）时返回响应头提取的真实 Cookie
- [ ] 多个 Set-Cookie 合并去重，`MUSIC_U` 等关键字段正确保留
- [ ] 手动验证：登录后拿到的 Cookie 可用于后续网易云请求（如 LoginStatus 或歌单接口）
- [ ] 单元测试：构造带 Set-Cookie 的 httptest.Response，验证提取结果
- [ ] 所有导出符号有 godoc 注释

## Blocked by

- Issue-0001（Redis 接入，提取的 Cookie 要写入 SessionStore 才能复用）
