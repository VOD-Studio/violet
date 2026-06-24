# OpenAPI 接口同步到 Apifox Mimo Blog 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为后端 90+ HTTP 接口生成完整的 OpenAPI 3.0 文档，通过 `/api/v1/openapi.json` 端点暴露，并导入到 Apifox 的 Mimo Blog 项目（ID `8484856`）。

**Architecture:** 新增纯 `api/internal/openapi` 包（基于 kin-openapi v0.140.0），手写组装 spec 数据（不注解、不反射），按模块分文件注册 paths；后端新增 `GET /api/v1/openapi.json` 端点实时返回；Apifox 通过本地文件 import 全量录入。不改动任何现有业务代码。

**Tech Stack:** Go 1.25、kin-openapi v0.140.0、chi router、Apifox CLI 2.2.4

**字段数据来源：** 全部从静态代码反推（详见各任务），来源已由勘察确认（handler request struct / service DTO / domain model）。

---

## 全局约定（所有任务遵循）

### 响应信封（`api/internal/interfaces/http/response/response.go:31-50`）

所有成功响应被 `Envelope{Data, Meta}` 包裹：
- 数据：`{"data": <T>}`
- 分页：`{"data": [<T>], "meta": {"pagination": {page,limit,total,total_pages,has_more}}}`
- 消息：`{"data": null, "meta": {"message": "..."}}`

错误响应（`response/error.go:22-27`）：`{"error":"<CODE>","message":"...","request_id":"...","details":{...}}`

### 鉴权（main.go 路由分组）
- 公开：无 security
- 登录：`cookieAuth`（access cookie）
- 管理员：`cookieAuth` + 标注 admin
- 超级管理员：`cookieAuth` + 标注 superadmin
- 所有非 GET 写操作需 `X-CSRF-Token` 头（main.go:185）

### 分页 query 默认值（response.go:136-159）
`page` 默认 1；`limit` 默认 20、上限 100（个别接口上限 50）。

---

## File Structure

新建 `api/internal/openapi/` 包：

| 文件 | 职责 |
|---|---|
| `openapi.go` | `Spec()` 构建顶层 `*openapi3.T`（Info/Servers/SecuritySchemes），调用各模块注册函数；`Handler()` 返回 http.HandlerFunc；缓存构建结果 |
| `schemas.go` | 公共 schema：Envelope/Meta/Pagination/ErrorResponse、ID query 参数、分页 query 参数工厂 |
| `security.go` | cookieAuth SecurityScheme + CSRF header 参数描述 |
| `shared.go` | 复用的 `*openapi3.Schema` 构建辅助（简化字段定义的 helper） |
| `paths_public.go` | health/settings/github/announcements/projects(公开)/emojis(公开) |
| `paths_auth.go` | 认证 11 个接口 |
| `paths_post.go` | 文章 9 个接口 |
| `paths_tag.go` | 标签 3 个 |
| `paths_comment.go` | 评论 + 评论反应 16 个 |
| `paths_media.go` | 媒体 + 分片上传 10 个 |
| `paths_music.go` | 音乐公开 8 个 |
| `paths_admin_user.go` | 用户管理 9 个 |
| `paths_admin_rbac.go` | 角色权限 11 个 |
| `paths_admin_stats.go` | 统计 2 个 |
| `paths_admin_settings.go` | 设置 2 个 + 日志 2 个 |
| `paths_admin_announcement.go` | 公告 CRUD 5 个 |
| `paths_admin_music.go` | 音乐后台歌单 12 个 + 设置 1 个 |
| `paths_admin_emoji.go` | 表情后台 12 个 |
| `paths_admin_file.go` | 文件管理 3 个 |
| `openapi_test.go` | 综合测试：path 数、关键字段、JSON 序列化 |

修改 `api/cmd/server/main.go`：注册 `/api/v1/openapi.json` 端点。
修改 `api/go.mod` / `api/go.sum`：添加 kin-openapi 依赖。

---

## Task 1: 添加 kin-openapi 依赖与包骨架

**Files:**
- Create: `api/internal/openapi/openapi.go`
- Create: `api/internal/openapi/openapi_test.go`
- Modify: `api/go.mod`, `api/go.sum`

- [ ] **Step 1: 添加依赖**

```bash
cd /Users/issuser/Developer/xfy/mimo-blog/api
go get github.com/getkin/kin-openapi@v0.140.0
```
Expected: go.mod 增加 `github.com/getkin/kin-openapi v0.140.0`，go.sum 更新。

- [ ] **Step 2: 写 openapi.go 骨架（只含 Spec() 返回最小 T）**

```go
// Package openapi 为博客后端构建 OpenAPI 3.0 文档。
//
// 本包纯手写组装 spec 数据（不依赖注解/反射），按模块分文件注册 paths。
// 字段来源：handler request struct / service DTO / domain model 的静态反推。
package openapi

import (
	"encoding/json"
	"net/http"
	"sync"

	"github.com/getkin/kin-openapi/openapi3"
)

var (
	cacheOnce sync.Once
	cachedSpec *openapi3.T
	cachedJSON []byte
	cachedErr  error
)

// Spec 构建并缓存完整的 OpenAPI 3.0 文档（构建一次后复用）。
func Spec() (*openapi3.T, error) {
	cacheOnce.Do(func() {
		cachedSpec, cachedErr = build()
	})
	return cachedSpec, cachedErr
}

// JSON 返回序列化后的 OpenAPI JSON 字节（构建一次后复用）。
func JSON() ([]byte, error) {
	cacheOnce.Do(func() {
		s, err := build()
		if err != nil {
			cachedErr = err
			return
		}
		cachedSpec = s
		cachedJSON, cachedErr = json.MarshalIndent(s, "", "  ")
	})
	return cachedJSON, cachedErr
}

// Handler 返回提供 /openapi.json 的 HTTP handler。
func Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		b, err := JSON()
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(b)
	}
}

// build 组装顶层 spec：Info/Servers/SecuritySchemes，并调用各模块 path 注册。
// 各 paths_*.go 文件通过 registerXXXPaths(t) 形式的函数挂载到 t。
func build() (*openapi3.T, error) {
	t := &openapi3.T{
		OpenAPI: "3.0.3",
		Info: &openapi3.Info{
			Title:       "Mimo Blog API",
			Description: "全栈博客平台后端接口文档。鉴权采用 Cookie + CSRF Token（X-CSRF-Token 头），所有非 GET 写操作需携带有效的 CSRF Token。",
			Version:     "2.0.0",
		},
		Servers: openapi3.Servers{
			&openapi3.Server{URL: "/api/v1", Description: "API v1 前缀"},
		},
		Paths:      openapi3.Paths{},
		Components: openapi3.Components{},
	}

	// 注册公共 schema 与 security scheme（schemas.go / security.go）
	registerCommonSchemas(t)
	registerSecuritySchemes(t)

	// 各模块 path 注册（paths_*.go）。首版先不调，Task 2+ 逐步放开。
	// registerPublicPaths(t)
	// registerAuthPaths(t)
	// ... 完整列表见各 Task

	return t, nil
}
```

- [ ] **Step 3: 写失败测试 openapi_test.go**

```go
package openapi

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSpec_BuildsWithoutError(t *testing.T) {
	spec, err := Spec()
	require.NoError(t, err)
	require.NotNil(t, spec)
	require.Equal(t, "3.0.3", spec.OpenAPI)
	require.Equal(t, "Mimo Blog API", spec.Info.Title)
	require.Equal(t, "2.0.0", spec.Info.Version)
	require.Equal(t, "/api/v1", spec.Servers[0].URL)
}

func TestSpec_JSONSerializable(t *testing.T) {
	b, err := JSON()
	require.NoError(t, err)
	require.NotEmpty(t, b)

	var m map[string]any
	require.NoError(t, json.Unmarshal(b, &m))
	require.Equal(t, "3.0.3", m["openapi"])
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd /Users/issuser/Developer/xfy/mimo-blog/api
go test ./internal/openapi/... -run 'TestSpec' -v
```
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add api/internal/openapi/openapi.go api/internal/openapi/openapi_test.go api/go.mod api/go.sum
git commit -m "feat(openapi): 新增 openapi 包骨架与 kin-openapi 依赖"
```

---

## Task 2: 公共 schema 与 security（schemas.go / security.go / shared.go）

**Files:**
- Create: `api/internal/openapi/schemas.go`
- Create: `api/internal/openapi/security.go`
- Create: `api/internal/openapi/shared.go`
- Modify: `api/internal/openapi/openapi.go`（放开 registerCommonSchemas/registerSecuritySchemes）

- [ ] **Step 1: 写 shared.go（字段构建 helper）**

```go
package openapi

import (
	"github.com/getkin/kin-openapi/openapi3"
)

// strProps 构建字符串属性 map（name -> *SchemaRef）。
// 例：strProps("title", requiredStr(), "slug", requiredStr())
func strProps(fields ...interface{}) openapi3.Schemas {
	s := openapi3.Schemas{}
	for i := 0; i+1 < len(fields); i += 2 {
		name := fields[i].(string)
		ref := fields[i+1].(*openapi3.SchemaRef)
		s[name] = ref
	}
	return s
}

// reqStr 必填字符串字段
func reqStr(desc string) *openapi3.SchemaRef {
	return &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type:        &openapi3.Types{"string"},
		Description: desc,
	}}
}

// optStr 可选字符串字段
func optStr(desc string) *openapi3.SchemaRef {
	return reqStr(desc)
}

// strEnum 字符串枚举字段
func strEnum(desc string, vals ...string) *openapi3.SchemaRef {
	return &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type:        &openapi3.Types{"string"},
		Description: desc,
		Enum:        enumVals(vals),
	}}
}

// reqInt 必填整数
func reqInt(desc string) *openapi3.SchemaRef {
	return &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type: &openapi3.Types{"integer"}, Description: desc,
	}}
}

// reqInt64 int64 整数
func reqInt64(desc string) *openapi3.SchemaRef {
	return &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type: &openapi3.Types{"integer"}, Format: "int64", Description: desc,
	}}
}

// reqInt32 int32 整数
func reqInt32(desc string) *openapi3.SchemaRef {
	return &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type: &openapi3.Types{"integer"}, Format: "int32", Description: desc,
	}}
}

// reqBool bool 字段
func reqBool(desc string) *openapi3.SchemaRef {
	return &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type: &openapi3.Types{"boolean"}, Description: desc,
	}}
}

// strArray 字符串数组
func strArray(desc string) *openapi3.SchemaRef {
	return &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type: &openapi3.Types{"array"}, Description: desc,
		Items: &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{"string"}}},
	}}
}

func enumVals(vals []string) []openapi3.Value {
	out := make([]openapi3.Value, len(vals))
	for i, v := range vals {
		out[i] = v
	}
	return out
}
```

- [ ] **Step 2: 写 schemas.go（Envelope/Meta/Pagination/ErrorResponse + query 参数工厂）**

```go
package openapi

import "github.com/getkin/kin-openapi/openapi3"

const (
	compEnvelope      = "Envelope"
	compEnvelopeData  = "EnvelopeData"  // data 单对象，泛型描述为 any
	compMeta          = "Meta"
	compPagination    = "Pagination"
	compMessage       = "MessageResponse"
	compPaged         = "PagedResponse"
	compErrorResponse = "ErrorResponse"
)

// registerCommonSchemas 注册公共组件 schema。
// 注意：OpenAPI 3.0 不支持泛型，Envelope.data 用不带类型的 object 描述，
// 具体接口在 responses 里通过 description 说明 data 的实际类型并 $ref 具体 schema。
func registerCommonSchemas(t *openapi3.T) {
	c := &t.Components

	// Meta
	c.Schemas[compMeta] = &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type: &openapi3.Types{"object"},
		Properties: openapi3.Schemas{
			"message":    optStr("提示消息"),
			"pagination": {Ref: "#/components/schemas/" + compPagination},
		},
	}}

	// Pagination（offset + cursor 合并字段，各接口按需出现）
	c.Schemas[compPagination] = &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type: &openapi3.Types{"object"},
		Properties: openapi3.Schemas{
			"page":        reqInt("当前页码（offset 模式）"),
			"limit":       reqInt("每页条数"),
			"total":       reqInt64("总记录数（offset 模式）"),
			"total_pages": reqInt("总页数（offset 模式）"),
			"has_more":    reqBool("是否还有下一页（cursor 模式）"),
			"next_cursor": optStr("下一页游标（cursor 模式）"),
		},
	}}

	// MessageResponse：{data:null, meta:{message}}
	c.Schemas[compMessage] = &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type: &openapi3.Types{"object"},
		Properties: openapi3.Schemas{
			"data": {Value: &openapi3.Schema{Type: &openapi3.Types{"null"}}},
			"meta": {Ref: "#/components/schemas/" + compMeta},
		},
	}}

	// ErrorResponse
	c.Schemas[compErrorResponse] = &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type: &openapi3.Types{"object"},
		Properties: openapi3.Schemas{
			"error":      reqStr("错误代码"),
			"message":    reqStr("错误描述"),
			"request_id": optStr("请求追踪 ID"),
			"details":    {Value: &openapi3.Schema{
				Type: &openapi3.Types{"object"},
				AdditionalProperties: openapi3.AdditionalProperties{Has: openapi3.Bool(true)},
				Description:          "字段级校验错误详情",
			}},
		},
		Required: openapi3.Strings{"error", "message"},
	}}
}

// pageParam 构建分页 page query 参数（offset 模式，默认 1）
func pageParam() *openapi3.ParameterRef {
	return &openapi3.ParameterRef{Value: &openapi3.Parameter{
		Name: "page", In: "query",
		Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
			Type: &openapi3.Types{"integer"}, Default: 1,
		}},
		Description: "页码，默认 1",
	}}
}

// limitParam 构建分页 limit query 参数（默认 20，max 为上限）
func limitParam(max int) *openapi3.ParameterRef {
	return &openapi3.ParameterRef{Value: &openapi3.Parameter{
		Name: "limit", In: "query",
		Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
			Type: &openapi3.Types{"integer"}, Default: 20, Max: float64Ptr(max),
		}},
		Description: "每页条数，默认 20",
	}}
}

// dataResponse 包装一个 data schema 到 Envelope 响应（具体类型用 description 说明）
func dataResponse(dataSchemaName, desc string, status int) *openapi3.ResponseRef {
	respRef := "#/components/schemas/" + dataSchemaName
	return &openapi3.ResponseRef{Value: &openapi3.Response{
		Description: desc,
		Content: openapi3.Content{
			"application/json": &openapi3.MediaType{Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
				Type: &openapi3.Types{"object"},
				Properties: openapi3.Schemas{
					"data": {Ref: respRef},
					"meta": {Ref: "#/components/schemas/" + compMeta},
				},
			}}},
		},
	}}
}

// messageResponse 消息响应（data:null + meta.message）
func messageResponse(desc string) *openapi3.ResponseRef {
	return &openapi3.ResponseRef{Value: &openapi3.Response{
		Description: desc,
		Content: openapi3.Content{
			"application/json": &openapi3.MediaType{
				Schema: &openapi3.SchemaRef{Ref: "#/components/schemas/" + compMessage},
			},
		},
	}}
}

// errorResponse 错误响应
func errorResponse(desc string) *openapi3.ResponseRef {
	return &openapi3.ResponseRef{Value: &openapi3.Response{
		Description: desc,
		Content: openapi3.Content{
			"application/json": &openapi3.MediaType{
				Schema: &openapi3.SchemaRef{Ref: "#/components/schemas/" + compErrorResponse},
			},
		},
	}}
}

// jsonBody 构建请求体（application/json）
func jsonBody(schemaName string, required bool, desc string) *openapi3.RequestBodyRef {
	return &openapi3.RequestBodyRef{Value: &openapi3.RequestBody{
		Description: desc,
		Required:    required,
		Content: openapi3.Content{
			"application/json": &openapi3.MediaType{
				Schema: &openapi3.SchemaRef{Ref: "#/components/schemas/" + schemaName},
			},
		},
	}}
}

// registerSchema 在 Components 注册一个命名 schema（fields 为属性表）
func registerSchema(t *openapi3.T, name string, fields openapi3.Schemas, required ...string) {
	t.Components.Schemas[name] = &openapi3.SchemaRef{Value: &openapi3.Schema{
		Type: &openapi3.Types{"object"}, Properties: fields, Required: required,
	}}
}

func float64Ptr(i int) *float64 {
	f := float64(i)
	return &f
}
```

- [ ] **Step 3: 写 security.go（cookieAuth + CSRF 参数）**

```go
package openapi

import "github.com/getkin/kin-openapi/openapi3"

const (
	secCookieAuth = "cookieAuth"
)

// registerSecuritySchemes 注册 cookieAuth scheme（access token 走 HttpOnly cookie）。
func registerSecuritySchemes(t *openapi3.T) {
	t.Components.SecuritySchemes = openapi3.SecuritySchemes{
		secCookieAuth: &openapi3.SecuritySchemeRef{Value: &openapi3.SecurityScheme{
			Type:        "apiKey",
			In:          "cookie",
			Name:        "access_token",
			Description: "登录后服务端下发的 access token cookie（HttpOnly）。登录/刷新接口会自动设置。",
		}},
	}
}

// securityCookie 返回 cookieAuth 安全要求（用于登录态接口）
func securityCookie() openapi3.SecurityRequirements {
	return openapi3.SecurityRequirements{
		{secCookieAuth: {}},
	}
}

// csrfHeaderParam 构建非 GET 写操作所需的 X-CSRF-Token 头参数
func csrfHeaderParam() *openapi3.ParameterRef {
	return &openapi3.ParameterRef{Value: &openapi3.Parameter{
		Name: "X-CSRF-Token", In: "header", Required: true,
		Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{"string"}}},
		Description: "CSRF Token，所有非 GET 写操作必需。通过 GET /auth/csrf-token 获取，与 mimo_csrf cookie 配套。",
	}}
}
```

- [ ] **Step 4: 放开 openapi.go 的 register 调用**

将 `build()` 中的 `registerCommonSchemas(t)` 和 `registerSecuritySchemes(t)` 注释保留为已调用（Task 1 中已是调用状态，无需改）。确认 `t.Components.Schemas = openapi3.Schemas{}` 在 registerCommonSchemas 前初始化。

在 `build()` 顶部 `t.Components` 初始化处补充：

```go
Components: openapi3.Components{
    Schemas:         openapi3.Schemas{},
    SecuritySchemes: openapi3.SecuritySchemes{},
},
```

- [ ] **Step 5: 写测试验证公共 schema 存在**

在 `openapi_test.go` 追加：

```go
func TestCommonSchemas(t *testing.T) {
	spec, _ := Spec()
	require.Contains(t, spec.Components.Schemas, "Envelope")
	require.Contains(t, spec.Components.Schemas, "Pagination")
	require.Contains(t, spec.Components.Schemas, "ErrorResponse")
	require.Contains(t, spec.Components.SecuritySchemes, "cookieAuth")
}
```

- [ ] **Step 6: 运行测试**

```bash
go test ./internal/openapi/... -v
```
Expected: 3 个测试 PASS。

- [ ] **Step 7: 提交**

```bash
git add api/internal/openapi/
git commit -m "feat(openapi): 公共 schema、security scheme 与构建 helper"
```

---

## Task 3: 公开接口（paths_public.go）

**Files:**
- Create: `api/internal/openapi/paths_public.go`
- Modify: `api/internal/openapi/openapi.go`（放开 registerPublicPaths）

覆盖接口（字段来源已勘察）：
- GET `/settings` → SiteSettings（公开版，见 settings handler）
- GET `/github/contributions` → GitHub 贡献数据
- GET `/github/repos` → GitHub 仓库数据
- GET `/projects` → ProjectDTO[]（非分页，content.go:149）
- GET `/projects/{id}` → ProjectDTO
- GET `/announcements` → AnnouncementDTO[]（非分页，content.go:42）
- GET `/emojis` → EmojiGroupDTO[]（含 emojis）
- GET `/emojis/groups/{name}` → EmojiGroupDTO
- GET `/health`（在 v1 外，main.go:169，返回 `{"status":"ok"}`）

**ProjectDTO 字段**（`application/project/service.go:12-22`）：id(string)、title、description、url、github_url、image_url、tech_stack([]string)、sort_order(int)、created_at(string)

**AnnouncementDTO 字段**（`application/announcement/service.go:12-21`）：id(int32)、title、content、type(string,enum:info/warning/success/error)、is_active(bool)、start_time(string,可空)、end_time(string,可空)、created_at(string)

**EmojiGroupDTO 字段**（`application/media/service.go:26-33`）：id(int32)、name、source、sort_order(int)、is_enabled(bool)、emojis([]EmojiDTO)
**EmojiDTO 字段**（service.go:36-45）：id(int32)、group_id(int32)、name、url、source_url、gif_url、text_content、sort_order(int)

- [ ] **Step 1: 写 paths_public.go，注册上述接口的完整 path/schema**

对每个接口：定义 schema（registerSchema）、设置 Operation（summary/tags/parameters/responses/security）、挂到 t.Paths。GET 无 security。

ProjectDTO、AnnouncementDTO、EmojiGroupDTO、EmojiDTO 各注册为命名 schema，GET 列表/详情响应用 dataResponse 包装。

`/health` 单独处理（不在 v1 前缀，响应 `{"status":"ok"}`）。

- [ ] **Step 2: 放开 registerPublicPaths(t) 调用**

在 `build()` 中取消 `// registerPublicPaths(t)` 注释。

- [ ] **Step 3: 测试 paths 数递增**

在 `openapi_test.go` 追加：

```go
func TestPublicPaths(t *testing.T) {
	spec, _ := Spec()
	require.NotNil(t, spec.Paths.Find("/settings"))
	require.NotNil(t, spec.Paths.Find("/projects"))
	require.NotNil(t, spec.Paths.Find("/projects/{id}"))
	require.NotNil(t, spec.Paths.Find("/announcements"))
	require.NotNil(t, spec.Paths.Find("/emojis"))
	require.NotNil(t, spec.Paths.Find("/emojis/groups/{name}"))
}
```

- [ ] **Step 4: 运行测试**

```bash
go test ./internal/openapi/... -run 'TestPublic' -v
```
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add api/internal/openapi/
git commit -m "feat(openapi): 公开接口（settings/github/projects/announcements/emojis/health）"
```

---

## Task 4: 认证接口（paths_auth.go）

**Files:**
- Create: `api/internal/openapi/paths_auth.go`
- Modify: `api/internal/openapi/openapi.go`

覆盖 11 个认证接口（字段来源：`handler/auth/auth.go`、`application/auth/command`、`application/auth/query/auth_queries.go`）：

| 接口 | 请求体 | 响应 data | 状态码 | 鉴权 | 限流 |
|---|---|---|---|---|---|
| GET `/auth/csrf-token` | 无 | `{csrf_token: string}` | 200 | 公开 | 无 |
| POST `/auth/register` | RegisterReq{email*,username*(3-32),password*(min8)} | null+message | 201 | 公开 | AuthRateLimit |
| POST `/auth/verify-email` | {email*,code*} | null+message | 200 | 公开 | AuthRateLimit |
| POST `/auth/login` | {email*,password*} | {access_token,expires_in,refresh_expires_in,token_type} | 200 | 公开 | AuthRateLimit |
| POST `/auth/refresh` | {refresh_token?}(cookie优先) | 同 login data | 200 | 公开 | AuthRateLimit |
| POST `/auth/forgot-password` | {email*} | null+message | 200 | 公开 | AuthRateLimit |
| POST `/auth/reset-password` | {email*,code*,new_password*(min8)} | null+message | 200 | 公开 | AuthRateLimit |
| POST `/auth/logout` | 无 | null+message | 200 | 登录 | 无 |
| GET `/auth/me` | 无 | UserDTO | 200 | 登录 | 无 |
| PATCH `/auth/profile` | {username?,bio?,avatar_url?} | {id,username,email,avatar_url,bio,role} | 200 | 登录 | 无 |
| PATCH `/auth/password` | {old_password*,new_password*(min8)} | null+message | 200 | 登录 | 无 |

**UserDTO 字段**（`auth_queries.go:13-24`）：id、username、email、avatar_url、bio、role(enum:user/admin/superadmin)、email_verified(bool)、is_active(bool)、created_at、permissions([]string)

限流接口在 description 标注「受认证限流保护」。写操作（POST/PATCH）加 csrfHeaderParam。login/refresh 响应的 refresh_token 只走 cookie，不在 body 字段（在 description 注明）。

- [ ] **Step 1: 写 paths_auth.go，注册 UserDTO / LoginToken / 各请求体 schema + 11 个 path**

- [ ] **Step 2: 放开 registerAuthPaths(t)**

- [ ] **Step 3: 测试**

```go
func TestAuthPaths(t *testing.T) {
	spec, _ := Spec()
	for _, p := range []string{"/auth/register", "/auth/login", "/auth/me", "/auth/profile", "/auth/password"} {
		require.NotNil(t, spec.Paths.Find(p), "missing %s", p)
	}
	require.Contains(t, spec.Components.Schemas, "UserDTO")
}
```

- [ ] **Step 4: 运行测试并提交**

```bash
go test ./internal/openapi/... -run TestAuth -v
git add api/internal/openapi/ && git commit -m "feat(openapi): 认证接口 11 个（register/login/refresh/me/profile/password 等）"
```

---

## Task 5: 文章接口（paths_post.go）

**Files:**
- Create: `api/internal/openapi/paths_post.go`
- Modify: `api/internal/openapi/openapi.go`

**PostDTO 字段**（`application/post/service.go:13-31`）：id、title、slug、content_md、content_html、excerpt、cover_image、status(enum:draft/published/archived)、author_id、view_count(int)、is_featured(bool)、seo_title、seo_description、published_at(可空)、tags([]string)、created_at、updated_at

| 接口 | query/path | 请求体 | 响应 | 状态码 | 鉴权 |
|---|---|---|---|---|---|
| GET `/posts` | page,limit(max50),tag | — | PostDTO[]+分页 | 200 | 公开 |
| GET `/posts/{slug}` | slug | — | PostDTO | 200 | 公开 |
| POST `/posts/{id}/view` | id | — | 无 body | 204 | 公开 |
| GET `/admin/posts` | page,limit,status | — | PostDTO[]+分页 | 200 | 管理员 |
| GET `/admin/posts/{id}` | id | — | PostDTO | 200 | 管理员 |
| POST `/admin/posts` | — | CreatePostReq | PostDTO | 201 | 管理员 |
| PUT `/admin/posts/{id}` | id | CreatePostReq | message | 200 | 管理员 |
| PATCH `/admin/posts/{id}/status` | id | {status*(enum)} | PostDTO | 200 | 管理员 |
| DELETE `/admin/posts/{id}` | id | — | message | 200 | 管理员 |

**CreatePostRequest 字段**（post.go:73-83）：title*、slug*、content_md、content_html、excerpt、cover_image、seo_title、seo_description、tags([]string)

注意：IncrementView 用 204（无 body），需特殊响应定义（无 content）。DELETE/PUT 返回 message。

> **执行范式（Task 5-16 共用）**：每个 path 模块 Task 的标准 5 步——
> 1. 新建 `paths_xxx.go`：对表格中每个接口，① `registerSchema(t, "XxxDTO", fields..., required...)` 注册请求/响应 schema；② 构建 `&openapi3.Operation{Summary, Tags, Parameters, RequestBody, Responses, Security}`；③ `t.Paths[path] = &openapi3.PathItem{Method: op}`。GET 无 security；登录 `securityCookie()`；管理员 `securityCookie()`+tags 标注 admin；写操作加 `csrfHeaderParam()`。
> 2. 在 `openapi.go` 的 `build()` 中取消对应 `registerXxxPaths(t)` 的注释。
> 3. 在 `openapi_test.go` 追加 `TestXxxPaths`：用 `spec.Paths.Find("/xxx")` 断言关键 path 非 nil，`spec.Components.Schemas` 断言关键 schema 存在。
> 4. `go test ./internal/openapi/... -run TestXxx -v` 验证 PASS。
> 5. `git add api/internal/openapi/ && git commit -m "..."`。
> 字段数据全部取自各 Task 表格，已由勘察确认行号，直接照抄进 `strProps(...)`/`registerSchema(...)`。

- [ ] **Step 1: 写 paths_post.go**（按上述范式，注册 PostDTO/CreatePostRequest schema + 9 个 path）

- [ ] **Step 2: 放开 registerPostPaths(t) 调用**

- [ ] **Step 3: 追加测试 TestPostPaths，验证 /posts、/posts/{slug}、/admin/posts 等 9 个 path 与 PostDTO schema 存在**

```go
func TestPostPaths(t *testing.T) {
	spec, _ := Spec()
	for _, p := range []string{"/posts", "/posts/{slug}", "/posts/{id}/view", "/admin/posts", "/admin/posts/{id}"} {
		require.NotNil(t, spec.Paths.Find(p), "missing %s", p)
	}
	require.Contains(t, spec.Components.Schemas, "PostDTO")
}
```

- [ ] **Step 4: 运行测试**

```bash
go test ./internal/openapi/... -run TestPost -v
```
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add api/internal/openapi/ && git commit -m "feat(openapi): 文章接口 9 个（前台列表/详情/浏览 + 后台 CRUD/状态）"
```

---

## Task 6: 标签接口（paths_tag.go）

**Files:**
- Create: `api/internal/openapi/paths_tag.go`

**TagDTO**（`application/tag/service.go:14-19`）：id(int32)、name、slug

| 接口 | 请求体 | 响应 | 状态码 | 鉴权 |
|---|---|---|---|---|
| GET `/tags` | — | TagDTO[]（非分页） | 200 | 公开 |
| POST `/tags` | {name*} | TagDTO | 201 | 管理员 |
| DELETE `/tags/{id}` | — | message | 200 | 管理员 |

- [ ] **Step 1: 写 paths 文件**（按 Task 5 的执行范式：registerSchema 注册各 DTO/请求体 schema + 按 table 注册每个 path 的 Operation）
- [ ] **Step 2: 在 openapi.go build() 放开对应 registerXxxPaths(t) 调用**
- [ ] **Step 3: 追加 TestXxxPaths 测试**（断言本模块关键 path 与 schema 存在，参考 TestPostPaths 写法）
- [ ] **Step 4: 运行 `go test ./internal/openapi/... -run TestXxx -v` 验证 PASS**
- [ ] **Step 5: 提交**

```bash
git commit -m "feat(openapi): 标签接口 3 个"
```

---

## Task 7: 评论与评论反应接口（paths_comment.go）

**Files:**
- Create: `api/internal/openapi/paths_comment.go`

**CommentDTO**（`application/comment/service.go:13-24`）：id、post_id、parent_id(可空)、depth(int16)、author_name、avatar_url、body、pictures([]Picture)、status(enum:pending/approved/spam/deleted)、created_at
**Picture**（`domain/comment/entity.go:59-64`）：url、width(int)、height(int)、size(int64)
**AdminCommentDTO**（service.go:53-59，内嵌 CommentDTO + post_title + post_slug）
**Reaction**（`domain/commentreaction/entity.go:14-23`）：id(int64)、comment_id、user_id(可空)、emoji_id(int32)、emoji_name、emoji_url、ip_address(可空)、created_at

| 接口 | 请求体 | 响应 | 状态码 | 鉴权 |
|---|---|---|---|---|
| GET `/posts/{postId}/comments` | query:page,limit | CommentDTO[]+分页 | 200 | 公开 |
| POST `/posts/{postId}/comments` | CreateCommentReq{body*,parent_id?,author_name*,author_email*,author_url?,avatar_url?} | CommentDTO | 201 | 公开(限流) |
| PATCH `/comments/{id}/approve` | — | message | 200 | 管理员 |
| PATCH `/comments/{id}/spam` | — | message | 200 | 管理员 |
| DELETE `/comments/{id}` | — | message | 200 | 管理员 |
| GET `/admin/comments/pending` | query:page,limit | CommentDTO[]+分页 | 200 | 管理员 |
| GET `/admin/comments/pending/count` | — | {count:int64} | 200 | 管理员 |
| GET `/admin/comments` | query:page,limit,status | AdminCommentDTO[]+分页 | 200 | 管理员 |
| GET `/admin/comments/{id}` | — | AdminCommentDTO | 200 | 管理员 |
| PATCH `/admin/comments/batch-status` | {ids*(min1,max100),status*(enum)} | {affected:int64} | 200 | 管理员 |
| GET `/comments/{comment_id}/reactions` | — | Reaction[](非分页) | 200 | 公开 |
| POST `/comments/{comment_id}/reactions` | {emoji_id*(int32)} | message | 200 | 公开(限流) |
| DELETE `/comments/{comment_id}/reactions/{emoji_id}` | — | message | 200 | 登录 |
| POST `/comments/reactions/batch` | {comment_ids*(min1)} | BatchResult[] | 200 | 公开 |

BatchResult：{comment_id, reactions:[]Reaction}

注意 AddReaction 公开+限流，RemoveReaction 登录（非 admin）——鉴权标记不同。

- [ ] **Step 1: 写 paths 文件**（按 Task 5 的执行范式：registerSchema 注册各 DTO/请求体 schema + 按 table 注册每个 path 的 Operation）
- [ ] **Step 2: 在 openapi.go build() 放开对应 registerXxxPaths(t) 调用**
- [ ] **Step 3: 追加 TestXxxPaths 测试**（断言本模块关键 path 与 schema 存在，参考 TestPostPaths 写法）
- [ ] **Step 4: 运行 `go test ./internal/openapi/... -run TestXxx -v` 验证 PASS**
- [ ] **Step 5: 提交**

```bash
git commit -m "feat(openapi): 评论与评论反应接口 14 个"
```

---

## Task 8: 媒体与分片上传接口（paths_media.go）

**Files:**
- Create: `api/internal/openapi/paths_media.go`

**FileDTO**（`application/media/service.go:688-699`）：id、owner_id、purpose、original_name、url、size(int64)、mime_type、thumbnail、status、created_at

| 接口 | 请求体 | 响应 | 状态码 | 鉴权 |
|---|---|---|---|---|
| GET `/media/{id}` | — | FileDTO | 200 | 公开 |
| GET `/media` | query:purpose,page,limit | FileDTO[]+分页 | 200 | 登录 |
| DELETE `/media/{id}` | — | message | 200 | 登录 |
| POST `/media/batch-delete` | {ids*(min1)} | {deleted:int} | 200 | 登录 |
| POST `/media/{id}/thumbnail` | multipart:file(binary) | {thumbnail:string} | 200 | 登录 |
| POST `/upload/init` | {fileName*,fileSize*(int64),fileHash?,mimeType?,chunkSize?,purpose?} | InitSessionResult | 200 | 登录(上传限流) |
| PUT `/upload/{uploadId}/chunk/{index}` | 原始二进制 body | message | 200 | 登录(上传限流) |
| POST `/upload/{uploadId}/complete` | — | MergeResult | 200 | 登录(上传限流) |
| DELETE `/upload/{uploadId}` | — | message | 200 | 登录(上传限流) |
| GET `/upload/{uploadId}/status` | — | InitSessionResult | 200 | 登录(上传限流) |

**InitSessionResult**（service.go:727-735）：instant(bool)、file_id(可空)、url(可空)、upload_id(可空)、chunk_size(int)、total_chunks(int)、uploaded_chunks([]int)
**MergeResult**（service.go:837-843）：file_id、url、thumbnail、width(可空)、height(可空)

特殊：UploadThumbnail 和 chunk 上传是 multipart/binary，请求体 schema 用 `type:string, format:binary`。chunk 上传 path 参数 index 为 int。

- [ ] **Step 1: 写 paths 文件**（按 Task 5 的执行范式：registerSchema 注册各 DTO/请求体 schema + 按 table 注册每个 path 的 Operation）
- [ ] **Step 2: 在 openapi.go build() 放开对应 registerXxxPaths(t) 调用**
- [ ] **Step 3: 追加 TestXxxPaths 测试**（断言本模块关键 path 与 schema 存在，参考 TestPostPaths 写法）
- [ ] **Step 4: 运行 `go test ./internal/openapi/... -run TestXxx -v` 验证 PASS**
- [ ] **Step 5: 提交**

```bash
git commit -m "feat(openapi): 媒体与分片上传接口 10 个"
```

---

## Task 9: 音乐公开接口（paths_music.go）

**Files:**
- Create: `api/internal/openapi/paths_music.go`

⚠️ 关键：`EmbedInfo`/`SongMeta`/`PlaylistMeta`（`domain/music/repository.go:38-58`）**无 json tag，字段名 PascalCase**。OpenAPI 里照抄 PascalCase。
**Song**（`domain/music/entity.go:9-15`）有 json tag：name、artist、url、cover。
**PlaylistDTO**（service.go:328-340）：id、title、cover、creator、platform、playlist_id、song_count(int)、songs([]Song)、is_active(bool)、created_at、updated_at（后两个恒空，注明）
**MusicSettingsDTO**（service.go:627-629）：player_version

| 接口 | query | 响应 data | 状态码 |
|---|---|---|---|
| GET `/music/embed` | url* | EmbedInfo{Platform,SongID,EmbedURL} | 200 |
| GET `/music/playlist` | url* | PlaylistMeta{Title,Cover,Creator,Platform,PlaylistID,Songs[]} | 200 |
| GET `/music/song` | id*,platform? | Song | 200 |
| GET `/music/search` | keyword*(别名kw),limit? | Song[] | 200 |
| GET `/music/lyrics` | id*,platform? | string(LRC文本) | 200 |
| GET `/music/meta` | id*,platform? | SongMeta{Cover,Lyrics} | 200 |
| GET `/music/playlists/active` | — | PlaylistDTO[] | 200 |
| GET `/music/settings` | — | MusicSettingsDTO | 200 |

注意 lyrics 的 data 是裸字符串（`{"data":"[00:01.00]..."}`）。

- [ ] **Step 1: 写 paths 文件**（按 Task 5 的执行范式：registerSchema 注册各 DTO/请求体 schema + 按 table 注册每个 path 的 Operation）
- [ ] **Step 2: 在 openapi.go build() 放开对应 registerXxxPaths(t) 调用**
- [ ] **Step 3: 追加 TestXxxPaths 测试**（断言本模块关键 path 与 schema 存在，参考 TestPostPaths 写法）
- [ ] **Step 4: 运行 `go test ./internal/openapi/... -run TestXxx -v` 验证 PASS**
- [ ] **Step 5: 提交**

```bash
git commit -m "feat(openapi): 音乐公开接口 8 个"
```

---

## Task 10: 用户管理后台（paths_admin_user.go）

**Files:**
- Create: `api/internal/openapi/paths_admin_user.go`

**UserDTO（admin）**（`application/useradmin/service.go:41-51`）：id、username、email、role、email_verified(bool)、is_active(bool)、bio、avatar、created_at

| 接口 | 请求体 | 响应 | 状态码 |
|---|---|---|---|
| GET `/admin/users` | query:page,limit,role,is_active,keyword | UserDTO[]+分页 | 200 |
| GET `/admin/users/{id}` | — | UserDTO | 200 |
| POST `/admin/users` | {username*,email*(email),password*(min6),role?,is_active?(*bool)} | UserDTO | 201 |
| PUT `/admin/users/{id}` | {username?,email?,password?,role?,is_active?}全指针 | UserDTO | 200 |
| DELETE `/admin/users/{id}` | — | message | 200 |
| PATCH `/admin/users/{id}/role` | {role*} | message | 200 |
| PATCH `/admin/users/{id}/status` | {is_active(bool值类型)} | message | 200 |
| POST `/admin/users/batch-status` | {ids*(min1),is_active(bool)} | {affected:int64} | 200 |
| POST `/admin/users/batch-role` | {ids*(min1),role*} | {affected:int64} | 200 |

注意 id 为 UUID 字符串；is_active 值类型 bool，OpenAPI 标 required。

- [ ] **Step 1: 写 paths 文件**（按 Task 5 的执行范式：registerSchema 注册各 DTO/请求体 schema + 按 table 注册每个 path 的 Operation）
- [ ] **Step 2: 在 openapi.go build() 放开对应 registerXxxPaths(t) 调用**
- [ ] **Step 3: 追加 TestXxxPaths 测试**（断言本模块关键 path 与 schema 存在，参考 TestPostPaths 写法）
- [ ] **Step 4: 运行 `go test ./internal/openapi/... -run TestXxx -v` 验证 PASS**
- [ ] **Step 5: 提交**

```bash
git commit -m "feat(openapi): 用户管理后台接口 9 个"
```

---

## Task 11: 角色权限后台（paths_admin_rbac.go）

**Files:**
- Create: `api/internal/openapi/paths_admin_rbac.go`

**RoleDTO**（`application/role/dto.go:16-23`）：id(int32)、name、description、permission_codes([]string)、created_at、user_count(int64,可空)
**PermissionDTO**（dto.go:26-31）：id(int32)、code、name、description
**RoleWithPermissionsDTO**（dto.go:34-37）：内嵌 RoleDTO + permissions([]PermissionDTO)

| 接口 | 请求体 | 响应 | 状态码 | 权限 |
|---|---|---|---|---|
| GET `/admin/permissions` | — | PermissionDTO[] | 200 | 管理员 |
| POST `/admin/permissions` | {code*,name*,description?} | {id:int32} | 201 | **超管** |
| PATCH `/admin/permissions/{code}` | {name*,description?} | message | 200 | **超管** |
| DELETE `/admin/permissions/{code}` | — | message | 200 | **超管** |
| GET `/admin/roles` | — | RoleDTO[] | 200 | 管理员 |
| GET `/admin/roles/{id}` | — | RoleWithPermissionsDTO | 200 | 管理员 |
| POST `/admin/roles` | {name*(2-50),description?} | {id:int32} | 201 | 管理员 |
| PATCH `/admin/roles/{id}` | {name?,description?} | message | 200 | 管理员 |
| DELETE `/admin/roles/{id}` | — | message | 200 | 管理员 |
| PATCH `/admin/roles/{id}/permissions` | {permission_codes*} | message | 200 | 管理员 |

注意 permissions 的 CRUD 三接口为超级管理员专用。id 为 int32，permissions path 参数为 code（string）。

- [ ] **Step 1: 写 paths 文件**（按 Task 5 的执行范式：registerSchema 注册各 DTO/请求体 schema + 按 table 注册每个 path 的 Operation）
- [ ] **Step 2: 在 openapi.go build() 放开对应 registerXxxPaths(t) 调用**
- [ ] **Step 3: 追加 TestXxxPaths 测试**（断言本模块关键 path 与 schema 存在，参考 TestPostPaths 写法）
- [ ] **Step 4: 运行 `go test ./internal/openapi/... -run TestXxx -v` 验证 PASS**
- [ ] **Step 5: 提交**

```bash
git commit -m "feat(openapi): 角色权限后台接口 10 个（含超管专用权限 CRUD）"
```

---

## Task 12: 统计/设置/日志后台（paths_admin_stats.go + paths_admin_settings.go）

**Files:**
- Create: `api/internal/openapi/paths_admin_stats.go`
- Create: `api/internal/openapi/paths_admin_settings.go`

**DashboardStats**（`domain/stats/entity.go:7-15`）：total_posts(int64)、total_comments、pending_comments、total_views、total_users、recent_posts([]PostSummary)、popular_posts([]PostSummary)
**PostSummary**（entity.go:18-25）：id、title、slug、status、view_count(int)、published_at(可空)
**ViewTrends**（entity.go:28-31）：daily([]ViewPoint)、monthly([]ViewPoint)
**ViewPoint**（entity.go:34-37）：label、count(int64)
**SiteSettings**（`domain/settings/entity.go:14-27`）：site_name、site_description、site_url、admin_email、posts_per_page(int)、comments_enabled(bool)、comments_moderation(bool)、github_username、github_token、tech_stack、bio、footer_text
⚠️ **AuditLog**（`domain/audit/entity.go:12-22`）无 json tag，PascalCase：ID(int64)、UserID(*string)、Action、Resource、ResourceID、Detail(object)、IPAddress、CreatedAt

| 接口 | query/请求体 | 响应 | 状态码 |
|---|---|---|---|
| GET `/admin/stats` | — | DashboardStats | 200 |
| GET `/admin/stats/views` | — | ViewTrends | 200 |
| GET `/admin/settings` | — | SiteSettings | 200 |
| PUT `/admin/settings` | 全指针 SiteSettings 字段 | SiteSettings | 200 |
| GET `/admin/logs` | query:page,limit | AuditLog[]+分页 | 200 |
| GET `/admin/logs/user/{id}` | path:id(UUID),query:page,limit | AuditLog[]+分页 | 200 |

AuditLog schema 如实写 PascalCase 字段，description 注明「无 json tag，字段名为 Go 默认大写」。

- [ ] **Step 1: 写 paths 文件**（按 Task 5 的执行范式：registerSchema 注册各 DTO/请求体 schema + 按 table 注册每个 path 的 Operation）
- [ ] **Step 2: 在 openapi.go build() 放开对应 registerXxxPaths(t) 调用**
- [ ] **Step 3: 追加 TestXxxPaths 测试**（断言本模块关键 path 与 schema 存在，参考 TestPostPaths 写法）
- [ ] **Step 4: 运行 `go test ./internal/openapi/... -run TestXxx -v` 验证 PASS**
- [ ] **Step 5: 提交**

```bash
git commit -m "feat(openapi): 统计/设置/日志后台接口 6 个"
```

---

## Task 13: 公告管理后台（paths_admin_announcement.go）

**Files:**
- Create: `api/internal/openapi/paths_admin_announcement.go`

| 接口 | 请求体 | 响应 | 状态码 |
|---|---|---|---|
| GET `/admin/announcements` | — | AnnouncementDTO[]（非分页，含未激活） | 200 |
| POST `/admin/announcements` | {title*,content*,type*(enum),is_active?(*bool),start_time?,end_time?} | {id:int32} | 201 |
| GET `/admin/announcements/{id}` | path:id(int32) | AnnouncementDTO | 200 |
| PATCH `/admin/announcements/{id}` | 同 create 请求体 | message | 200 |
| DELETE `/admin/announcements/{id}` | — | message | 200 |

- [ ] **Step 1: 写 paths 文件**（按 Task 5 的执行范式：registerSchema 注册各 DTO/请求体 schema + 按 table 注册每个 path 的 Operation）
- [ ] **Step 2: 在 openapi.go build() 放开对应 registerXxxPaths(t) 调用**
- [ ] **Step 3: 追加 TestXxxPaths 测试**（断言本模块关键 path 与 schema 存在，参考 TestPostPaths 写法）
- [ ] **Step 4: 运行 `go test ./internal/openapi/... -run TestXxx -v` 验证 PASS**
- [ ] **Step 5: 提交**

```bash
git commit -m "feat(openapi): 公告管理后台接口 5 个"
```

---

## Task 14: 音乐后台歌单管理（paths_admin_music.go）

**Files:**
- Create: `api/internal/openapi/paths_admin_music.go`

复用 Task 9 的 PlaylistDTO、Song schema。

| 接口 | 请求体 | 响应 | 状态码 |
|---|---|---|---|
| GET `/admin/music/playlists` | — | PlaylistDTO[]（非分页） | 200 |
| POST `/admin/music/playlists` | {url*} | PlaylistDTO | 201 |
| POST `/admin/music/playlists/custom` | {title*} | PlaylistDTO | 201 |
| GET `/admin/music/playlists/{id}` | path:id(UUID) | PlaylistDTO | 200 |
| PATCH `/admin/music/playlists/{id}` | {title?,is_active?(*bool)} | message | 200 |
| DELETE `/admin/music/playlists/{id}` | — | message | 200 |
| PATCH `/admin/music/playlists/{id}/active` | {active(bool)} | message | 200 |
| POST `/admin/music/playlists/{id}/refresh` | — | PlaylistDTO | 200 |
| POST `/admin/music/playlists/{id}/songs` | {name?,artist?,url?,cover?} | message | 200 |
| DELETE `/admin/music/playlists/{id}/songs/{index}` | path:id(UUID),index(int) | message | 200 |
| PATCH `/admin/music/playlists/{id}/songs/{index}` | {name,artist,cover,url} | message | 200 |
| PATCH `/admin/music/settings` | {player_version*} | message | 200 |

- [ ] **Step 1: 写 paths 文件**（按 Task 5 的执行范式：registerSchema 注册各 DTO/请求体 schema + 按 table 注册每个 path 的 Operation）
- [ ] **Step 2: 在 openapi.go build() 放开对应 registerXxxPaths(t) 调用**
- [ ] **Step 3: 追加 TestXxxPaths 测试**（断言本模块关键 path 与 schema 存在，参考 TestPostPaths 写法）
- [ ] **Step 4: 运行 `go test ./internal/openapi/... -run TestXxx -v` 验证 PASS**
- [ ] **Step 5: 提交**

```bash
git commit -m "feat(openapi): 音乐后台歌单管理接口 12 个"
```

---

## Task 15: 表情后台管理（paths_admin_emoji.go）

**Files:**
- Create: `api/internal/openapi/paths_admin_emoji.go`

复用 Task 3 的 EmojiGroupDTO、EmojiDTO。
**EmojiUploadResult**（service.go:256-261）：url、filename、size(int64)、mime_type

| 接口 | 请求体 | 响应 | 状态码 |
|---|---|---|---|
| GET `/admin/emojis/groups` | — | EmojiGroupDTO[]（含禁用） | 200 |
| POST `/admin/emojis/groups` | {name*,source?,sort_order?,is_enabled?(*bool)} | {id:int32} | 200 |
| PATCH `/admin/emojis/groups/batch-status` | {ids*(min1,int32[]),is_enabled(bool)} | {affected:int64} | 200 |
| PATCH `/admin/emojis/groups/{id}` | {name?,source?,sort_order?(*int),is_enabled?(*bool)} | message | 200 |
| DELETE `/admin/emojis/groups/{id}` | — | message | 200 |
| GET `/admin/emojis/groups/{id}/emojis` | — | EmojiDTO[] | 200 |
| POST `/admin/emojis/groups/{id}/emojis` | {name*,url?,text_content?,gif_url?,source_url?,sort_order?} | {id:int32} | 200 |
| POST `/admin/emojis/upload` | multipart:file(binary) | EmojiUploadResult | 200 |
| PATCH `/admin/emojis/emojis/{id}` | {name,url,text_content,gif_url,source_url,sort_order} | message | 200 |
| DELETE `/admin/emojis/emojis/{id}` | — | message | 200 |

id 为 int32。CreateEmojiGroup/CreateEmoji 用 RespondOK（200，非 201）。

- [ ] **Step 1: 写 paths 文件**（按 Task 5 的执行范式：registerSchema 注册各 DTO/请求体 schema + 按 table 注册每个 path 的 Operation）
- [ ] **Step 2: 在 openapi.go build() 放开对应 registerXxxPaths(t) 调用**
- [ ] **Step 3: 追加 TestXxxPaths 测试**（断言本模块关键 path 与 schema 存在，参考 TestPostPaths 写法）
- [ ] **Step 4: 运行 `go test ./internal/openapi/... -run TestXxx -v` 验证 PASS**
- [ ] **Step 5: 提交**

```bash
git commit -m "feat(openapi): 表情后台管理接口 10 个"
```

---

## Task 16: 文件管理后台（paths_admin_file.go）

**Files:**
- Create: `api/internal/openapi/paths_admin_file.go`

复用 FileDTO。

| 接口 | query/path | 响应 | 状态码 |
|---|---|---|---|
| GET `/admin/files` | query:purpose,page,limit | FileDTO[]+分页 | 200 |
| GET `/admin/files/instant` | query:hash*(必填) | {file:FileDTO/null, exists:bool} | 200 |
| DELETE `/admin/files/{id}` | path:id(UUID) | message | 200 |

- [ ] **Step 1: 写 paths 文件**（按 Task 5 的执行范式：registerSchema 注册各 DTO/请求体 schema + 按 table 注册每个 path 的 Operation）
- [ ] **Step 2: 在 openapi.go build() 放开对应 registerXxxPaths(t) 调用**
- [ ] **Step 3: 追加 TestXxxPaths 测试**（断言本模块关键 path 与 schema 存在，参考 TestPostPaths 写法）
- [ ] **Step 4: 运行 `go test ./internal/openapi/... -run TestXxx -v` 验证 PASS**
- [ ] **Step 5: 提交**

```bash
git commit -m "feat(openapi): 文件管理后台接口 3 个"
```

---

## Task 17: 注册端点 + 综合测试（main.go + openapi_test.go）

**Files:**
- Modify: `api/cmd/server/main.go`（在 v1 Route 回调最开头、CSRF Use 之前注册端点）
- Modify: `api/internal/openapi/openapi_test.go`（综合测试）

- [ ] **Step 1: 在 main.go 注册端点**

在 `r.Route("/api/v1", func(v1 chi.Router) {` 回调**第一行**（`v1.Use(middleware.CSRF(...))` 之前）插入：

```go
// OpenAPI 文档端点（无需 CSRF/鉴权，仅返回结构描述）
v1.Get("/openapi.json", openapi.Handler())

v1.Use(middleware.CSRF(cfg.Cookie, nil))
// ... 其余不变
```

在 main.go import 块加入：

```go
"blog-api/internal/openapi"
```

- [ ] **Step 2: 写综合测试（path 总数 ≥ 90）**

在 openapi_test.go 追加：

```go
func TestAllPathsCount(t *testing.T) {
	spec, _ := Spec()
	count := 0
	for _, item := range spec.Paths {
		if item.Get != nil {
			count++
		}
		if item.Post != nil {
			count++
		}
		if item.Put != nil {
			count++
		}
		if item.Patch != nil {
			count++
		}
		if item.Delete != nil {
			count++
		}
	}
	// 90+ 接口（health + v1 全部）
	require.GreaterOrEqual(t, count, 90, "expected at least 90 operations, got %d", count)
	t.Logf("registered %d operations across %d paths", count, len(spec.Paths))
}

func TestNoDuplicateConflictingPaths(t *testing.T) {
	spec, _ := Spec()
	// 验证关键路径都存在且无 nil
	for _, p := range []string{
		"/posts", "/posts/{slug}", "/auth/login", "/auth/me",
		"/admin/posts", "/admin/users", "/admin/roles",
		"/music/search", "/media/{id}", "/upload/init",
	} {
		require.NotNil(t, spec.Paths.Find(p), "missing critical path %s", p)
	}
}

func TestCSRFOnWriteOps(t *testing.T) {
	spec, _ := Spec()
	// POST /auth/login 是公开但需 CSRF（写操作）
	op := spec.Paths.Find("/auth/login").Post
	require.NotNil(t, op)
	hasCSRF := false
	for _, p := range op.Parameters {
		if p.Value.Name == "X-CSRF-Token" {
			hasCSRF = true
		}
	}
	require.True(t, hasCSRF, "POST /auth/login should require X-CSRF-Token")
}
```

- [ ] **Step 3: 运行全部 openapi 测试**

```bash
go test ./internal/openapi/... -v
```
Expected: 所有测试 PASS，TestAllPathsCount 打印 ≥ 90。

- [ ] **Step 4: 编译整个项目**

```bash
go build ./...
```
Expected: 无编译错误。

- [ ] **Step 5: 提交**

```bash
git add api/cmd/server/main.go api/internal/openapi/
git commit -m "feat(openapi): 注册 /api/v1/openapi.json 端点 + 综合测试"
```

---

## Task 18: 验证端点 + 导入 Apifox

**Files:**
- 产出：`api/openapi.json`（临时，用于导入，可不入库）

- [ ] **Step 1: 启动后端服务**

```bash
cd /Users/issuser/Developer/xfy/mimo-blog
make dev   # 或 cd api && go run ./cmd/server
```
后台运行，等待 "博客 API 服务启动" 日志。

- [ ] **Step 2: 拉取 openapi.json 并校验**

```bash
curl -s http://localhost:8080/api/v1/openapi.json -o /tmp/mimo-openapi.json
cat /tmp/mimo-openapi.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('openapi:', d['openapi']); print('paths:', len(d['paths'])); print('title:', d['info']['title'])"
```
Expected: openapi: 3.0.3，paths ≥ 60（path 数，operation 数 ≥ 90）。

确认端口（从 .env 读 PORT，默认见 config）。

- [ ] **Step 3: 导入到 Apifox Mimo Blog**

```bash
apifox import --project 8484856 --format openapi --file /tmp/mimo-openapi.json
```
Expected: 导入成功，返回 success: true。检查输出中导入的接口数量。

- [ ] **Step 4: 核对 Apifox 中接口列表**

```bash
apifox endpoint list --project 8484856 --page-size 100
```
Expected: 返回 ≥ 90 个接口，按 tag 分组。

- [ ] **Step 5: 抽样核对**

在 Apifox 中抽查（通过 endpoint get 看详情）：
- `POST /api/v1/auth/login`：请求体有 email/password，响应 data 有 access_token
- `GET /api/v1/admin/posts`：鉴权标注管理员，有分页 query
- `POST /api/v1/posts/{id}/view`：响应 204 无 body
- `POST /api/v1/music/embed`：query url 必填

- [ ] **Step 6: 记录导入结果，提交收尾**

```bash
# 可选：把生成命令固化到 Makefile 或脚本（下一步）
git add -A
git commit -m "chore(openapi): 验证端点并导入 Apifox Mimo Blog（90+ 接口）"
```

---

## Task 19: 配置 auto-import（可选，部署后启用）

**Files:**
- Create: `api/auto-import.json`（auto-import 配置模板）

- [ ] **Step 1: 编写 auto-import 配置文件**

```json
{
  "type": "openapi",
  "url": "http://<your-deployed-host>/api/v1/openapi.json",
  "syncMode": "update",
  "requestUpdateMode": "update",
  "parameterImportMode": "update",
  "targetFolderId": 0,
  "isOnlyUpdateDisabledApi": false
}
```

具体字段以 `apifox cli-schema get import-auto-import-create` 输出为准（先校验）。

- [ ] **Step 2: 校验配置 schema**

```bash
apifox cli-schema validate import-auto-import-create --file api/auto-import.json
```

- [ ] **Step 3: 创建 auto-import（待服务有公网地址后执行）**

```bash
apifox import auto-import create --project 8484856 --file api/auto-import.json
```
注：本地 localhost 服务 Apifox 云端拉不到，此步需部署后执行。首版以 Task 18 的本地文件导入为准。

- [ ] **Step 4: 提交配置模板**

```bash
git add api/auto-import.json
git commit -m "chore(openapi): 添加 auto-import 配置模板（部署后启用）"
```

---

## 完成标准

1. `go build ./...` 通过，`go test ./internal/openapi/...` 全绿，operation 数 ≥ 90。
2. `GET /api/v1/openapi.json` 返回合法 OpenAPI 3.0 JSON。
3. Apifox Mimo Blog 项目接口数 ≥ 90，抽样字段/鉴权/分页正确。
4. 未改动任何现有业务代码（openapi 包纯新增 + main.go 仅加 2 行端点注册）。
