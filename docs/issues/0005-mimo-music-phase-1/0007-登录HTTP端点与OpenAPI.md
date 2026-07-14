# Issue-0007：登录 HTTP 端点 + OpenAPI

## Parent

PRD：`../../prd/0005-mimo-music-phase-1.md`（user stories 1-5, 26-27）

## What to build

把登录能力通过 HTTP 暴露出来。6 个端点，统一信封响应。同时建立 OpenAPI 3.0 spec 的骨架和登录端点的文档，可导出 openapi.json 并导入 Apifox。

handler 是薄层：解析请求 → 调 service/auth → 封装响应。错误统一映射到 HTTP status + 信封 code。

## Acceptance criteria

- [ ] `mimo-music/internal/server/handler/auth.go`：6 个登录端点
  - `POST /api/v1/auth/captcha` —— body: `{phone}` —— 发送验证码
  - `POST /api/v1/auth/login/cellphone` —— body: `{phone, captcha}` —— 手机号登录
  - `GET /api/v1/auth/login/qrcode` —— 返回二维码图片和 key
  - `GET /api/v1/auth/login/qrcode/check?key=` —— 轮询登录状态
  - `GET /api/v1/auth/status` —— 查询当前登录态
  - `POST /api/v1/auth/logout` —— 登出
- [ ] handler 用 validator 校验请求体
- [ ] 统一错误码到 HTTP status 映射（ErrUnauthorized→401, ErrRateLimited→429, ErrNotFound→404, ErrUpstreamUnavailable→502）
- [ ] `mimo-music/internal/server/router.go`：注册 auth 路由组
- [ ] `mimo-music/openapi/openapi.go`：OpenAPI 3.0 spec 骨架（info / servers / 统一响应 schema）
- [ ] `mimo-music/openapi/paths/auth.go`：6 个 auth 端点的 path 定义
- [ ] `mimo-music/cmd/export-openapi/main.go`：导出 openapi.json
- [ ] `make music-openapi` 生成 openapi.json（Makefile target，Apifox import 命令预留项目 ID）
- [ ] HTTP 集成测试（mock service）：
  - 响应信封格式正确
  - 错误码到 HTTP status 映射正确
  - 访问日志中间件输出正确字段
- [ ] 所有导出符号有 godoc 注释

## Blocked by

- Issue-0003（config + Makefile）
- Issue-0006（登录 service）

## 进一步说明

Apifox 项目 ID 需要你新建一个 mimo-music 的 Apifox 项目后提供。先预留 target，ID 填入后即可 `make music-openapi` 一键导入。
