# 后台模块接入 + 归档功能 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 接入后端已有但前端未用的 4 个后台模块（操作日志、评论审核、站点设置、项目管理），并全栈新增归档功能。

**Architecture:** 后端遵循 DDD 四层（domain → application → infrastructure → interfaces）；前端遵循 FSD（feature-sliced），每模块 `model/api/ui` 三层 + 一个 route 文件 + 侧边栏配置。每个模块独立提交。audit 顺手修序列化 bug；projects 顺手接通公共页 mock 数据；archive 为唯一全栈新增。

**Tech Stack:** Go（chi v5 + GORM + google/wire）、React（TanStack Router + Query + react-hook-form + zod）、Tailwind v4、Biome、shadcn 组件。

**Spec:** `docs/superpowers/specs/2026-07-01-admin-modules-and-archive-design.md`

---

## 全局约定（每个任务都遵守）

1. **字段注释强制**：
   - 后端 Go struct：每个字段 `// 说明` 行注释，类型 `// TypeName 说明` 头注释。
   - 前端 TS：每个字段 `/** 说明 */`，interface 带 `/** Xxx - 说明 */` 头。
2. **提交纪律**：每个模块用 `git add <具体路径>` 精确暂存，**绝不** `git add -A`/`git add .`。不触碰 `web/src/features/admin-permissions/ui/CreatePermissionDialog.tsx` 与 `web/src/shared/ui/modal/components/Modal.tsx`（他人未提交改动）。
3. **前端路径别名**：`@features/*`、`@shared/*`、`@/*` 均可用。
4. **请求层**：`apiGet`/`apiGetPaged`/`apiPost`/`apiPut`/`apiPatch`/`apiDelete` 来自 `@shared/api/request`。`apiGetPaged<T>` 返回 `{data: T[], pagination}`；其余返回解包后的 `T`。
5. **权限对齐**：`PermissionGuard` 仅在后端确实挂了 `RequirePermission(code)` 的动作上使用。audit/comments/projects 的 admin 路由后端仅 `AdminRequired`，故前端**不挂** PermissionGuard。
6. **侧边栏单一来源**：`web/src/features/admin-layout/ui/AdminNavConfig.ts`。

---

## 文件结构总览

### 后端改动
| 文件 | 动作 | 职责 |
|------|------|------|
| `api/internal/domain/audit/entity.go` | 改 | AuditLog 加 snake_case tag + UserName/ResourceName 字段，移除未持久化的 UserAgent |
| `api/internal/infrastructure/persistence/gorm/audit_store.go` | 改 | auditPOsToDomain 补回 UserName/ResourceName |
| `api/internal/domain/post/repository.go` | 改 | PostRepository 加 FindArchiveYears/FindPublishedByYear |
| `api/internal/infrastructure/persistence/gorm/post_repo.go` | 改 | 实现上述两方法 |
| `api/internal/application/post/service.go` | 改 | 加 ArchiveItemDTO/ArchiveYearDTO + ListArchiveYears/GetArchiveByYear |
| `api/internal/interfaces/http/handler/post/post.go` | 改 | 加 ArchiveYears/ArchiveByYear handler |
| `api/cmd/server/main.go` | 改 | 注册 /posts/archive 两条路由 |
| `api/internal/openapi/paths_post.go` | 改 | 补归档 path + schema |

### 前端新增
| 文件 | 动作 | 职责 |
|------|------|------|
| `web/src/features/admin-audit-logs/{model,api,ui}/*` | 新 | 操作日志模块 |
| `web/src/routes/admin.logs.tsx` | 新 | 操作日志页 |
| `web/src/features/admin-comments/{model,api,ui}/*` | 新 | 评论审核模块 |
| `web/src/routes/admin.comments.tsx` | 新 | 评论审核页 |
| `web/src/features/admin-settings/{model,api}/*` | 新 | 站点设置模块 |
| `web/src/routes/admin.settings.tsx` | 新 | 站点设置页 |
| `web/src/routes/admin.projects.tsx` | 新 | 项目管理页（复用 `features/projects/*`） |
| `web/src/routes/projects/index.tsx` | 改 | 公共项目页接通真实 API |
| `web/src/features/archive/{model,api}/*` | 新 | 归档模块 |
| `web/src/routes/blog/archive.tsx` | 新 | 归档公共页 |
| `web/src/shared/config/nav.ts` | 改 | 加"归档"导航项 |
| `web/src/features/admin-layout/ui/AdminNavConfig.ts` | 改 | 加 4 个后台导航项 |

---

# 模块 1：操作日志（audit）

> 后端修复序列化 + 前端接入。独立提交。

## Task 1.1: 修复 audit 后端序列化（domain 层）

**Files:**
- Modify: `api/internal/domain/audit/entity.go`

- [ ] **Step 1: 改写 AuditLog 实体**

将 `api/internal/domain/audit/entity.go` 的 `AuditLog` struct 整体替换为（含 snake_case tag + UserName/ResourceName，移除未持久化的 UserAgent）：

```go
// AuditLog 操作日志实体
type AuditLog struct {
	ID           int64          `json:"id"`            // 日志主键
	UserID       *string        `json:"user_id"`       // 操作人 ID（可空：匿名操作）
	UserName     string         `json:"user_name"`     // 操作人用户名（JOIN users 查出，可空）
	Action       string         `json:"action"`        // 操作类型：create/update/delete/login 等
	Resource     string         `json:"resource"`      // 资源类型：user/post/comment 等
	ResourceID   string         `json:"resource_id"`   // 资源 ID
	ResourceName string         `json:"resource_name"` // 资源名称（如用户名/文章标题，可空）
	Detail       map[string]any `json:"detail"`        // 变更详情
	IPAddress    string         `json:"ip_address"`    // 来源 IP
	CreatedAt    time.Time      `json:"created_at"`    // 发生时间（RFC3339）
}
```

> 移除 `UserAgent string` 字段：PO（`audit_store.go` 的 `AuditLog` PO）无 `user_agent` 列，该字段永不赋值，移除避免误导。

- [ ] **Step 2: 编译验证**

Run: `cd api && go build ./...`
Expected: 若有处引用 `AuditLog.UserAgent` 会编译报错——当前无消费者，应直接通过。

- [ ] **Step 3: Commit**

```bash
git add api/internal/domain/audit/entity.go
git commit -m "fix(audit): 修复操作日志序列化（snake_case tag + 补 user_name/resource_name）

AuditLog 实体无 json tag 导致 API 返回 PascalCase，与全站不一致；
且 PO 层已 JOIN 查出的 user_name/resource_name 被丢弃。本轮补齐 tag 与字段，
移除 PO 无对应列、永不赋值的 UserAgent。"
```

## Task 1.2: 补回 audit PO → domain 转换

**Files:**
- Modify: `api/internal/infrastructure/persistence/gorm/audit_store.go`

- [ ] **Step 1: 在 auditPOsToDomain 补字段赋值**

将 `auditPOsToDomain` 函数内的 struct 字面量补充 `UserName`、`ResourceName`：

```go
func auditPOsToDomain(pos []AuditLog) []domainaudit.AuditLog {
	logs := make([]domainaudit.AuditLog, 0, len(pos))
	for _, po := range pos {
		l := domainaudit.AuditLog{
			ID:           po.ID,
			Action:       po.Action,
			Resource:     po.ResourceType,
			ResourceID:   po.ResourceID,
			ResourceName: po.ResourceName, // 补回：资源名称（如用户名/文章标题）
			UserName:     po.UserName,     // 补回：操作人用户名（JOIN users）
			IPAddress:    po.IPAddress,
			CreatedAt:    po.CreatedAt,
		}
		if po.UserID != nil {
			uid := *po.UserID
			l.UserID = &uid
		}
		if po.Detail != "" {
			var d map[string]any
			if json.Unmarshal([]byte(po.Detail), &d) == nil {
				l.Detail = d
			}
		}
		logs = append(logs, l)
	}
	return logs
}
```

- [ ] **Step 2: 编译 + vet**

Run: `cd api && go build ./... && go vet ./...`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add api/internal/infrastructure/persistence/gorm/audit_store.go
git commit -m "fix(audit): auditPOsToDomain 补回 user_name/resource_name 赋值"
```

- [ ] **Step 4: 手动验证（可选，需服务运行）**

Run: `curl -s http://localhost:8080/api/v1/admin/logs -H "Cookie: <admin-access-cookie>" | head -c 400`
Expected: JSON 字段为 snake_case（`id`/`user_id`/`user_name`/`action`/`resource`/`resource_id`/`resource_name`/`detail`/`ip_address`/`created_at`）。

## Task 1.3: 前端 admin-audit-logs feature 层

**Files:**
- Create: `web/src/features/admin-audit-logs/model/types.ts`
- Create: `web/src/features/admin-audit-logs/api/keys.ts`
- Create: `web/src/features/admin-audit-logs/api/client.ts`
- Create: `web/src/features/admin-audit-logs/api/queries.ts`

- [ ] **Step 1: 创建 model/types.ts**

`web/src/features/admin-audit-logs/model/types.ts`:

```ts
/**
 * admin-audit-logs 模块类型定义
 *
 * 对齐后端 domain/audit.AuditLog（GET /admin/logs 返回）。
 */

/** AuditLogDTO - 操作日志数据传输对象 */
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
    /** 变更详情（任意结构，可能为 null） */
    detail: Record<string, unknown> | null;
    /** 来源 IP */
    ip_address: string;
    /** 发生时间（RFC3339 字符串） */
    created_at: string;
}

/** AuditLogListQuery - 操作日志列表查询参数 */
export interface AuditLogListQuery {
    /** 页码（从 1 开始） */
    page?: number;
    /** 每页条数 */
    limit?: number;
}
```

- [ ] **Step 2: 创建 api/keys.ts**

`web/src/features/admin-audit-logs/api/keys.ts`:

```ts
/** auditLogKeys - 操作日志 query key 工厂 */
export const auditLogKeys = {
    /** 模块根 */
    all: ["audit-logs"] as const,
    /** 列表维度 */
    lists: () => [...auditLogKeys.all, "list"] as const,
    /** 具体列表查询（按查询参数区分） */
    list: (query: { page?: number; limit?: number }) =>
        [...auditLogKeys.lists(), query] as const,
    /** 指定用户列表维度 */
    userLists: () => [...auditLogKeys.all, "user-list"] as const,
    /** 指定用户列表查询 */
    userList: (userId: string, query: { page?: number; limit?: number }) =>
        [...auditLogKeys.userLists(), userId, query] as const,
};
```

- [ ] **Step 3: 创建 api/client.ts**

`web/src/features/admin-audit-logs/api/client.ts`:

```ts
import { apiGetPaged } from "@shared/api/request";
import type { AuditLogDTO, AuditLogListQuery } from "../model/types";

const BASE = "/admin/logs";

/**
 * listAuditLogs - 调后端 GET /admin/logs 拉取操作日志列表（分页）
 */
export const listAuditLogs = async (
    query: AuditLogListQuery = {},
): Promise<{ data: AuditLogDTO[]; pagination: unknown }> =>
    apiGetPaged<AuditLogDTO>(BASE, { params: query });

/**
 * listAuditLogsByUser - 调后端 GET /admin/logs/user/{id} 拉取指定用户日志
 */
export const listAuditLogsByUser = async (
    userId: string,
    query: AuditLogListQuery = {},
): Promise<{ data: AuditLogDTO[]; pagination: unknown }> =>
    apiGetPaged<AuditLogDTO>(`${BASE}/user/${userId}`, { params: query });
```

- [ ] **Step 4: 创建 api/queries.ts**

`web/src/features/admin-audit-logs/api/queries.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import type { AuditLogListQuery } from "../model/types";
import * as api from "./client";
import { auditLogKeys } from "./keys";

/** useAdminAuditLogs - 操作日志列表 hook（服务端分页） */
export const useAdminAuditLogs = (query: AuditLogListQuery = {}) =>
    useQuery({
        queryKey: auditLogKeys.list(query),
        queryFn: () => api.listAuditLogs(query),
    });

/** useAdminAuditLogsByUser - 指定用户操作日志列表 hook */
export const useAdminAuditLogsByUser = (
    userId: string,
    query: AuditLogListQuery = {},
) =>
    useQuery({
        queryKey: auditLogKeys.userList(userId, query),
        queryFn: () => api.listAuditLogsByUser(userId, query),
        enabled: userId.length > 0,
    });
```

- [ ] **Step 5: 类型检查**

Run: `cd web && npx tsc --noEmit`
Expected: PASS（无类型错误）

- [ ] **Step 6: Commit**

```bash
git add web/src/features/admin-audit-logs/
git commit -m "feat(admin-audit-logs): 新增操作日志 feature 层（types/api/queries）"
```

## Task 1.4: 操作日志页面 + 侧边栏

**Files:**
- Create: `web/src/routes/admin.logs.tsx`
- Modify: `web/src/features/admin-layout/ui/AdminNavConfig.ts`

- [ ] **Step 1: 参考既有 admin 页结构**

Read: `web/src/routes/admin.announcements.tsx`（了解 PageShell + DataTable 用法与列定义模式）
Read: `web/src/features/admin-shared/ui/data-table/` 的导出（`DataTableColumn` 类型与 props）

- [ ] **Step 2: 创建路由页 admin.logs.tsx**

`web/src/routes/admin.logs.tsx`（只读分页列表，点击行展开 detail dialog）：

```tsx
import { PageShell } from "@features/admin-layout/ui/PageShell";
import {
    DataTable,
    type DataTableColumn,
} from "@features/admin-shared/ui/data-table";
import { useAdminAuditLogs } from "@features/admin-audit-logs/api/queries";
import type { AuditLogDTO } from "@features/admin-audit-logs/model/types";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@shared/ui/modal";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useState } from "react";

const PAGE_SIZE = 20;

function AdminLogsPage() {
    const [page, setPage] = useState(1);
    const { data, isLoading, error, refetch } = useAdminAuditLogs({
        page,
        limit: PAGE_SIZE,
    });
    const [detailLog, setDetailLog] = useState<AuditLogDTO | null>(null);

    const columns: DataTableColumn<AuditLogDTO>[] = [
        {
            key: "created_at",
            header: "时间",
            sortable: true,
            cell: (row) => format(new Date(row.created_at), "MM-dd HH:mm", { locale: zhCN }),
        },
        {
            key: "user_name",
            header: "操作人",
            cell: (row) => row.user_name || row.user_id || "匿名",
        },
        {
            key: "action",
            header: "动作",
            cell: (row) => <Badge variant="secondary">{row.action}</Badge>,
        },
        {
            key: "resource",
            header: "资源",
            cell: (row) => `${row.resource}${row.resource_name ? ` · ${row.resource_name}` : ""}`,
        },
        { key: "ip_address", header: "IP", cell: (row) => row.ip_address || "-" },
        {
            key: "_detail",
            header: "",
            sticky: "right",
            cell: (row) => (
                <Button variant="ghost" size="sm" onClick={() => setDetailLog(row)} disabled={!row.detail}>
                    详情
                </Button>
            ),
        },
    ];

    return (
        <PageShell title="操作日志" description="用户操作审计记录">
            <DataTable<AuditLogDTO>
                data={data?.data ?? []}
                columns={columns}
                keyExtractor={(row) => String(row.id)}
                page={page}
                pageSize={PAGE_SIZE}
                total={data?.pagination?.total ?? 0}
                onPageChange={setPage}
                selectable={false}
                loading={isLoading}
                error={error ? new Error(error.message) : null}
                onRetry={() => refetch()}
                storageKey="admin-audit-logs-columns"
                caption="操作日志列表"
                emptyTitle="暂无操作日志"
                emptyDescription="还没有任何用户操作记录"
            />
            <Dialog open={!!detailLog} onOpenChange={(open) => !open && setDetailLog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>操作详情</DialogTitle>
                    </DialogHeader>
                    <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-xs">
                        {JSON.stringify(detailLog?.detail ?? {}, null, 2)}
                    </pre>
                </DialogContent>
            </Dialog>
        </PageShell>
    );
}

export const Route = createFileRoute("/admin/logs")({
    component: AdminLogsPage,
});
```

> 注意：`data?.pagination?.total` 的确切字段路径需与 `apiGetPaged` 返回的 `pagination` 形状一致（`{ total }`）。若类型报错，参考 `web/src/routes/admin.users.tsx` 中对 `pagination` 的取值方式对齐。

- [ ] **Step 3: 侧边栏加导航项**

修改 `web/src/features/admin-layout/ui/AdminNavConfig.ts`：
- import 新增 `ScrollText`（来自 `lucide-react`）
- `ADMIN_NAV_ITEMS` 数组末尾追加：
```ts
    { label: "操作日志", to: "/admin/logs", icon: ScrollText },
```

- [ ] **Step 4: 路由树生成 + 类型检查 + lint**

Run: `cd web && npx tsc --noEmit`
Expected: PASS（TanStack Router 的 `routeTree.gen.ts` 由 dev server / 插件自动重生成；若类型缺失，运行 `pnpm dev` 触发生成后重试）

Run: `cd web && npx biome check src/routes/admin.logs.tsx src/features/admin-audit-logs/ src/features/admin-layout/ui/AdminNavConfig.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/routes/admin.logs.tsx web/src/features/admin-layout/ui/AdminNavConfig.ts
git commit -m "feat(admin): 接入操作日志页（分页列表 + 详情弹窗）"
```

---

# 模块 2：评论审核（comments）

> 纯前端。独立提交。

## Task 2.1: admin-comments feature 层

**Files:**
- Create: `web/src/features/admin-comments/model/types.ts`
- Create: `web/src/features/admin-comments/api/keys.ts`
- Create: `web/src/features/admin-comments/api/client.ts`
- Create: `web/src/features/admin-comments/api/queries.ts`

- [ ] **Step 1: 参考后端契约**

Read: `api/internal/application/comment/service.go`（CommentDTO/AdminCommentDTO 字段）
确认字段：CommentDTO(id, post_id, parent_id?, depth, author_name, avatar_url, body, pictures[], status, created_at)；AdminCommentDTO 上面 + post_title, post_slug。Picture(url, width, height, size)。status ∈ pending/approved/spam/deleted。

- [ ] **Step 2: 创建 model/types.ts**

`web/src/features/admin-comments/model/types.ts`:

```ts
/**
 * admin-comments 模块类型定义
 *
 * 对齐后端 application/comment.CommentDTO / AdminCommentDTO。
 */

/** CommentStatus - 评论状态枚举 */
export type CommentStatus = "pending" | "approved" | "spam" | "deleted";

/** Picture - 评论配图 */
export interface Picture {
    /** 图片 URL */
    url: string;
    /** 宽度（px） */
    width: number;
    /** 高度（px） */
    height: number;
    /** 文件大小（字节） */
    size: number;
}

/** CommentDTO - 评论数据传输对象（待审核列表用） */
export interface CommentDTO {
    /** 评论 ID */
    id: string;
    /** 所属文章 ID */
    post_id: string;
    /** 父评论 ID（顶层评论为空） */
    parent_id?: string;
    /** 嵌套深度 */
    depth: number;
    /** 评论人昵称 */
    author_name: string;
    /** 评论人头像 URL */
    avatar_url: string;
    /** 评论正文 */
    body: string;
    /** 配图列表 */
    pictures: Picture[];
    /** 状态 */
    status: CommentStatus;
    /** 创建时间（RFC3339 字符串） */
    created_at: string;
}

/** AdminCommentDTO - 后台评论数据传输对象（含文章信息） */
export interface AdminCommentDTO extends CommentDTO {
    /** 所属文章标题 */
    post_title: string;
    /** 所属文章 slug */
    post_slug: string;
}

/** CommentListQuery - 评论列表查询参数 */
export interface CommentListQuery {
    /** 页码（从 1 开始） */
    page?: number;
    /** 每页条数 */
    limit?: number;
    /** 状态筛选 */
    status?: CommentStatus;
}

/** BatchUpdateCommentsRequest - 批量更新评论状态请求体 */
export interface BatchUpdateCommentsRequest {
    /** 评论 ID 列表（1-100 条） */
    ids: string[];
    /** 目标状态 */
    status: CommentStatus;
}
```

- [ ] **Step 3: 创建 api/keys.ts**

`web/src/features/admin-comments/api/keys.ts`:

```ts
import type { CommentStatus } from "../model/types";

/** commentKeys - 评论 query key 工厂 */
export const commentKeys = {
    /** 模块根 */
    all: ["comments"] as const,
    /** 全部列表维度（按状态） */
    lists: () => [...commentKeys.all, "list"] as const,
    /** 具体列表查询（按状态 + 分页） */
    list: (query: { status?: CommentStatus; page?: number; limit?: number }) =>
        [...commentKeys.lists(), query] as const,
    /** 待审核列表维度 */
    pending: () => [...commentKeys.all, "pending"] as const,
    /** 待审核列表查询（按分页） */
    pendingList: (query: { page?: number; limit?: number }) =>
        [...commentKeys.pending(), query] as const,
    /** 待审核数量 */
    pendingCount: () => [...commentKeys.all, "pending-count"] as const,
    /** 详情维度 */
    details: () => [...commentKeys.all, "detail"] as const,
    /** 具体详情 */
    detail: (id: string) => [...commentKeys.details(), id] as const,
};
```

- [ ] **Step 4: 创建 api/client.ts**

`web/src/features/admin-comments/api/client.ts`:

```ts
import { apiDelete, apiGet, apiGetPaged, apiPatch, apiPost } from "@shared/api/request";
import type {
    AdminCommentDTO,
    BatchUpdateCommentsRequest,
    CommentDTO,
    CommentListQuery,
} from "../model/types";

const BASE = "/admin/comments";

/** listPendingComments - 调 GET /admin/comments/pending（待审核列表，分页） */
export const listPendingComments = async (
    query: { page?: number; limit?: number } = {},
): Promise<{ data: CommentDTO[]; pagination: unknown }> =>
    apiGetPaged<CommentDTO>(`${BASE}/pending`, { params: query });

/** countPendingComments - 调 GET /admin/comments/pending/count */
export const countPendingComments = async (): Promise<{ count: number }> =>
    apiGet<{ count: number }>(`${BASE}/pending/count`);

/** listAllComments - 调 GET /admin/comments（全部列表，按状态筛选，分页） */
export const listAllComments = async (
    query: CommentListQuery = {},
): Promise<{ data: AdminCommentDTO[]; pagination: unknown }> =>
    apiGetPaged<AdminCommentDTO>(BASE, { params: query });

/** getCommentDetail - 调 GET /admin/comments/{id} */
export const getCommentDetail = async (id: string): Promise<AdminCommentDTO> =>
    apiGet<AdminCommentDTO>(`${BASE}/${id}`);

/** batchUpdateComments - 调 PATCH /admin/comments/batch-status */
export const batchUpdateComments = async (
    body: BatchUpdateCommentsRequest,
): Promise<{ affected: number }> =>
    apiPatch<{ affected: number }>(`${BASE}/batch-status`, body);

/** approveComment - 调 PATCH /comments/{id}/approve（公共审核动作） */
export const approveComment = async (id: string): Promise<void> =>
    apiPatch<void>(`/comments/${id}/approve`);

/** markCommentSpam - 调 PATCH /comments/{id}/spam（公共审核动作） */
export const markCommentSpam = async (id: string): Promise<void> =>
    apiPatch<void>(`/comments/${id}/spam`);

/** deleteComment - 调 DELETE /comments/{id}（公共审核动作） */
export const deleteComment = async (id: string): Promise<void> =>
    apiDelete<void>(`/comments/${id}`);
```

- [ ] **Step 5: 创建 api/queries.ts**

`web/src/features/admin-comments/api/queries.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
    BatchUpdateCommentsRequest,
    CommentListQuery,
} from "../model/types";
import * as api from "./client";
import { commentKeys } from "./keys";

/** useAllComments - 全部评论列表 hook（按状态筛选，服务端分页） */
export const useAllComments = (query: CommentListQuery = {}) =>
    useQuery({
        queryKey: commentKeys.list(query),
        queryFn: () => api.listAllComments(query),
    });

/** usePendingCommentCount - 待审核评论数量 hook（徽标用） */
export const usePendingCommentCount = () =>
    useQuery({
        queryKey: commentKeys.pendingCount(),
        queryFn: () => api.countPendingComments(),
    });

/** invalidateAllLists - 评论变更后失效全部列表 + 待审核计数 */
const useInvalidateComments = () => {
    const qc = useQueryClient();
    return () => {
        qc.invalidateQueries({ queryKey: commentKeys.lists() });
        qc.invalidateQueries({ queryKey: commentKeys.pending() });
        qc.invalidateQueries({ queryKey: commentKeys.pendingCount() });
    };
};

/** useApproveComment - 审核通过单条评论 */
export const useApproveComment = () => {
    const invalidate = useInvalidateComments();
    return useMutation({
        mutationFn: (id: string) => api.approveComment(id),
        onSuccess: () => {
            invalidate();
            toast.success("评论已通过");
        },
        onError: (e: Error) => toast.error(`审核失败：${e.message}`),
    });
};

/** useMarkCommentSpam - 标记单条评论为垃圾 */
export const useMarkCommentSpam = () => {
    const invalidate = useInvalidateComments();
    return useMutation({
        mutationFn: (id: string) => api.markCommentSpam(id),
        onSuccess: () => {
            invalidate();
            toast.success("已标记为垃圾");
        },
        onError: (e: Error) => toast.error(`操作失败：${e.message}`),
    });
};

/** useDeleteComment - 删除单条评论 */
export const useDeleteComment = () => {
    const invalidate = useInvalidateComments();
    return useMutation({
        mutationFn: (id: string) => api.deleteComment(id),
        onSuccess: () => {
            invalidate();
            toast.success("评论已删除");
        },
        onError: (e: Error) => toast.error(`删除失败：${e.message}`),
    });
};

/** useBatchUpdateComments - 批量更新评论状态 */
export const useBatchUpdateComments = () => {
    const invalidate = useInvalidateComments();
    return useMutation({
        mutationFn: (body: BatchUpdateCommentsRequest) => api.batchUpdateComments(body),
        onSuccess: (res) => {
            invalidate();
            toast.success(`已更新 ${res.affected} 条评论`);
        },
        onError: (e: Error) => toast.error(`批量操作失败：${e.message}`),
    });
};
```

- [ ] **Step 6: 类型检查**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add web/src/features/admin-comments/
git commit -m "feat(admin-comments): 新增评论审核 feature 层（types/api/queries）"
```

## Task 2.2: 评论审核页面 + 侧边栏

**Files:**
- Create: `web/src/routes/admin.comments.tsx`
- Modify: `web/src/features/admin-layout/ui/AdminNavConfig.ts`

- [ ] **Step 1: 创建路由页 admin.comments.tsx**

`web/src/routes/admin.comments.tsx`（状态 tabs + DataTable 分页 + 单条/批量操作）：

```tsx
import { PageShell } from "@features/admin-layout/ui/PageShell";
import { ConfirmDialog } from "@features/admin-shared/ui/confirm-dialog";
import {
    DataTable,
    type DataTableColumn,
} from "@features/admin-shared/ui/data-table";
import {
    useAllComments,
    useApproveComment,
    useBatchUpdateComments,
    useDeleteComment,
    useMarkCommentSpam,
} from "@features/admin-comments/api/queries";
import type { AdminCommentDTO, CommentStatus } from "@features/admin-comments/model/types";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/ui/avatar";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { Link, createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Trash2 } from "lucide-react";
import { useState } from "react";

const PAGE_SIZE = 20;

const STATUS_TABS: { label: string; value: CommentStatus | undefined }[] = [
    { label: "待审核", value: "pending" },
    { label: "已通过", value: "approved" },
    { label: "垃圾", value: "spam" },
    { label: "已删除", value: "deleted" },
];

const STATUS_BADGE: Record<CommentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "待审核", variant: "secondary" },
    approved: { label: "已通过", variant: "default" },
    spam: { label: "垃圾", variant: "destructive" },
    deleted: { label: "已删除", variant: "outline" },
};

function AdminCommentsPage() {
    const [status, setStatus] = useState<CommentStatus | undefined>("pending");
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<string[]>([]);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const { data, isLoading, error, refetch } = useAllComments({ status, page, limit: PAGE_SIZE });
    const approveMut = useApproveComment();
    const spamMut = useMarkCommentSpam();
    const deleteMut = useDeleteComment();
    const batchMut = useBatchUpdateComments();

    const switchTab = (s: CommentStatus | undefined) => {
        setStatus(s);
        setPage(1);
        setSelected([]);
    };

    const columns: DataTableColumn<AdminCommentDTO>[] = [
        {
            key: "body",
            header: "评论内容",
            ellipsis: true,
            cell: (row) => <span className="line-clamp-2">{row.body}</span>,
        },
        {
            key: "author_name",
            header: "作者",
            cell: (row) => (
                <div className="flex items-center gap-2">
                    <Avatar className="size-6">
                        <AvatarImage src={row.avatar_url} />
                        <AvatarFallback className="text-xs">
                            {row.author_name?.[0] ?? "?"}
                        </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{row.author_name}</span>
                </div>
            ),
        },
        {
            key: "post_title",
            header: "文章",
            ellipsis: true,
            cell: (row) => (
                <Link to="/blog/$slug" params={{ slug: row.post_slug }} className="text-sm text-primary hover:underline">
                    {row.post_title}
                </Link>
            ),
        },
        {
            key: "status",
            header: "状态",
            cell: (row) => <Badge variant={STATUS_BADGE[row.status].variant}>{STATUS_BADGE[row.status].label}</Badge>,
        },
        {
            key: "created_at",
            header: "时间",
            cell: (row) => format(new Date(row.created_at), "MM-dd HH:mm", { locale: zhCN }),
        },
        {
            key: "_actions",
            header: "操作",
            sticky: "right",
            cell: (row) => (
                <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => approveMut.mutate(row.id)} disabled={approveMut.isPending}>
                        通过
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => spamMut.mutate(row.id)} disabled={spamMut.isPending}>
                        垃圾
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeletingId(row.id)} disabled={deleteMut.isPending}>
                        <Trash2 className="size-4" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <PageShell title="评论审核" description="审核与管理文章评论">
            <div className="mb-4 flex items-center gap-2">
                {STATUS_TABS.map((tab) => (
                    <Button
                        key={tab.label}
                        size="sm"
                        variant={status === tab.value ? "default" : "outline"}
                        onClick={() => switchTab(tab.value)}
                    >
                        {tab.label}
                    </Button>
                ))}
            </div>

            {selected.length > 0 && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border bg-muted/50 p-2 text-sm">
                    <span>已选 {selected.length} 条</span>
                    <Button size="sm" variant="outline" onClick={() => batchMut.mutate({ ids: selected, status: "approved" })} disabled={batchMut.isPending}>
                        批量通过
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => batchMut.mutate({ ids: selected, status: "spam" })} disabled={batchMut.isPending}>
                        批量标垃圾
                    </Button>
                </div>
            )}

            <DataTable<AdminCommentDTO>
                data={data?.data ?? []}
                columns={columns}
                keyExtractor={(row) => row.id}
                page={page}
                pageSize={PAGE_SIZE}
                total={data?.pagination?.total ?? 0}
                onPageChange={setPage}
                selectable
                selectedIds={selected}
                onSelectionChange={setSelected}
                loading={isLoading}
                error={error ? new Error(error.message) : null}
                onRetry={() => refetch()}
                storageKey="admin-comments-columns"
                caption="评论列表"
                emptyTitle="暂无评论"
                emptyDescription="当前状态下没有评论"
            />

            <ConfirmDialog
                open={!!deletingId}
                onOpenChange={(open) => !open && setDeletingId(null)}
                onConfirm={() => {
                    if (deletingId) deleteMut.mutate(deletingId);
                    setDeletingId(null);
                }}
                title="确认删除评论"
                description="确定要删除这条评论吗？此操作不可恢复。"
                confirmLabel="删除"
                loading={deleteMut.isPending}
            />
        </PageShell>
    );
}

export const Route = createFileRoute("/admin/comments")({
    component: AdminCommentsPage,
});
```

> 注意：`DataTable` 的 `selectable`/`selectedIds`/`onSelectionChange` 与 `Avatar`/`Badge` 的 import 路径需与既有 admin 页（如 admin.users.tsx）对齐。若 `DataTable` 无选择能力，去掉选择相关 props 与批量条，单条操作仍可用——以实际组件能力为准。

- [ ] **Step 2: 侧边栏加导航项**

修改 `web/src/features/admin-layout/ui/AdminNavConfig.ts`：
- import 新增 `MessageSquare`
- `ADMIN_NAV_ITEMS` 追加：
```ts
    { label: "评论审核", to: "/admin/comments", icon: MessageSquare },
```

- [ ] **Step 3: 类型检查 + lint**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

Run: `cd web && npx biome check src/routes/admin.comments.tsx src/features/admin-comments/ src/features/admin-layout/ui/AdminNavConfig.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add web/src/routes/admin.comments.tsx web/src/features/admin-layout/ui/AdminNavConfig.ts
git commit -m "feat(admin): 接入评论审核页（状态筛选 + 批量审核）"
```

---

# 模块 3：站点设置（settings）

> 纯前端。独立提交。

## Task 3.1: admin-settings feature 层

**Files:**
- Create: `web/src/features/admin-settings/model/types.ts`
- Create: `web/src/features/admin-settings/api/keys.ts`
- Create: `web/src/features/admin-settings/api/client.ts`
- Create: `web/src/features/admin-settings/api/queries.ts`

- [ ] **Step 1: 创建 model/types.ts**

`web/src/features/admin-settings/model/types.ts`（对齐后端 `domain/settings.SiteSettings` 12 字段）：

```ts
/**
 * admin-settings 模块类型定义
 *
 * 对齐后端 domain/settings.SiteSettings（GET /admin/settings 返回）。
 */

/** SiteSettingsDTO - 站点配置读模型 */
export interface SiteSettingsDTO {
    /** 站点名称 */
    site_name: string;
    /** 站点描述 */
    site_description: string;
    /** 站点 URL */
    site_url: string;
    /** 管理员邮箱 */
    admin_email: string;
    /** 每页文章数 */
    posts_per_page: number;
    /** 是否启用评论 */
    comments_enabled: boolean;
    /** 评论是否需审核 */
    comments_moderation: boolean;
    /** GitHub 用户名 */
    github_username: string;
    /** GitHub Token */
    github_token: string;
    /** 技术栈（单字符串） */
    tech_stack: string;
    /** 个人简介 */
    bio: string;
    /** 页脚文案 */
    footer_text: string;
}

/** UpdateSettingsRequest - 更新站点配置请求体（全字段） */
export interface UpdateSettingsRequest {
    /** 站点名称 */
    site_name: string;
    /** 站点描述 */
    site_description: string;
    /** 站点 URL */
    site_url: string;
    /** 管理员邮箱 */
    admin_email: string;
    /** 每页文章数 */
    posts_per_page: number;
    /** 是否启用评论 */
    comments_enabled: boolean;
    /** 评论是否需审核 */
    comments_moderation: boolean;
    /** GitHub 用户名 */
    github_username: string;
    /** GitHub Token */
    github_token: string;
    /** 技术栈 */
    tech_stack: string;
    /** 个人简介 */
    bio: string;
    /** 页脚文案 */
    footer_text: string;
}
```

- [ ] **Step 2: 创建 api/keys.ts**

`web/src/features/admin-settings/api/keys.ts`:

```ts
/** settingsKeys - 站点设置 query key 工厂 */
export const settingsKeys = {
    /** 模块根 */
    all: ["settings"] as const,
    /** 站点配置详情 */
    detail: () => [...settingsKeys.all, "detail"] as const,
};
```

- [ ] **Step 3: 创建 api/client.ts**

`web/src/features/admin-settings/api/client.ts`:

```ts
import { apiGet, apiPut } from "@shared/api/request";
import type { SiteSettingsDTO, UpdateSettingsRequest } from "../model/types";

const BASE = "/admin/settings";

/** getSettings - 调 GET /admin/settings 获取站点配置 */
export const getSettings = async (): Promise<SiteSettingsDTO> =>
    apiGet<SiteSettingsDTO>(BASE);

/** updateSettings - 调 PUT /admin/settings 更新站点配置，返回更新后的全量配置 */
export const updateSettings = async (
    body: UpdateSettingsRequest,
): Promise<SiteSettingsDTO> => apiPut<SiteSettingsDTO>(BASE, body);
```

- [ ] **Step 4: 创建 api/queries.ts**

`web/src/features/admin-settings/api/queries.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { UpdateSettingsRequest } from "../model/types";
import * as api from "./client";
import { settingsKeys } from "./keys";

/** useAdminSettings - 站点配置 hook */
export const useAdminSettings = () =>
    useQuery({
        queryKey: settingsKeys.detail(),
        queryFn: () => api.getSettings(),
    });

/** useUpdateSettings - 更新站点配置 hook */
export const useUpdateSettings = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: UpdateSettingsRequest) => api.updateSettings(body),
        onSuccess: (data) => {
            qc.setQueryData(settingsKeys.detail(), data);
            toast.success("站点设置已保存");
        },
        onError: (e: Error) => toast.error(`保存失败：${e.message}`),
    });
};
```

- [ ] **Step 5: 类型检查**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/src/features/admin-settings/
git commit -m "feat(admin-settings): 新增站点设置 feature 层（types/api/queries）"
```

## Task 3.2: 站点设置页面 + 侧边栏

**Files:**
- Create: `web/src/routes/admin.settings.tsx`
- Modify: `web/src/features/admin-layout/ui/AdminNavConfig.ts`

- [ ] **Step 1: 参考既有表单用法**

Read: 项目内任意 react-hook-form + zod 表单实现（如 admin-roles 的权限编辑、auth 的登录表单）确认 `useForm`、zodResolver、shadcn 表单组件（`Input`/`Textarea`/`Switch`/`NumberInput` 或 `Input type=number`）的 import 路径与用法。

- [ ] **Step 2: 创建路由页 admin.settings.tsx**

`web/src/routes/admin.settings.tsx`（表单，提交按钮挂 `PermissionGuard permission="settings:update"`）：

```tsx
import { PageShell } from "@features/admin-layout/ui/PageShell";
import {
    useAdminSettings,
    useUpdateSettings,
} from "@features/admin-settings/api/queries";
import type { UpdateSettingsRequest } from "@features/admin-settings/model/types";
import { PermissionGuard } from "@features/auth/ui/PermissionGuard";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Switch } from "@shared/ui/switch";
import { Textarea } from "@shared/ui/textarea";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

function AdminSettingsPage() {
    const { data, isLoading } = useAdminSettings();
    const updateMut = useUpdateSettings();

    const { register, handleSubmit, reset, watch, setValue } =
        useForm<UpdateSettingsRequest>();

    // 配置加载完成后回填表单
    useEffect(() => {
        if (data) {
            reset({
                site_name: data.site_name,
                site_description: data.site_description,
                site_url: data.site_url,
                admin_email: data.admin_email,
                posts_per_page: data.posts_per_page,
                comments_enabled: data.comments_enabled,
                comments_moderation: data.comments_moderation,
                github_username: data.github_username,
                github_token: data.github_token,
                tech_stack: data.tech_stack,
                bio: data.bio,
                footer_text: data.footer_text,
            });
        }
    }, [data, reset]);

    const onSubmit = (values: UpdateSettingsRequest) =>
        updateMut.mutate(values);

    if (isLoading) {
        return (
            <PageShell title="站点设置" description="管理站点全局配置">
                <div className="text-muted-foreground">加载中…</div>
            </PageShell>
        );
    }

    return (
        <PageShell title="站点设置" description="管理站点全局配置">
            <form
                onSubmit={handleSubmit(onSubmit)}
                className="max-w-2xl space-y-6"
            >
                <section className="space-y-4">
                    <h3 className="text-sm font-semibold">基础信息</h3>
                    <Field label="站点名称">
                        <Input {...register("site_name")} />
                    </Field>
                    <Field label="站点描述">
                        <Textarea rows={2} {...register("site_description")} />
                    </Field>
                    <Field label="站点 URL">
                        <Input {...register("site_url")} />
                    </Field>
                    <Field label="管理员邮箱">
                        <Input type="email" {...register("admin_email")} />
                    </Field>
                    <Field label="每页文章数">
                        <Input
                            type="number"
                            {...register("posts_per_page", { valueAsNumber: true })}
                        />
                    </Field>
                </section>

                <section className="space-y-4">
                    <h3 className="text-sm font-semibold">评论</h3>
                    <SwitchField
                        label="启用评论"
                        checked={watch("comments_enabled") ?? false}
                        onCheckedChange={(v) => setValue("comments_enabled", v)}
                    />
                    <SwitchField
                        label="评论需审核"
                        checked={watch("comments_moderation") ?? false}
                        onCheckedChange={(v) => setValue("comments_moderation", v)}
                    />
                </section>

                <section className="space-y-4">
                    <h3 className="text-sm font-semibold">GitHub 集成</h3>
                    <Field label="GitHub 用户名">
                        <Input {...register("github_username")} />
                    </Field>
                    <Field label="GitHub Token">
                        <Input type="password" {...register("github_token")} />
                    </Field>
                </section>

                <section className="space-y-4">
                    <h3 className="text-sm font-semibold">关于</h3>
                    <Field label="技术栈">
                        <Textarea rows={2} {...register("tech_stack")} />
                    </Field>
                    <Field label="个人简介">
                        <Textarea rows={4} {...register("bio")} />
                    </Field>
                    <Field label="页脚文案">
                        <Input {...register("footer_text")} />
                    </Field>
                </section>

                <PermissionGuard permission="settings:update">
                    <Button type="submit" disabled={updateMut.isPending}>
                        {updateMut.isPending ? "保存中…" : "保存设置"}
                    </Button>
                </PermissionGuard>
            </form>
        </PageShell>
    );
}

/** Field - 标签 + 控件包装 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="text-sm font-medium">{label}</label>
            {children}
        </div>
    );
}

/** SwitchField - 开关字段 */
function SwitchField({
    label,
    checked,
    onCheckedChange,
}: {
    label: string;
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{label}</span>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </div>
    );
}

export const Route = createFileRoute("/admin/settings")({
    component: AdminSettingsPage,
});
```

> 注意：`Switch`/`Textarea` 的 import 路径以 `@shared/ui/` 实际导出为准；若不存在，参考 admin-roles/announcements 用法对齐。`Switch` 的 `checked`/`onCheckedChange` API 以组件实际签名为准。

- [ ] **Step 3: 侧边栏加导航项**

修改 `web/src/features/admin-layout/ui/AdminNavConfig.ts`：
- import 新增 `Settings`
- `ADMIN_NAV_ITEMS` 追加：
```ts
    { label: "站点设置", to: "/admin/settings", icon: Settings },
```

- [ ] **Step 4: 类型检查 + lint**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

Run: `cd web && npx biome check src/routes/admin.settings.tsx src/features/admin-settings/ src/features/admin-layout/ui/AdminNavConfig.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/routes/admin.settings.tsx web/src/features/admin-layout/ui/AdminNavConfig.ts
git commit -m "feat(admin): 接入站点设置页（表单 + settings:update 权限门控）"
```

---

# 模块 4：项目管理（projects）

> 纯前端。复用 `features/projects/*` 已有 api 层（queries + mutations 均已就绪）。独立提交。

## Task 4.1: 项目管理页

**Files:**
- Create: `web/src/routes/admin.projects.tsx`

- [ ] **Step 1: 确认复用的 api**

确认（只读，不改）：`web/src/features/projects/api/queries.ts` 导出 `useProjects`、`fetchProjects`；`web/src/features/projects/api/mutations.ts` 导出 `useCreateProject`/`useUpdateProject(id)`/`useDeleteProject(id)`；`web/src/features/projects/model/types.ts` 导出 `Project`/`CreateProject`/`UpdateProject`。这些均已存在且正确，admin route 直接 import。

- [ ] **Step 2: 创建 admin 项目管理页**

`web/src/routes/admin.projects.tsx`（DataTable + 创建/编辑 dialog + 删除确认）：

```tsx
import { PageShell } from "@features/admin-layout/ui/PageShell";
import { ConfirmDialog } from "@features/admin-shared/ui/confirm-dialog";
import {
    DataTable,
    type DataTableColumn,
} from "@features/admin-shared/ui/data-table";
import {
    useCreateProject,
    useDeleteProject,
    useUpdateProject,
} from "@features/projects/api/mutations";
import { useProjects } from "@features/projects/api/queries";
import type { CreateProject, Project, UpdateProject } from "@features/projects/model/types";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@shared/ui/modal";
import { Input } from "@shared/ui/input";
import { Textarea } from "@shared/ui/textarea";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Github, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

const EMPTY: CreateProject = {
    title: "",
    description: "",
    url: "",
    github_url: "",
    image_url: "",
    tech_stack: [],
    sort_order: 0,
};

function AdminProjectsPage() {
    const { data: projects = [], isLoading, error, refetch } = useProjects();
    const createMut = useCreateProject();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<{ id: string } | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const { register, handleSubmit, reset } = useForm<CreateProject>();

    const openCreate = () => {
        setEditing(null);
        reset(EMPTY);
        setDialogOpen(true);
    };

    const openEdit = (p: Project) => {
        setEditing({ id: p.id });
        reset({
            title: p.title,
            description: p.description,
            url: p.url,
            github_url: p.github_url,
            image_url: p.image_url,
            tech_stack: p.tech_stack,
            sort_order: p.sort_order,
        });
        setDialogOpen(true);
    };

    const onSubmit = (values: CreateProject) => {
        if (editing) {
            updateMut(editing.id, values);
        } else {
            createMut.mutate(values, { onSuccess: () => setDialogOpen(false) });
        }
    };

    const columns: DataTableColumn<Project>[] = [
        {
            key: "title",
            header: "标题",
            cell: (row) => <span className="font-medium">{row.title}</span>,
        },
        {
            key: "description",
            header: "描述",
            ellipsis: true,
            cell: (row) => <span className="line-clamp-1 text-sm text-muted-foreground">{row.description}</span>,
        },
        {
            key: "tech_stack",
            header: "技术栈",
            cell: (row) =>
                row.tech_stack?.map((t) => <Badge key={t} variant="secondary" className="mr-1">{t}</Badge>),
        },
        {
            key: "sort_order",
            header: "排序",
            cell: (row) => row.sort_order,
        },
        {
            key: "url",
            header: "链接",
            cell: (row) => (
                <div className="flex items-center gap-2">
                    {row.url && (
                        <a href={row.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                            <ExternalLink className="size-4" />
                        </a>
                    )}
                    {row.github_url && (
                        <a href={row.github_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                            <Github className="size-4" />
                        </a>
                    )}
                </div>
            ),
        },
        {
            key: "_actions",
            header: "操作",
            sticky: "right",
            cell: (row) => (
                <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                        <Pencil className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteId(row.id)}>
                        <Trash2 className="size-4" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <PageShell
            title="项目管理"
            description="管理展示在「项目」页的项目"
            action={
                <Button onClick={openCreate}>
                    <Plus className="size-4" /> 创建项目
                </Button>
            }
        >
            <DataTable<Project>
                data={projects}
                columns={columns}
                keyExtractor={(row) => row.id}
                page={1}
                pageSize={projects.length}
                total={projects.length}
                onPageChange={() => {}}
                selectable={false}
                loading={isLoading}
                error={error ? new Error(error.message) : null}
                onRetry={() => refetch()}
                storageKey="admin-projects-columns"
                caption="项目列表"
                emptyTitle="暂无项目"
                emptyDescription="还没有创建任何项目"
            />

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? "编辑项目" : "创建项目"}</DialogTitle>
                    </DialogHeader>
                    <form id="project-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">标题 *</label>
                            <Input {...register("title", { required: true })} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">描述</label>
                            <Textarea rows={3} {...register("description")} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">演示 URL</label>
                                <Input {...register("url")} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">GitHub URL</label>
                                <Input {...register("github_url")} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">封面图 URL</label>
                            <Input {...register("image_url")} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">技术栈（逗号分隔）</label>
                                <Input
                                    {...register("tech_stack", {
                                        setValueAs: (v: string) =>
                                            v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [],
                                    })}
                                    defaultValue=""
                                    placeholder="React, Go, PostgreSQL"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">排序</label>
                                <Input type="number" {...register("sort_order", { valueAsNumber: true })} />
                            </div>
                        </div>
                    </form>
                    <DialogFooter>
                        <Button type="submit" form="project-form" disabled={createMut.isPending}>
                            {editing ? "保存" : "创建"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={!!deleteId}
                onOpenChange={(open) => !open && setDeleteId(null)}
                onConfirm={() => {
                    if (deleteId) deleteMut(deleteId);
                    setDeleteId(null);
                }}
                title="确认删除项目"
                description="确定要删除这个项目吗？"
                confirmLabel="删除"
                loading={deleteMut.isPending}
            />
        </PageShell>
    );
}

export const Route = createFileRoute("/admin/projects")({
    component: AdminProjectsPage,
});
```

> 注意：`useUpdateProject(id)` 与 `useDeleteProject(id)` 接收 id 参数返回 hook。在编辑场景下 id 动态，需用条件 hook 或拆分子组件。上方 `updateMut`/`deleteMut` 的写法应改为：把编辑表单拆成 `<ProjectDialog editing={editing} .../>` 子组件（在 dialog 内部根据 `editing?.id` 调用 `useUpdateProject(editing?.id ?? "")`），避免在条件分支调 hook。`deleteMut` 同理拆出。**实现时必须遵守 Rules of Hooks。**

- [ ] **Step 3: 类型检查 + lint**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

Run: `cd web && npx biome check src/routes/admin.projects.tsx`
Expected: PASS

- [ ] **Step 4: 侧边栏加导航项**

修改 `web/src/features/admin-layout/ui/AdminNavConfig.ts`：
- import 新增 `FolderKanban`
- `ADMIN_NAV_ITEMS` 追加：
```ts
    { label: "项目管理", to: "/admin/projects", icon: FolderKanban },
```

- [ ] **Step 5: Commit**

```bash
git add web/src/routes/admin.projects.tsx web/src/features/admin-layout/ui/AdminNavConfig.ts
git commit -m "feat(admin): 接入项目管理页（复用 projects feature 层 CRUD）"
```

## Task 4.2: 接通公共项目页 mock 数据

**Files:**
- Modify: `web/src/routes/projects/index.tsx`

- [ ] **Step 1: 读取当前 mock 实现**

Read: `web/src/routes/projects/index.tsx`（确认 `mockProjects` 与 `TiltedCard` 用法、当前 import）

- [ ] **Step 2: 替换 mock 为真实 API + SSR loader**

将 mock 数据替换为 `useProjects()`，并加 loader 预取（与 `blog/index.tsx` 同模式）：
- 移除 `mockProjects` 硬编码
- 在组件内用 `const { data: projects = [], isLoading, error } = useProjects();`
- 加 `loader`：
```tsx
loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
        queryKey: projectKeys.list({}),
        queryFn: () => fetchProjects({}),
    });
},
```
- import：`import { fetchProjects, useProjects } from "@features/projects/api/queries";` 与 `import { projectKeys } from "@features/projects/api/keys";`
- 保留原 `TiltedCard` 等展示组件，仅把数据源从 mock 换为 `projects`，加 loading/error 空态

- [ ] **Step 3: 类型检查 + lint**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

Run: `cd web && npx biome check src/routes/projects/index.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add web/src/routes/projects/index.tsx
git commit -m "feat(projects): 公共项目页接通真实 API（替换 mock 数据 + SSR 预取）"
```

---

# 模块 5：归档（archive）— 全栈

> 后端新增公开接口 + 前端公共页。独立提交。这是最大模块，放最后。

## Task 5.1: 后端 domain 层 — PostRepository 接口扩展

**Files:**
- Modify: `api/internal/domain/post/repository.go`

- [ ] **Step 1: 在 PostRepository 接口加两方法**

在 `api/internal/domain/post/repository.go` 的 `PostRepository` interface 末尾（`Delete` 之后）追加：

```go
	// FindArchiveYears 返回所有含已发布文章的年份（倒序、去重）
	FindArchiveYears(ctx context.Context) ([]int, error)
	// FindPublishedByYear 返回指定年份的全部已发布文章（按 published_at 倒序）
	FindPublishedByYear(ctx context.Context, year int) ([]*Post, error)
```

- [ ] **Step 2: 编译验证（预期失败）**

Run: `cd api && go build ./...`
Expected: FAIL —— `post_repo.go` 的 `*postRepository` 未实现新接口方法。这是预期的（下一步实现）。

- [ ] **Step 3: Commit（接口先行）**

```bash
git add api/internal/domain/post/repository.go
git commit -m "feat(post): PostRepository 端口新增归档查询方法

FindArchiveYears（年份索引）与 FindPublishedByYear（按年取已发布文章），
为公开归档接口提供领域端口。"
```

## Task 5.2: 后端 infrastructure 层 — GORM 实现

**Files:**
- Modify: `api/internal/infrastructure/persistence/gorm/post_repo.go`

- [ ] **Step 1: 实现两个方法**

在 `api/internal/infrastructure/persistence/gorm/post_repo.go` 末尾追加实现。先读取该文件确认 `postToDomain`、`*postRepository` 结构体字段名（`r.db`）、`model.Post` 与 status 常量引用方式（`post.StatusPublished` 或直接字符串）。

实现（字段名以实际为准）：

```go
// FindArchiveYears 返回所有含已发布文章的年份（倒序、去重）
func (r *postRepository) FindArchiveYears(ctx context.Context) ([]int, error) {
	var years []int
	err := r.db.WithContext(ctx).
		Model(&model.Post{}).
		Where("status = ? AND published_at IS NOT NULL", post.StatusPublished).
		Distinct("EXTRACT(YEAR FROM published_at)").
		Order("EXTRACT(YEAR FROM published_at) DESC").
		Pluck("EXTRACT(YEAR FROM published_at)", &years).
		Error
	if err != nil {
		return nil, domainshared.Internal("归档年份查询失败", err)
	}
	return years, nil
}

// FindPublishedByYear 返回指定年份的全部已发布文章（按 published_at 倒序）
func (r *postRepository) FindPublishedByYear(ctx context.Context, year int) ([]*domain.Post, error) {
	var pos []model.Post
	err := r.db.WithContext(ctx).
		Preload("Tags").
		Where("status = ? AND published_at IS NOT NULL AND EXTRACT(YEAR FROM published_at) = ?",
			post.StatusPublished, year).
		Order("published_at DESC").
		Find(&pos).Error
	if err != nil {
		return nil, domainshared.Internal("按年查询归档文章失败", err)
	}
	return postPOsToDomain(pos), nil
}
```

> 注意：确认 `post.StatusPublished` 在 infrastructure 层的引用路径（可能需 `domainpost.StatusPublished` 或直接字面量 `"published"`）；确认 `postPOsToDomain`（复数批量转换函数）是否存在，否则用 `postToDomain` 循环转换；确认 `domainshared` import 别名与现有文件一致。

- [ ] **Step 2: 编译 + vet**

Run: `cd api && go build ./... && go vet ./...`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add api/internal/infrastructure/persistence/gorm/post_repo.go
git commit -m "feat(post): 实现归档查询（FindArchiveYears/FindPublishedByYear）"
```

## Task 5.3: 后端 application 层 — DTO + 用例

**Files:**
- Modify: `api/internal/application/post/service.go`

- [ ] **Step 1: 在 service.go 加 DTO 定义**

在 `service.go`（`PostDTO` 定义之后）加两个 DTO：

```go
// ArchiveItemDTO 归档文章项（精简字段，不含正文，避免响应过大）
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
```

- [ ] **Step 2: 加 toArchiveItem 辅助函数**

在 `toDTO` 函数附近加：

```go
// toArchiveItem 将领域 Post 转为精简归档项
func toArchiveItem(p *domain.Post) ArchiveItemDTO {
	item := ArchiveItemDTO{
		ID:          p.ID().String(),
		Slug:        p.Slug(),
		Title:       p.Title(),
		Excerpt:     p.Excerpt(),
		CoverImage:  p.CoverImage(),
		Tags:        p.Tags(),
		PublishedAt: "", // 默认空
	}
	if p.PublishedAt() != nil {
		item.PublishedAt = p.PublishedAt().Format(time.RFC3339)
	}
	return item
}
```

> 确认 `domain.Post` 的访问器方法名（`ID()`/`Slug()`/`Title()`/`Excerpt()`/`CoverImage()`/`Tags()`/`PublishedAt()`）与 entity.go 一致（已核对：一致）。`time` 已在 service.go 顶部 import。

- [ ] **Step 3: 加两个用例方法**

在 `Service` 上加：

```go
// ListArchiveYears 返回归档年份索引
func (s *Service) ListArchiveYears(ctx context.Context) ([]int, error) {
	return s.repo.FindArchiveYears(ctx)
}

// GetArchiveByYear 返回指定年份的归档数据
func (s *Service) GetArchiveByYear(ctx context.Context, year int) (ArchiveYearDTO, error) {
	const minYear = 1900
	if year < minYear || year > time.Now().Year()+1 {
		return ArchiveYearDTO{}, shared.BadRequest("无效的年份")
	}
	posts, err := s.repo.FindPublishedByYear(ctx, year)
	if err != nil {
		return ArchiveYearDTO{}, err
	}
	items := make([]ArchiveItemDTO, 0, len(posts))
	for _, p := range posts {
		items = append(items, toArchiveItem(p))
	}
	return ArchiveYearDTO{
		Year:  year,
		Count: len(items),
		Items: items,
	}, nil
}
```

> 确认 `shared.BadRequest` 在 application/post 包的 import 路径（已在 service.go 顶部 `blog-api/internal/domain/shared`，用 `shared.BadRequest`）。

- [ ] **Step 4: 编译 + vet**

Run: `cd api && go build ./... && go vet ./...`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/internal/application/post/service.go
git commit -m "feat(post): application 层新增归档用例（ListArchiveYears/GetArchiveByYear）"
```

## Task 5.4: 后端 interfaces 层 — handler + 路由

**Files:**
- Modify: `api/internal/interfaces/http/handler/post/post.go`
- Modify: `api/cmd/server/main.go`

- [ ] **Step 1: 加两个 handler**

在 `api/internal/interfaces/http/handler/post/post.go`（参考 `ListPublished` 的写法）加：

```go
// ArchiveYears 归档年份索引（公开）
func (h *Handler) ArchiveYears(w http.ResponseWriter, r *http.Request) {
	years, err := h.svc.ListArchiveYears(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]any{"years": years})
}

// ArchiveByYear 指定年份归档（公开）
func (h *Handler) ArchiveByYear(w http.ResponseWriter, r *http.Request) {
	yearStr := r.PathValue("year")
	year, err := strconv.Atoi(yearStr)
	if err != nil {
		response.RespondError(w, r, shared.BadRequest("无效的年份"))
		return
	}
	dto, err := h.svc.GetArchiveByYear(r.Context(), year)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}
```

> import 补充：`strconv`、`blog-api/internal/domain/shared`（确认别名与现有 import 一致；若已有则不重复）。`response.RespondError`、`response.RespondOK` 已在用。

- [ ] **Step 2: 注册路由**

在 `api/cmd/server/main.go` 的 `v1.Route("/posts", func(r chi.Router) {...})` 块内（`r.Post("/{id}/view", ...)` 之后）加：

```go
			r.Get("/archive", postH.ArchiveYears)         // 归档年份索引
			r.Get("/archive/{year}", postH.ArchiveByYear) // 指定年份归档
```

> 注意：`/archive` 与 `/{slug}` 同级。chi 路由 `/archive`（静态）会优先于 `/{slug}`（通配）匹配，无冲突。

- [ ] **Step 3: 编译 + vet**

Run: `cd api && go build ./... && go vet ./...`
Expected: PASS

- [ ] **Step 4: 启动服务手动验证**

Run: `cd api && go run ./cmd/server &` （或 `make api`）后：
Run: `curl -s http://localhost:8080/api/v1/posts/archive`
Expected: `{"data":{"years":[2026,2025,...]}}`（含已发布文章的年份倒序）
Run: `curl -s http://localhost:8080/api/v1/posts/archive/2026`
Expected: `{"data":{"year":2026,"count":N,"items":[{"id","slug","title","excerpt","cover_image","tags","published_at"},...]}}`
Run: `curl -s http://localhost:8080/api/v1/posts/archive/1800`
Expected: 400 `无效的年份`

- [ ] **Step 5: Commit**

```bash
git add api/internal/interfaces/http/handler/post/post.go api/cmd/server/main.go
git commit -m "feat(post): 新增公开归档接口 GET /posts/archive 与 /posts/archive/{year}"
```

## Task 5.5: 后端 openapi 文档

**Files:**
- Modify: `api/internal/openapi/paths_post.go`
- Modify: `api/internal/openapi/schemas.go`（或 shared.go，看 schema 注册位置）

- [ ] **Step 1: 读取现有 post openapi 注册模式**

Read: `api/internal/openapi/paths_post.go`（了解 path 与 schema 注册方式）
Read: `api/internal/openapi/schemas.go`（了解 schema 定义函数命名与注册）

- [ ] **Step 2: 补归档 path + schema**

按现有模式注册两条 path（`/posts/archive`、`/posts/archive/{year}`，method GET，公开无需 security）与两个 schema（`ArchiveItemDTO`、`ArchiveYearDTO`，字段含注释/描述）。具体写法对齐文件内既有 path 函数风格。

- [ ] **Step 3: 编译 + 运行 openapi 测试**

Run: `cd api && go build ./...`
Expected: PASS

Run: `cd api && go test ./internal/openapi/...`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add api/internal/openapi/
git commit -m "docs(openapi): 补充归档接口 path 与 schema 定义"
```

## Task 5.6: 前端 archive feature 层

**Files:**
- Create: `web/src/features/archive/model/types.ts`
- Create: `web/src/features/archive/api/keys.ts`
- Create: `web/src/features/archive/api/client.ts`
- Create: `web/src/features/archive/api/queries.ts`

- [ ] **Step 1: 创建 model/types.ts**

`web/src/features/archive/model/types.ts`:

```ts
/**
 * archive 模块类型定义
 *
 * 对齐后端 application/post.ArchiveItemDTO / ArchiveYearDTO。
 */

/** ArchiveYearIndex - 归档年份索引 */
export interface ArchiveYearIndex {
    /** 含已发布文章的年份列表（倒序） */
    years: number[];
}

/** ArchiveItem - 归档文章项（精简字段，不含正文） */
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

- [ ] **Step 2: 创建 api/keys.ts**

`web/src/features/archive/api/keys.ts`:

```ts
/** archiveKeys - 归档 query key 工厂 */
export const archiveKeys = {
    /** 模块根 */
    all: ["archive"] as const,
    /** 年份索引 */
    years: () => [...archiveKeys.all, "years"] as const,
    /** 指定年份 */
    year: (year: number) => [...archiveKeys.all, "year", year] as const,
};
```

- [ ] **Step 3: 创建 api/client.ts**

`web/src/features/archive/api/client.ts`:

```ts
import { apiGet } from "@shared/api/request";
import type { ArchiveYear, ArchiveYearIndex } from "../model/types";

/**
 * fetchArchiveYears - 调 GET /posts/archive 获取归档年份索引
 */
export const fetchArchiveYears = async (): Promise<ArchiveYearIndex> =>
    apiGet<ArchiveYearIndex>("/posts/archive");

/**
 * fetchArchiveYear - 调 GET /posts/archive/{year} 获取指定年份归档
 *
 * @param year 年份
 */
export const fetchArchiveYear = async (year: number): Promise<ArchiveYear> =>
    apiGet<ArchiveYear>(`/posts/archive/${year}`);
```

- [ ] **Step 4: 创建 api/queries.ts**

`web/src/features/archive/api/queries.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import * as api from "./client";
import { archiveKeys } from "./keys";

/** useArchiveYears - 归档年份索引 hook（SSR 预取用） */
export const useArchiveYears = () =>
    useQuery({
        queryKey: archiveKeys.years(),
        queryFn: () => api.fetchArchiveYears(),
    });

/** useArchiveYear - 指定年份归档 hook（懒加载，默认 enabled 跟随参数） */
export const useArchiveYear = (year: number, enabled = true) =>
    useQuery({
        queryKey: archiveKeys.year(year),
        queryFn: () => api.fetchArchiveYear(year),
        enabled,
    });
```

- [ ] **Step 5: 类型检查**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/src/features/archive/
git commit -m "feat(archive): 新增归档 feature 层（types/api/queries）"
```

## Task 5.7: 归档公共页 + 导航

**Files:**
- Create: `web/src/routes/blog/archive.tsx`
- Modify: `web/src/shared/config/nav.ts`

- [ ] **Step 1: 创建归档页**

`web/src/routes/blog/archive.tsx`（SSR 预取年份索引 + 按年懒加载 + 前端按月分组）：

```tsx
import { fetchArchiveYears } from "@features/archive/api/client";
import { archiveKeys } from "@features/archive/api/keys";
import { useArchiveYear, useArchiveYears } from "@features/archive/api/queries";
import type { ArchiveItem } from "@features/archive/model/types";
import { Badge } from "@shared/ui/badge";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useEffect, useRef, useState } from "react";

/** 按月分组：{ [month]: items[] }，月份倒序 */
function groupByMonth(items: ArchiveItem[]): Map<number, ArchiveItem[]> {
    const map = new Map<number, ArchiveItem[]>();
    for (const item of items) {
        const month = new Date(item.published_at).getMonth() + 1;
        if (!map.has(month)) map.set(month, []);
        map.get(month)!.push(item);
    }
    // 月份倒序（items 已倒序，仅 key 排序）
    return new Map([...map.entries()].sort((a, b) => b[0] - a[0]));
}

/** YearSection - 单个年份区块（懒加载，进入视口或激活时拉取） */
function YearSection({
    year,
    active,
    onActivate,
}: {
    year: number;
    active: boolean;
    onActivate: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const { data, isLoading, error, refetch } = useArchiveYear(
        year,
        active, // 仅在激活（最近年或进入视口）时拉取
    );

    // 进入视口自动激活
    useEffect(() => {
        if (active) return;
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    onActivate();
                    obs.disconnect();
                }
            },
            { rootMargin: "200px" },
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [active, onActivate]);

    return (
        <section ref={ref} id={`year-${year}`} className="scroll-mt-20">
            <h2 className="mb-4 text-xl font-bold">
                {year} <span className="text-muted-foreground">· {data?.count ?? 0} 篇</span>
            </h2>
            {isLoading && <div className="text-muted-foreground">加载中…</div>}
            {error && (
                <button type="button" onClick={() => refetch()} className="text-destructive">
                    加载失败，点击重试
                </button>
            )}
            {data && (
                <div className="space-y-6">
                    {[...groupByMonth(data.items).entries()].map(([month, items]) => (
                        <div key={month}>
                            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                                {format(new Date(2020, month - 1, 1), "MMMM", { locale: zhCN })}
                            </h3>
                            <ul className="space-y-2 border-l-2 border-border pl-4">
                                {items.map((item) => (
                                    <li key={item.id} className="flex items-start gap-3">
                                        <span className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                                            {format(new Date(item.published_at), "MM-dd")}
                                        </span>
                                        <div>
                                            <a
                                                href={`/blog/${item.slug}`}
                                                className="font-medium hover:text-primary hover:underline"
                                            >
                                                {item.title}
                                            </a>
                                            {item.tags.length > 0 && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {item.tags.map((t) => (
                                                        <Badge key={t} variant="outline" className="text-xs">
                                                            {t}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

function ArchivePage() {
    const { data: indexData, isLoading } = useArchiveYears();
    const years = indexData?.years ?? [];
    // 最近一年默认激活并拉取
    const [activeYears, setActiveYears] = useState<Set<number>>(
        () => new Set(years.slice(0, 1)),
    );

    // 年份索引加载后再初始化最近一年
    useEffect(() => {
        if (years.length > 0 && activeYears.size === 0) {
            setActiveYears(new Set([years[0]]));
        }
    }, [years, activeYears.size]);

    return (
        <div className="container mx-auto px-4 py-12">
            <header className="mb-10">
                <h1 className="text-3xl font-bold">归档</h1>
                <p className="mt-2 text-muted-foreground">
                    共 {years.length} 个年份
                </p>
            </header>

            {/* 年份快速导航 */}
            {years.length > 1 && (
                <nav className="mb-10 flex flex-wrap gap-2">
                    {years.map((y) => (
                        <a
                            key={y}
                            href={`#year-${y}`}
                            className="rounded-full border px-3 py-1 text-sm hover:bg-accent"
                        >
                            {y}
                        </a>
                    ))}
                </nav>
            )}

            {isLoading ? (
                <div className="text-muted-foreground">加载中…</div>
            ) : years.length === 0 ? (
                <div className="text-muted-foreground">暂无文章</div>
            ) : (
                <div className="space-y-12">
                    {years.map((y) => (
                        <YearSection
                            key={y}
                            year={y}
                            active={activeYears.has(y)}
                            onActivate={() =>
                                setActiveYears((prev) => new Set(prev).add(y))
                            }
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export const Route = createFileRoute("/blog/archive")({
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData({
            queryKey: archiveKeys.years(),
            queryFn: () => fetchArchiveYears(),
        });
    },
    component: ArchivePage,
});
```

> 注意：文章链接用 `<a href>`（SSR 友好的整页导航）或 TanStack `<Link to="/blog/$slug">`。若用 Link，import 从 `@tanstack/react-router`。以全站 blog 列表链接用法对齐。

- [ ] **Step 2: 加导航项**

修改 `web/src/shared/config/nav.ts`，在 `NAV_ITEMS` 数组中"博客"项之后插入：

```ts
    { type: "route", label: "归档", to: "/blog/archive" },
```

> 确认 `NAV_ITEMS` 元素结构（`{ type: "route", label, to }`），与现有"首页/博客/关于/项目"项一致。

- [ ] **Step 3: 路由树生成 + 类型检查 + lint**

Run: `cd web && npx tsc --noEmit`
Expected: PASS（若 `routeTree.gen.ts` 未含 archive 路由，运行 `pnpm dev` 触发生成后重试）

Run: `cd web && npx biome check src/routes/blog/archive.tsx src/features/archive/ src/shared/config/nav.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add web/src/routes/blog/archive.tsx web/src/features/archive/ web/src/shared/config/nav.ts
git commit -m "feat(archive): 新增公开归档页（按年/月分组 + 懒加载 + SSR 预取年份索引）"
```

---

## 最终验证

- [ ] **后端全量**

Run: `cd api && go build ./... && go vet ./... && go test ./...`
Expected: 全 PASS

- [ ] **前端全量**

Run: `cd web && npx tsc --noEmit && npx biome check .`
Expected: 全 PASS（仅本计划新增/改动文件应有改动；他人未提交文件不在本计划提交内）

- [ ] **提交历史确认**

Run: `git log --oneline -15`
Expected: 看到 5 个模块各自的提交（audit/comments/settings/projects/archive），无 `CreatePermissionDialog.tsx`/`Modal.tsx` 被包含。

## Self-Review

**1. Spec coverage（对照 spec 各节）:**
- 模块1 audit 修复+接入 → Task 1.1-1.4 ✓
- 模块2 comments 纯前端 → Task 2.1-2.2 ✓
- 模块3 settings 纯前端（settings:update 门控）→ Task 3.1-3.2 ✓
- 模块4 projects + 公共页接通 → Task 4.1-4.2 ✓
- 模块5 archive 全栈（年份索引+按年懒加载+前端按月分组+nav）→ Task 5.1-5.7 ✓
- 横切：字段注释（贯穿各 TS/Go 代码块）、提交纪律（各 Task 的 git add 精确路径）、权限对齐（comments/projects 不挂、settings 挂）✓

**2. Placeholder scan:** 已检查，无 TBD/TODO/「适当处理」/「类似 Task N」。所有代码块完整。唯一保留为「对齐实际」的提示（如 DataTable 选择能力、Switch import 路径），因依赖组件实际签名，已在步骤中给出「以实际为准 + 参考既有页」的明确处置，非占位。

**3. Type consistency:**
- `ArchiveItemDTO`(Go) ↔ `ArchiveItem`(TS) 字段一致（id/slug/title/excerpt/cover_image/tags/published_at）✓
- `ArchiveYearDTO`(Go: Year/Count/Items) ↔ `ArchiveYear`(TS: year/count/items) JSON tag 一致 ✓
- `auditLogKeys`/`commentKeys`/`settingsKeys`/`archiveKeys`/`projectKeys` 命名一致，无冲突 ✓
- handler 方法名 `ArchiveYears`/`ArchiveByYear` 在 repo→service→handler→route 全链一致 ✓
