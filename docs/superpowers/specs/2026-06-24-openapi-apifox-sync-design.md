# 设计：后端接口同步到 Apifox Mimo Blog

- 日期：2026-06-24
- 状态：已批准（待写实施计划）
- 相关：Apifox 项目 Mimo Blog（ID `8484856`，当前 0 接口）

## 1. 背景与目标

后端（`api/`，Go + chi router）注册了 90+ HTTP 接口（清单见 `api/cmd/server/main.go:180-432`），但这些接口没有以任何机器可读形式（OpenAPI/Swagger）存在，无法在 Apifox 中被高效管理。

目标：**把全部 90+ 后端接口，以尽量完整的字段精度，同步到 Apifox 的 Mimo Blog 项目**，并建立长期可重复同步的闭环。

### 关键决策（来自头脑风暴）

| 维度 | 选定方案 | 理由 |
|---|---|---|
| 接口定义来源 | 方案 A：一次性脚本生成 → 进化为静态代码反推 | 不侵入业务代码 |
| 字段精度 | 方案 3：尽量完整（request body / query / path / 响应体 / 错误响应） | 满足"全部录入并可用" |
| 字段数据来源 | 方案 a：纯静态代码反推（handler/service/model/sqlc） | 最可靠，不依赖运行态 |
| 导入策略 | ii：auto-import 持续同步 | 后续改接口可一键同步 |
| OpenAPI 源 | α：后端新增 `/api/v1/openapi.json` 端点，运行时实时生成 | 唯一真源，符合持续同步 |
| 实现方式 | Approach 2：引入 kin-openapi 库流式构建 spec | 类型安全、声明式、生态主流 |

## 2. 总体架构与数据流

```
 ┌─────────────────────────────────────────────────────────────┐
 │ 后端 Go 服务（api/）                                          │
 │                                                              │
 │  现有：90+ 路由注册于 main.go /api/v1/*                       │
 │                                                              │
 │  新增：api/internal/openapi 包（kin-openapi）                │
 │    ├─ spec.go      Build() *openapi3.T   ← 组装 spec 数据     │
 │    ├─ schemas.go   公共 schema（Envelope/Pagination/Error）  │
 │    ├─ auth.go      SecurityScheme（cookieAuth + CSRF 描述）  │
 │    └─ paths_*.go   按模块分文件注册 paths                     │
 │                                                              │
 │  新增路由：GET /api/v1/openapi.json  →  返回 Build() 的 JSON  │
 └───────────────────────────┬─────────────────────────────────┘
                             │ 服务运行时实时生成
                             ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ Apifox 项目：Mimo Blog (8484856)                             │
 │                                                              │
 │  日常（本地）：apifox import --format openapi --file          │
 │  部署后：    auto-import 指向 http://<host>/api/v1/openapi.json│
 └─────────────────────────────────────────────────────────────┘
```

**唯一真源 = 后端 `Build()` 函数**。改接口 → 改 openapi 包对应注册代码 → 重启服务即更新 → Apifox 重新同步。

## 3. 后端改动设计

### 3.1 新增依赖

`github.com/getkin/kin-openapi`（最新稳定版，加入 `go.mod`）。

### 3.2 新增包 `api/internal/openapi/`

| 文件 | 职责 |
|---|---|
| `spec.go` | `Build() *openapi3.T`：组装顶层 Info/Servers/SecuritySchemes，遍历调用各模块 path 注册函数；提供 `JSON() ([]byte, error)` 便捷方法 |
| `schemas.go` | 公共 schema：`Envelope`（`{data, meta}`）、`Pagination`、`ErrorResponse`（`{error, message, request_id}`）、分页 query 参数定义 |
| `auth.go` | SecurityScheme 定义：`cookieAuth`（type=apiKey, in=cookie），并在顶层 info/description 说明 CSRF（`X-CSRF-Token`）机制 |
| `paths_public.go` | 公开接口：health、settings、github、announcements、projects（公开）、emojis（公开） |
| `paths_auth.go` | 认证模块 |
| `paths_post.go` | 文章前台 + 后台 |
| `paths_tag.go` | 标签 |
| `paths_comment.go` | 评论 + 评论反应 |
| `paths_media.go` | 媒体 + 分片上传 |
| `paths_music.go` | 音乐公开接口 |
| `paths_admin_user.go` | 后台用户管理 |
| `paths_admin_rbac.go` | 角色 + 权限 |
| `paths_admin_content.go` | 公告/项目/统计/日志后台 |
| `paths_admin_music.go` | 音乐后台（歌单 CRUD） |
| `paths_admin_emoji.go` | 表情后台 |
| `spec_test.go` | 测试：Build() 不报错、Path 数 ≥ 90、关键 schema 字段存在、JSON 可序列化 |

**为什么按模块分文件**：与 main.go 路由按领域组织保持一致，改某模块只动一个文件。

### 3.3 接口注册范式

每个接口要素齐全：

- method、path、`summary`、`tags`（= 模块名，决定 Apifox 目录分组）
- `security`：公开接口留空；登录接口 `cookieAuth`；管理员/超管接口 `cookieAuth` + description 标注权限层级
- `parameters`：path 参数（`{id}`/`{slug}`/`{uploadId}` …）、query 参数（分页 `page`/`limit`/`cursor`、筛选 `tag`/`status` …）
- `requestBody`：从 handler 内 request struct 抄字段；`validate` tag 转换：
  - `required` → `required: true`
  - `oneof=a b c` → schema `enum: [a,b,c]`
- `responses`：
  - 200/201 → Envelope 包裹具体 schema（响应体从 service DTO / GORM model 反推）
  - 删除/更新 → Envelope `{meta:{message}}`
  - 204 → 无内容
  - 4xx → 统一 `ErrorResponse` schema
- 限流接口：在 `description` 中标注（OpenAPI 无限流正式字段）

### 3.4 新增路由

在 `main.go` 的 `v1.Route("/api/v1", func(v1 chi.Router){...})` 回调**最开头**、`v1.Use(middleware.CSRF(...))` 之前注册：

```go
r.Route("/api/v1", func(v1 chi.Router) {
    // ★ 在 CSRF/其他中间件 Use 之前注册，确保 GET openapi.json 无需 CSRF token
    v1.Get("/openapi.json", openapiHandler)

    v1.Use(middleware.CSRF(cfg.Cookie, nil))
    // ... 其余路由
})
```

`openapiHandler`（实现在 openapi 包，导出一个 `Handler() http.HandlerFunc`）：

```go
func Handler() http.HandlerFunc {
    spec, _ := Build() // 启动期或首次调用时构造一次（可缓存）
    b, _ := json.MarshalIndent(spec, "", "  ")
    return func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        w.Write(b)
    }
}
```

> 注：放在 CSRF 之前确保无需 token；鉴权也免（OpenAPI 文档仅结构描述，不含敏感数据）。生产环境若担心暴露路由清单，可后续加配置开关控制访问，首版不做。

### 3.5 字段反推来源

| 信息 | 反推来源 |
|---|---|
| 请求体字段 | handler 文件内的 `xxxRequest` struct（json tag + validate tag） |
| 响应体字段 | service 方法返回的 DTO struct / GORM model 字段（json tag） |
| query 参数 | handler 内 `r.URL.Query().Get(...)` / `response.ParsePaging` |
| path 参数 | handler 内 `r.PathValue(...)` + 路由定义 |
| 公共结构 | `api/internal/interfaces/http/response/response.go` 的 `Envelope`/`Meta`/`Pagination` |

诚实留白：极少数无法静态确定的动态聚合字段，标 `description: "动态字段，待补充"`，不编造。

## 4. Apifox 端接入

1. **起服务**：`make dev`，确认 `GET /api/v1/openapi.json` 返回有效 OpenAPI 3.0 JSON。
2. **校验**：用 `apifox cli-schema` 校验 JSON 结构合法性。
3. **首次全量导入**：
   ```
   apifox import --project 8484856 --format openapi --file ./openapi.json
   ```
   验证目录树 + 接口齐全（数量 ≥ 90）。
4. **配置 auto-import**（部署后启用）：
   ```
   apifox import auto-import create --project 8484856 --file ./auto-import.json
   ```
   数据源指向 `http://<host>/api/v1/openapi.json`，建立持续同步闭环。
5. **抽样核对**：在 Apifox UI 中抽查若干接口的字段、鉴权标记、目录分组是否正确。

### auto-import 现实约束

auto-import 的 URL 模式需要 Apifox 云端能访问到 OpenAPI 源。**本地开发服务（localhost）Apifox 云端拉不到**。

因此采用**分两步走**：
- **首版**（本地）：用 `apifox import --format openapi --file <本地文件>` 完成"全部录入"目标。
- **部署后**：服务有公网/内网可达地址后，启用 auto-import 的 URL 模式，实现真正自动同步。

期间日常同步流程：改后端 → `curl localhost:<port>/api/v1/openapi.json > openapi.json` → `apifox import --file openapi.json`（或脚本一键化）。

## 5. 覆盖范围

全部 90+ 接口，覆盖以下模块（对应 `paths_*.go` 文件）：

- 公开：health、settings、github、announcements、projects、emojis
- 认证：register/login/refresh/logout/me/profile/password/forgot/reset/verify-email/csrf-token
- 文章：前台 List/GetBySlug/IncrementView + 后台 CRUD/status
- 标签：List + 后台 Create/Delete
- 评论：列表/创建/审核/删除 + 评论反应（含批量）
- 媒体：详情/列表/删除/批量删除/缩略图 + 分片上传 5 个
- 音乐：公开 8 个 + 后台歌单 CRUD ~12 个 + 设置
- 后台：用户管理 9 个、角色/权限 10 个、统计 2 个、日志 2 个、设置 2 个、公告 CRUD 5 个、表情后台、项目 CRUD、文件管理

## 6. 不做的事（YAGNI）

- ❌ 不引入 Swagger UI / `/docs` 端点（除非后续明确需要）
- ❌ 不做 request/response 的 example value（字段 schema 足够，Apifox 自动生成示例）
- ❌ 不改任何现有业务代码（openapi 包为纯新增，handler/service 一行不动）
- ❌ 不做 Mock 期望、Apifox 测试用例（超出范围）
- ❌ 不为本地服务搭建内网穿透去喂 auto-import（首版用文件导入）

## 7. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 90+ 接口静态反推字段，工作量大 | 用并行子 agent 按模块分包反推，加快铺量 |
| 字段反推有出入（漏字段/类型错） | 抽样核对 + spec_test 校验关键字段；后续可接真实抓包校准 |
| auto-import 本地不可用 | 首版文件导入兜底，部署后启用 URL 模式 |
| kin-openapi 库锁定 | OpenAPI 3.0 数据结构稳定，库 API 稳定；如需可替换为其他库，spec 数据不变 |

## 8. 验收标准

1. `api/internal/openapi` 包编译通过，`go test ./internal/openapi/...` 通过。
2. 后端启动后 `GET /api/v1/openapi.json` 返回合法 OpenAPI 3.0 JSON（`apifox cli-schema` 校验通过）。
3. Apifox Mimo Blog 项目中接口数 ≥ 90，目录按模块分组，字段、鉴权、参数基本齐全。
4. 抽样接口（至少每个模块 1 个）在 Apifox 中字段正确。
