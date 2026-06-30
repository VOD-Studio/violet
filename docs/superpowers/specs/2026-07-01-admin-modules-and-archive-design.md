# 后台模块接入 + 归档功能 设计文档

- 日期：2026-07-01
- 分支：release/2.0
- 范围：5 个独立工作项，逐个独立提交

## 背景与目标

后台前端已接入 8 个模块（概览/用户/角色/权限/标签/公告/素材/表情）。后端仍有 5 个 admin 接口未被前端使用；此外归档功能为全栈新增。

### 本轮交付清单

| # | 模块 | 类型 | 后端改动 | 前端改动 |
|---|------|------|----------|----------|
| 1 | 操作日志（audit） | 修复 + 接入 | 修序列化 + 补字段 | 新增 admin-audit-logs |
| 2 | 评论审核（comments） | 纯前端接入 | 无 | 新增 admin-comments |
| 3 | 站点设置（settings） | 纯前端接入 | 无 | 新增 admin-settings |
| 4 | 项目管理（projects） | 纯前端接入 | 无 | 新增 admin-projects + 接通公共项目页 |
| 5 | 归档（archive） | 全栈新增 | 新增 2 个公开接口 | 新增 archive feature + 公共页 |

**不在本轮**：音乐管理（数据结构最复杂，延后）、文章管理（用户明确暂不做）。

## 横切规范

### 字段注释规范（全模块强制）

- **后端 Go struct**：每个字段加 `// 说明` 行注释，类型用 `// TypeName 说明` 头注释（对齐现有 Go 注释 idiom）。
- **前端 TS interface/type**：每个字段加 `/** 说明 */` JSDoc，interface 带 `/** XxxDTO - 说明 */` 头（对齐 `web/src/features/admin-announcements/model/types.ts` 既有规范）。

### 前端模块结构（FSD，复用既有模式）

每个 admin feature 目录结构（以 audit-logs 为例）：
```
web/src/features/admin-<name>/
├── api/
│   ├── client.ts   // HTTP 调用，一个 endpoint 一个 async fn
│   ├── keys.ts     // queryKey 工厂（all/lists/list/detail，as const）
│   └── queries.ts  // useQuery/useMutation hooks（namespace import client，sonner toast）
└── model/
    └── types.ts    // DTO + Request 接口，snake_case，对齐后端 JSON tag
```
- 路由文件 `web/src/routes/admin.<name>.tsx`：`createFileRoute` + `PageShell` + `DataTable`（+ `ConfirmDialog`/表单）。
- 侧边栏单一来源：`web/src/features/admin-layout/ui/AdminNavConfig.ts` 追加一项。
- 请求层：`apiGet`（单对象）/`apiGetPaged`（分页，返回 `{data, pagination}`）/`apiPost`/`apiPut`/`apiPatch`/`apiDelete`，均来自 `@/shared/api/request`。

### 权限对齐原则

后端实际鉴权以 `cmd/server/main.go` 挂载的中间件为准（`AdminRequired` 或 `RequirePermission(code)`）。前端 `PermissionGuard` 只在**后端确实挂了对应 `RequirePermission`** 的动作上使用，避免前端比后端更严格造成不一致。

| 动作 | 后端实际鉴权 | 前端 PermissionGuard |
|------|--------------|----------------------|
| audit 查看 | AdminRequired | 不挂（管理员可见） |
| comments 审核/删除 | AdminRequired | 不挂 |
| settings 更新 | `RequirePermission("settings:update")` | 挂 `settings:update` |
| projects 增改删 | AdminRequired | 不挂 |

### 提交策略

- 每完成一个模块独立提交一次（5 次提交）。
- 用 `git add <具体文件>` 精确暂存，**只含本次改动**。
- **不动**当前 git status 中已存在的未暂存改动：`web/src/features/admin-permissions/ui/CreatePermissionDialog.tsx`、`web/src/shared/ui/modal/components/Modal.tsx`。
- 提交顺序：audit → comments → settings → projects → archive。

---

## 模块 1：操作日志（audit）

### 问题

后端 `/admin/logs` 返回 JSON 字段为 **PascalCase**（`ID`/`UserID`/`Action`/`Resource`/`ResourceID`/`Detail`/`IPAddress`/`CreatedAt`），与全站 snake_case 不一致；且 `user_name`/`resource_name` 在 PO 层已 JOIN 查出，却在 `auditPOsToDomain` 被丢弃，无法展示操作人/资源名。

根因：`domain/audit/entity.go` 的 `AuditLog` 无 json tag，handler 直接把领域实体 `[]AuditLog` 交给 `RespondPaged` 序列化。

### 后端改动（修 bug）

**`api/internal/domain/audit/entity.go`**
- `AuditLog` 加字段 `UserName string`、`ResourceName string`。
- 所有字段加 snake_case json tag。新增字段也加注释。
- 注意 `UserAgent` 字段：PO（`AuditLog` in audit_store.go）**没有 user_agent 列**，该字段实际不持久化。本轮**保留 entity 字段但 API 不返回其值**（PO 未映射，无需改）。避免引入未持久化列的歧义。

目标 struct：
```go
// AuditLog 操作日志实体
type AuditLog struct {
    ID           int64           `json:"id"`            // 日志主键
    UserID       *string         `json:"user_id"`       // 操作人 ID（可空：匿名操作）
    UserName     string          `json:"user_name"`     // 操作人用户名（JOIN users 查出，可空）
    Action       string          `json:"action"`        // 操作类型：create/update/delete/login 等
    Resource     string          `json:"resource"`      // 资源类型：user/post/comment 等
    ResourceID   string          `json:"resource_id"`   // 资源 ID
    ResourceName string          `json:"resource_name"` // 资源名称（如用户名/文章标题，可空）
    Detail       map[string]any  `json:"detail"`        // 变更详情
    IPAddress    string          `json:"ip_address"`    // 来源 IP
    CreatedAt    time.Time       `json:"created_at"`    // 发生时间（RFC3339）
}
```
> `UserAgent` 从实体移除（PO 无对应列，保留会造成"实体有但永不赋值"的误导）。这是清理而非破坏——当前 handler 返回的 JSON 本就没有 user_agent 值（字段无 tag 时为 `UserAgent`，PO 未映射则为零值空串）。

**`api/internal/infrastructure/persistence/gorm/audit_store.go`**
- `auditPOsToDomain` 补回 `UserName`、`ResourceName` 赋值。

### 前端新增

**`web/src/features/admin-audit-logs/`**
- `model/types.ts`：
  ```ts
  /** AuditLogDTO - 操作日志数据传输对象（对齐后端 domain/audit.AuditLog） */
  export interface AuditLogDTO {
      /** 日志主键 */
      id: number;
      /** 操作人 ID（匿名操作时为 null） */
      user_id: string | null;
      /** 操作人用户名（JOIN users 查出，可能为空字符串） */
      user_name: string;
      /** 操作类型：create/update/delete/login 等 */
      action: string;
      /** 资源类型：user/post/comment 等 */
      resource: string;
      /** 资源 ID */
      resource_id: string;
      /** 资源名称（用户名/文章标题等，可能为空字符串） */
      resource_name: string;
      /** 变更详情（任意结构） */
      detail: Record<string, unknown> | null;
      /** 来源 IP */
      ip_address: string;
      /** 发生时间（RFC3339 字符串） */
      created_at: string;
  }
  ```
- `api/client.ts`：`listAuditLogs(query)` → `apiGetPaged<AuditLogDTO>("/admin/logs", {params})`；`listAuditLogsByUser(id, query)`。
- `api/keys.ts`：`auditLogKeys = { all, lists, list(query), detail }`。
- `api/queries.ts`：`useAdminAuditLogs(query)`、`useAdminAuditLogsByUser(id, query)`。

**`web/src/routes/admin.logs.tsx`**
- `PageShell` + `DataTable`（服务端分页）。
- 列：时间(created_at) / 用户(user_name，空则 user_id) / 动作(action) / 资源(resource + resource_name) / IP(ip_address)。
- 每行可展开/点击打开 dialog，展示 `detail`（JSON 美化）。
- 无 PermissionGuard（对齐后端 AdminRequired）。

**侧边栏**：`AdminNavConfig.ts` 追加 `{ label: "操作日志", to: "/admin/logs", icon: ScrollText }`。

---

## 模块 2：评论审核（comments）

后端无改动。纯前端接入 `/admin/comments/*` + 公共侧审核动作。

### 后端契约（已存在，对齐用）

- `GET /admin/comments/pending?page,limit` → `RespondPaged` of `CommentDTO[]`
- `GET /admin/comments/pending/count` → `{ data: { count: number } }`
- `GET /admin/comments?page,limit,status` → `RespondPaged` of `AdminCommentDTO[]`（status ∈ pending/approved/spam/deleted）
- `GET /admin/comments/{id}` → `{ data: AdminCommentDTO }`
- `PATCH /admin/comments/batch-status` → body `{ ids: string[], status }` → `{ data: { affected: number } }`
- 公共审核动作：`PATCH /comments/{id}/approve`、`PATCH /comments/{id}/spam`、`DELETE /comments/{id}`

### 前端新增

**`web/src/features/admin-comments/`**
- `model/types.ts`：`CommentStatus`（联合类型）、`Picture`、`CommentDTO`、`AdminCommentDTO`、`BatchUpdateCommentsRequest`。字段注释齐全，snake_case 对齐后端：
  - `CommentDTO`: id, post_id, parent_id?, depth, author_name, avatar_url, body, pictures[], status, created_at。
  - `AdminCommentDTO`: 同上 + post_title, post_slug。
  - `Picture`: url, width, height, size。
- `api/client.ts`：listPending/listAll(paged)/countPending/getDetail/batchUpdateStatus/approve/markSpam/delete。
- `api/keys.ts`：`commentKeys` 工厂（含 `pending`、`list(status)`、`detail(id)`、`pendingCount`）。
- `api/queries.ts`：`usePendingComments`、`useAllComments(status)`、`usePendingCommentCount`、`useApproveComment`、`useMarkSpamComment`、`useDeleteComment`、`useBatchUpdateComments`。mutation onSuccess invalidate 相关 list key + pendingCount。

**`web/src/routes/admin.comments.tsx`**
- `PageShell` + 状态切换 tabs（待审核/全部/已通过/垃圾/已删除）+ `DataTable`（服务端分页）。
- 列：评论内容(body，省略号) / 作者(author_name + avatar) / 文章(post_title，链接到 `/blog/$post_slug`) / 状态(status badge) / 时间。
- 操作：通过/标垃圾/删除（单条 + 选中批量）。无 PermissionGuard（对齐后端 AdminRequired）。
- 顶部可选展示待审核数量徽标（来自 `usePendingCommentCount`）。

**侧边栏**：追加 `{ label: "评论审核", to: "/admin/comments", icon: MessageSquare }`。

---

## 模块 3：站点设置（settings）

后端无改动。纯前端接入 `/admin/settings`。

### 后端契约

- `GET /admin/settings`（AdminRequired）→ `{ data: SiteSettings }`
- `PUT /admin/settings`（`RequirePermission("settings:update")`）→ body 为全指针字段（nil=不改）→ `{ data: SiteSettings }`

`SiteSettings` 字段（snake_case）：site_name, site_description, site_url, admin_email, posts_per_page(int), comments_enabled(bool), comments_moderation(bool), github_username, github_token, tech_stack(string), bio, footer_text。

### 前端新增

**`web/src/features/admin-settings/`**
- `model/types.ts`：`SiteSettingsDTO`（12 字段，注释齐全）、`UpdateSettingsRequest`（字段对应，提交时仅含变更项或全部提交均可——PUT 接受全字段，未变字段原样回传无害）。
- `api/client.ts`：`getSettings()` → `apiGet`；`updateSettings(body)` → `apiPut`。
- `api/keys.ts`：`settingsKeys = { all, detail }`。
- `api/queries.ts`：`useAdminSettings`、`useUpdateSettings`（onSuccess invalidate detail + toast）。

**`web/src/routes/admin.settings.tsx`**
- `PageShell` + react-hook-form + zod 表单。
- 控件：site_name/site_url/admin_email（input）、site_description/bio/tech_stack/footer_text（textarea）、posts_per_page（number input）、comments_enabled/comments_moderation（switch）、github_username/github_token（input，token 用 password 类型遮蔽）。
- 提交按钮包 `PermissionGuard permission="settings:update"`（对齐后端 RequirePermission）。
- 加载态：表单 skeleton；保存中按钮 loading。

**侧边栏**：追加 `{ label: "站点设置", to: "/admin/settings", icon: Settings }`。

---

## 模块 4：项目管理（projects）

后端无改动。纯前端接入 `/admin/projects`，并顺手接通公共项目页 mock 数据。

### 附带修复

`web/src/routes/projects/index.tsx` 当前用 `mockProjects` 硬编码渲染，feature 层（types/queries/mutations）已就绪但未接。本轮接通：用 `useProjects()` 替换 mock，加 SSR loader 预取 `fetchProjects({})`。

### 后端契约

- 公共 `GET /projects`（非分页）→ `{ data: ProjectDTO[] }`
- 公共 `GET /projects/{id}` → `{ data: ProjectDTO }`
- `POST /admin/projects` / `PUT /admin/projects/{id}` / `DELETE /admin/projects/{id}` → 均返回 `{ data: null, meta: { message } }`（用 `apiPost<null>` 等）

`ProjectDTO`：id, title, description, url, github_url, image_url, tech_stack(string[]), sort_order(int), created_at。
请求体（Create/Update 同形）：title(必填), description, url, github_url, image_url, tech_stack([]), sort_order(int)。

### 前端新增

**`web/src/features/admin-projects/`**
- `model/types.ts`：复用 `features/projects/model/types.ts` 的 `Project`/`CreateProject`（避免重复定义）；本目录仅 re-export 或定义 admin 专用片段（如 `ProjectFormValues`）。字段注释对齐。
- `api/client.ts`：admin 侧 create/update/delete（list/get 复用公共 `features/projects/api/queries.ts` 的 `fetchProjects`/`fetchProject`，因管理列表数据与公共列表相同）。
- `api/keys.ts`：复用 `features/projects/api/keys.ts` 的 `projectKeys`。
- `api/queries.ts`：list 复用公共 `useProjects`；mutation 复用公共 `features/projects/api/mutations.ts`（`useCreateProject`/`useUpdateProject`/`useDeleteProject`，已存在且正确）。本目录若无新增逻辑可省略，直接由 route 引用公共层。

> 决策：admin-projects 尽量复用 `features/projects` 已有的 api 层，不重复造。route 文件直接 import 公共 queries/mutations。这样保持单一数据源。

**`web/src/routes/admin.projects.tsx`**
- `PageShell` + `DataTable`（或卡片列表按 sort_order 排序）。
- 列：封面(image_url 缩略) / 标题(title) / 描述(description 省略) / 技术栈(tech_stack 标签) / 链接(url + github_url 图标) / 排序(sort_order)。
- 操作：创建/编辑（dialog 表单）/ 删除（ConfirmDialog）。无 PermissionGuard（对齐后端 AdminRequired）。

**侧边栏**：追加 `{ label: "项目管理", to: "/admin/projects", icon: FolderKanban }`。

---

## 模块 5：归档（archive）— 全栈

### 设计决策

- **服务端按年分页**（用户预期文章规模可能上千）。两段式接口：年份索引（极小）+ 按年懒加载。
- **不在后端按月分组**：后端只返回某年全部已发布文章的扁平倒序列表；月份分组纯属展示，由前端完成。
- **精简字段**：每篇不含 `content_html`/`content_md`（避免单篇几十 KB 撑大响应），保留 slug/title/excerpt/cover_image/tags/published_at。
- **时间锚点**：`published_at`（`*time.Time`，已发布文章必有值；查询加 `published_at IS NOT NULL` 保险）。

### 后端改动

**`api/internal/domain/post/repository.go`** — `PostRepository` 接口加两方法：
```go
// FindArchiveYears 返回所有含已发布文章的年份（倒序，去重）
FindArchiveYears(ctx context.Context) ([]int, error)
// FindPublishedByYear 返回指定年份的全部已发布文章（按 published_at 倒序）
FindPublishedByYear(ctx context.Context, year int) ([]*Post, error)
```

**`api/internal/infrastructure/persistence/gorm/post_repo.go`** — 实现两方法：
- `FindArchiveYears`：`SELECT DISTINCT EXTRACT(YEAR FROM published_at) AS y FROM posts WHERE status='published' AND published_at IS NOT NULL ORDER BY y DESC`。转 `[]int`。
- `FindPublishedByYear`：`WHERE status='published' AND published_at IS NOT NULL AND EXTRACT(YEAR FROM published_at)=? ORDER BY published_at DESC`，`.Preload("Tags")`（归档项需 tag 名称）。

**`api/internal/application/post/service.go`** — 新增 DTO + 方法（字段全注释）：
```go
// ArchiveItemDTO 归档文章项（精简字段，不含正文）
type ArchiveItemDTO struct {
    ID          string   `json:"id"`           // 文章 ID
    Slug        string   `json:"slug"`         // URL slug（用于详情跳转）
    Title       string   `json:"title"`        // 标题
    Excerpt     string   `json:"excerpt"`      // 摘要
    CoverImage  string   `json:"cover_image"`  // 封面图 URL
    Tags        []string `json:"tags"`         // 标签名列表
    PublishedAt string   `json:"published_at"` // 发布时间（RFC3339）
}

// ArchiveYearDTO 某年的归档数据
type ArchiveYearDTO struct {
    Year  int              `json:"year"`  // 年份
    Count int              `json:"count"` // 该年文章数
    Items []ArchiveItemDTO `json:"items"` // 该年全部文章（倒序，前端按月分组）
}

// ListArchiveYears 返回归档年份索引
func (s *Service) ListArchiveYears(ctx) ([]int, error)
// GetArchiveByYear 返回指定年份的归档数据
func (s *Service) GetArchiveByYear(ctx, year int) (ArchiveYearDTO, error)
```
- `year` 合法性校验：合理区间（如 > 1900 且 ≤ 当前年+1），越界返回 `shared.BadRequest`。

**`api/internal/interfaces/http/handler/post/post.go`** — 两 handler：
- `ArchiveYears(w, r)` → `s.svc.ListArchiveYears(ctx)` → `response.RespondOK(w, map[string]any{"years": years})`
- `ArchiveByYear(w, r)` → 从 URL param `{year}` 取年份 → `GetArchiveByYear` → `RespondOK(w, dto)`

**`api/cmd/server/main.go`** — 在 `v1.Route("/posts", ...)` 内（公共，无鉴权）注册：
```go
r.Get("/archive", postH.ArchiveYears)        // 归档年份索引
r.Get("/archive/{year}", postH.ArchiveByYear) // 指定年份归档
```

**`api/internal/openapi/paths_post.go`** — 补两个 path + `ArchiveItemDTO`/`ArchiveYearDTO` schema 定义。

### 前端新增

**`web/src/features/archive/`**
- `model/types.ts`：
  ```ts
  /** ArchiveYearIndex - 归档年份索引 */
  export interface ArchiveYearIndex {
      /** 含已发布文章的年份列表（倒序） */
      years: number[];
  }
  /** ArchiveItem - 归档文章项（精简字段） */
  export interface ArchiveItem {
      /** 文章 ID */
      id: string;
      /** URL slug（跳转详情） */
      slug: string;
      /** 标题 */
      title: string;
      /** 摘要 */
      excerpt: string;
      /** 封面图 URL */
      cover_image: string;
      /** 标签名列表 */
      tags: string[];
      /** 发布时间（RFC3339 字符串） */
      published_at: string;
  }
  /** ArchiveYear - 某年的归档数据 */
  export interface ArchiveYear {
      /** 年份 */
      year: number;
      /** 该年文章数 */
      count: number;
      /** 该年全部文章（倒序，前端按月分组） */
      items: ArchiveItem[];
  }
  ```
- `api/client.ts`：`fetchArchiveYears()` → `apiGet<ArchiveYearIndex>("/posts/archive")`；`fetchArchiveYear(year)` → `apiGet<ArchiveYear>(`/posts/archive/${year}`)`。
- `api/keys.ts`：`archiveKeys = { all, years(), year(year) }`。
- `api/queries.ts`：`useArchiveYears()`、`useArchiveYear(year, enabled)`。

**`web/src/routes/blog/archive.tsx`**（URL `/blog/archive`，公共页）
- SSR loader 预取 `fetchArchiveYears()`（年份索引极小，可脱水合）。
- 布局：
  - 顶部年份导航条（倒序），点击平滑滚动到对应年份区块。
  - 每个年份区块：`<h2>{year} · {count} 篇</h2>`，按月分组渲染（前端用 `new Date(published_at)` 提取月份，倒序）。
  - **懒加载**：每个年份区块进入视口（IntersectionObserver）或点击展开时才 `useArchiveYear(year)` 拉取该年文章。最近一个年份默认展开并自动拉取。
  - 文章项：发布日期(月-日) + 标题（`<Link to="/blog/$slug">`）+ 标签。
  - 每个年份区块独立 loading skeleton / error 重试。
- 样式遵循全站极简留白（Tailwind v4）。

**`web/src/shared/config/nav.ts`** — `NAV_ITEMS` 在"博客"后追加 `{ type: "route", label: "归档", to: "/blog/archive" }`。

---

## 测试与验证

### 后端
- `cd api && go build ./...`（编译）
- `cd api && go vet ./...`
- `cd api && go test ./...`（重点 post/audit domain+application 层）
- 手动：`curl /api/v1/posts/archive`、`curl /api/v1/posts/archive/2026`、`curl /admin/logs`（确认 snake_case + user_name/resource_name）

### 前端
- `cd web && npx tsc --noEmit`
- `cd web && npx biome check .`（仅检查新增/改动文件）
- 手动：各 admin 页 CRUD、归档页懒加载与跳转

## 风险与边界

- **归档懒加载的 SSR**：只有年份索引在 SSR 预取，各年文章是客户端懒加载（首屏快，但非完全 SSR）。可接受——归档页非首屏关键路径，且按年分页本身为控制响应体积。
- **admin projects 复用公共 api 层**：route 文件跨 feature 引用 `features/projects/*`，符合既有 alias 约定（`@features/*`），不算越层。
- **audit 移除 UserAgent 实体字段**：该字段 PO 无列、永不赋值，移除是清理。若上游有引用会编译报错并据此处理（当前仅 entity 定义，无消费者）。
