# 权限树形改造 + CRUD + 内置保护 + 菜单接入 设计

> 日期：2026-06-30
> 分支：release/2.0
> 状态：已确认设计，待实施

## 背景与现状

当前 RBAC 权限系统（`api/migrations/025_rbac.up.sql`）的 `permissions` 表是**扁平结构**：仅有 `id / code / name / description / created_at`，无 `parent_id`、无 `type`、无 `is_builtin`、无 `sort`。权限代码格式为 `module:action`（如 `post:create`），前端在展示时**临时按 `:` 前缀做客户端分组**（`web/src/routes/admin.permissions.tsx:19-30` 与 `web/src/features/admin-roles/ui/RolePermissionsDialog.tsx:50-61` 各有一份重复逻辑）。

已确认的若干 gap：

- **内置保护缺失**：`Permission` 实体（`api/internal/domain/permission/entity.go`）没有任何内置标识；只有 `Role` 聚合（`api/internal/domain/role/entity.go`）有 `is_builtin` 概念。33 条种子权限与普通权限无法区分，均可被删除/改写。
- **权限页只读**：后端权限 CRUD 已存在（`main.go:389-391`，superadmin-only），前端 mutation hooks 也已写好（`web/src/features/admin-permissions/api/queries.ts`），但 `admin.permissions.tsx` 只有只读表格，没有任何增删改查 UI。
- **前后端契约不匹配**：后端权限更新/删除路由为 `PATCH/DELETE /admin/permissions/{code}`（`main.go:390-391`），前端却用 `PUT /admin/permissions/{id}`（`admin-permissions/api/client.ts`），方法与 key 均不一致——hooks 实际上调用即失败。
- **标签管理缺失**：后端 `tag` 领域仅有 Create + Delete（`main.go:257-266`），**无 Update 接口**；前端 `features/tags/` data layer 已存在但无管理页面、无侧边栏入口，相关 hooks 为死代码。
- **公告管理缺失**：后端公告 CRUD 完整（`main.go:411-415`，`announcement:manage` 权限），但前端既无 data layer 也无页面。
- **无 `menu` 领域**：管理后台侧边栏是静态数组 `ADMIN_NAV_ITEMS`（`web/src/features/admin-layout/ui/AdminNavConfig.ts:26-33`），与权限系统完全解耦，本 spec 不引入 DB 驱动的菜单，仅做静态项接入。

## 目标（确认的范围）

1. **权限树形返回**：后端真树，给 `permissions` 加 `parent_id`，引入 `type=menu` 分组节点，接口按树聚合返回。
2. **权限增删改查**：后端已有 CRUD，补齐前端 UI。
3. **内置默认权限保护**：加 `is_builtin` 字段；内置权限**不可删、不可改 code**，其余字段可改。
4. **接入剩下的菜单**：标签管理（后端补 Update）+ 公告管理（前端从零）。**文章管理明确不做。**

提交组织：**一个 spec，三个 commit**，按依赖顺序推进（权限 → 标签 → 公告）。

## 已确认的关键决策

| 决策点 | 选择 |
|--------|------|
| 树的实现方式 | 后端真树（加 `parent_id`） |
| 内置标识 | 加 `is_builtin` 字段 + domain guard |
| 内置保护范围 | **不可删 + 不可改 code**；name/description/parent/sort 可改 |
| "剩下的菜单"含义 | 接入标签管理、公告管理；文章管理不做 |
| 组织方式 | 一个 spec，分多个 commit |
| 分组节点设计 | 引入 `type=menu` 类型节点（13 个 module 各一个） |
| 权限 CRUD 路由 key | **从 `{code}` 改为 `{id}`**，与角色/用户一致 |
| HTTP 方法 | **PATCH 保持 PATCH**，前端 `PUT` 改回 `PATCH` |
| menu 节点授权 | menu 节点为纯展示容器，**不可单独 grant** |
| menu 节点 code | 正则放宽，允许纯 module 名（如 `post`，无 `:`） |

## 总览：三部分 / 三个 commit

| Part | 范围 | Commit |
|------|------|--------|
| **1. 权限系统** | 后端：加字段 + menu 节点 + 内置保护 + 路由统一；前端：树形展示 + CRUD UI | `feat(permission)` |
| **2. 标签管理** | 后端：补 `PATCH /tags/{id}`；前端：建页面 + 侧边栏入口 | `feat(admin/tags)` |
| **3. 公告管理** | 前端：从零写 data layer + 页面 + 侧边栏入口 | `feat(admin/announcements)` |

---

## Part 1：权限系统改造（Commit: `feat(permission)`）

### 1.1 数据库迁移

新建 `api/migrations/035_permission_tree.up.sql`（现有最大编号为 034）。

加 4 列：

```sql
ALTER TABLE permissions
  ADD COLUMN IF NOT EXISTS parent_id INT REFERENCES permissions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS type      VARCHAR(10) NOT NULL DEFAULT 'action',  -- 'menu' | 'action'
  ADD COLUMN IF NOT EXISTS sort      INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_builtin BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_permissions_parent ON permissions(parent_id);
```

为 13 个 module 各插入一条 `type=menu` 的根节点（`is_builtin=true`、`parent_id=NULL`），按业务域排序：

```sql
INSERT INTO permissions (code, name, type, parent_id, sort, is_builtin) VALUES
  ('post','文章','menu',NULL,1,TRUE),
  ('comment','评论','menu',NULL,2,TRUE),
  ('tag','标签','menu',NULL,3,TRUE),
  ('media','素材','menu',NULL,4,TRUE),
  ('playlist','歌单','menu',NULL,5,TRUE),
  ('song','歌曲','menu',NULL,6,TRUE),
  ('emoji','表情','menu',NULL,7,TRUE),
  ('user','用户','menu',NULL,8,TRUE),
  ('project','项目','menu',NULL,9,TRUE),
  ('settings','设置','menu',NULL,10,TRUE),
  ('role','角色','menu',NULL,11,TRUE),
  ('announcement','公告','menu',NULL,12,TRUE),
  ('admin','系统','menu',NULL,13,TRUE)
ON CONFLICT (code) DO NOTHING;
```

把现有 action 权限挂到对应 menu 下，并将所有现存 action 标记为内置：

```sql
UPDATE permissions p
SET parent_id = m.id
FROM permissions m
WHERE m.type = 'menu'
  AND p.type = 'action'
  AND p.code LIKE m.code || ':%';

UPDATE permissions SET is_builtin = TRUE WHERE type = 'action';
```

`admin:access` 挂到 `admin` menu 下（其 code 前缀已是 `admin`，上面的 LIKE 自动命中）。

对应写 `035_permission_tree.down.sql`（回滚：`DROP INDEX`、`ALTER TABLE ... DROP COLUMN`）。

### 1.2 领域模型（`domain/permission/entity.go`）

**放宽 `Code` 正则**（冒号部分可选，让 menu code 合法）：

```go
var permissionCodePattern = regexp.MustCompile(`^[a-z]+(:[a-z][a-z-]*)?$`)
```

新增方法：

```go
func (c Code) IsMenu() bool { return !strings.Contains(c.value, ":") }
```

`Permission` 实体加字段 + getter：

```go
type Permission struct {
    id          int32
    code        Code
    name        string
    description string
    parentID    *int32   // nil 表示根（menu）节点
    permType    string   // "menu" | "action"
    sort        int
    isBuiltin   bool
}
```

新增 mutator 与 guard：

```go
func (p *Permission) ParentID() *int32 { return p.parentID }
func (p *Permission) Type() string     { return p.permType }
func (p *Permission) Sort() int        { return p.sort }
func (p *Permission) IsBuiltin() bool  { return p.isBuiltin }

// UpdateCode 改 code —— 内置权限禁止
func (p *Permission) UpdateCode(c Code) error {
    if p.isBuiltin {
        return ErrCannotModifyBuiltin
    }
    p.code = c
    return nil
}

// 以下即使内置也允许
func (p *Permission) UpdateParent(parentID *int32) { p.parentID = parentID }
func (p *Permission) UpdateSort(sort int)          { p.sort = sort }
```

`UpdateName` / `UpdateDescription` 保持现状（内置也可改，符合"保护 code + 不可删，其余可改"）。

新增错误（与 role 聚合同名错误语义一致）：

```go
var ErrCannotModifyBuiltin = shared.BadRequest("内置权限不可修改 code 或删除")
```

`NewPermission` 签名扩展，补 `parentID / permType / sort / isBuiltin` 参数（或新增构造函数 `NewMenuPermission` / `NewActionPermission`，避免破坏现有调用点——实施时按调用点数量择优）。

### 1.3 持久层

`api/internal/infrastructure/persistence/gorm/model/rbac.go` 的 `Permission` PO 加 `ParentID *int32`、`Type string`、`Sort int`、`IsBuiltin bool`，并更新 PO↔entity 映射。

`permission_repo.go`：

- `FindAll` 返回全部字段（含 parent/type/sort/is_builtin）。
- 新增 `FindByID(ctx, id int32)` —— CRUD 改 `{id}` key 后需要。
- `Save` 保留"ID==0 则 Create 否则 full Save"语义，但要持久化新字段。

`PermissionRepository` 接口同步加 `FindByID`。

### 1.4 应用层（DTO + 树聚合 + CRUD guard）

`api/internal/application/role/dto.go`（`PermissionDTO` 当前定义在此）扩展：

```go
type PermissionDTO struct {
    ID          int32                `json:"id"`
    Code        string               `json:"code"`
    Name        string               `json:"name"`
    Description string               `json:"description"`
    Type        string               `json:"type"`              // "menu" | "action"
    ParentID    *int32               `json:"parent_id"`
    Sort        int                  `json:"sort"`
    IsBuiltin   bool                 `json:"is_builtin"`
    Children    []PermissionDTO      `json:"children,omitempty"` // 仅 menu 有
}
```

`ListPermissionsHandler`（`application/permission/query/permission_queries.go`）改为**内存组装树**：

1. `FindAll` 取全量。
2. 按 `sort` 升序、`id` 升序排序。
3. 把 `parent_id != nil` 的 action 挂到对应 menu 的 `Children`。
4. 返回顶层 menu 数组（`type=menu` 且 `parent_id=nil`）。
5. 若存在孤立的 action（`parent_id` 找不到父，理论不应发生），作为顶层项兜底返回，不报错。

Command 侧加 guard：

- `DeletePermissionHandler`：`input.ID`（key 改 id）→ `FindByID` → 若 `IsBuiltin()` 返回 `ErrCannotModifyBuiltin`；再走原有"使用中检查（CountRoles）→ Delete"。
- `UpdatePermissionHandler`：若入参带新 code 且与现有不同 → 调用 `p.UpdateCode()`（内置时由实体返回错误）；name/description/parent/sort 走各自 mutator。

Input 结构 key 由 `Code string` 改为 `ID int32`（路径参数来源变化）。

### 1.5 CRUD 路由统一（修复契约不匹配）

`api/cmd/server/main.go:387-392`：

```go
r.Group(func(r chi.Router) {
    r.Use(middleware.SuperAdminRequired)
    r.Post("/permissions",          roleH.CreatePermission)
    r.Patch("/permissions/{id}",    roleH.UpdatePermission)   // 原 {code} → {id}
    r.Delete("/permissions/{id}",   roleH.DeletePermission)   // 原 {code} → {id}
})
```

Handler（`interfaces/http/handler/role/role.go`）的 `UpdatePermission` / `DeletePermission`：路径参数从 `code` 改读 `id`（`chi.URLParam(r, "id")` → `strconv.ParseInt`）。请求体仍可带 `code` 字段用于"改 code"场景（非内置权限）。

同步更新 `api/internal/openapi/paths_admin_rbac.go`：路径参数 `{code}` → `{id}`，方法保持 PATCH/DELETE，schema 补 `type/parent_id/sort/is_builtin/children` 字段。

### 1.6 前端：权限树形页 + CRUD UI

**修复 data layer**（`web/src/features/admin-permissions/`）：

- `model/types.ts`：`PermissionDTO` 加 `type / parent_id / sort / is_builtin / children?`；`CreatePermissionRequest` 加 `type / parent_id? / sort?`；`UpdatePermissionRequest` 加 `code? / parent_id? / sort?`。
- `api/client.ts`：`updatePermission(id, body)` 改为 `apiPatch(\`/admin/permissions/${id}\`, body)`；`deletePermission(id)` 改为 `apiDelete(\`/admin/permissions/${id}\`)`。修正当前的 PUT + 双重 id 错误。
- `api/queries.ts`：`useUpdatePermission` / `useDeletePermission` 入参顺承 id。

**页面**（`web/src/routes/admin.permissions.tsx`，参考 `admin.roles.tsx` + `CreateRoleDialog` + `ConfirmDialog`）：

- 顶部"新建权限"按钮，外包 `PermissionGuard`（superadmin 可见，或用 `useIsSuperAdmin()`）。
- 表格用 `DataTable` 的 `expandable` 行（项目已有 `RowExpander`，见 `admin.users.tsx:355-367` 的用法）：menu 行可展开露出 action 子行。
- 列：代码 / 名称 / 类型(menu/action badge) / 描述 / 排序 / 内置标识 / 操作。
- 行操作：编辑 / 删除。
  - **内置权限**：删除按钮置灰 + tooltip"内置权限不可删除"；编辑弹窗内 code 字段 disabled。
- 新建/编辑对话框 `CreatePermissionDialog`：
  - type 单选（menu / action）。
  - action 时 parent 必选（下拉列出现有 menu），menu 时 parent 为空。
  - code、name、description、sort 输入。
- 删除走 `ConfirmDialog`。

**`RolePermissionsDialog` 改造**（`web/src/features/admin-roles/ui/RolePermissionsDialog.tsx`）：

- 消费新的树结构（后端已返回 `children`），替换现在 `permission.code.split(":")[0]` 的客户端分组逻辑。
- 按 menu 分组渲染，每组一个"全选"勾选 + 其下 action 勾选。
- menu 节点本身不可勾选（仅作分组容器，不进入 `permission_codes`）。

**抽取共享分组逻辑**：当前分组算法在 `admin.permissions.tsx` 与 `RolePermissionsDialog.tsx` 各一份，树形化后由后端统一提供，前端这两处客户端分组代码删除。

### 1.7 测试要点（Part 1）

- 后端：`cd api && go test ./...`，重点覆盖
  - 树聚合（menu 有 children、孤立 action 兜底）。
  - 内置权限 delete/UpdateCode 返回 `ErrCannotModifyBuiltin`。
  - 非内置权限可正常 delete（无引用时）/改 code。
- 前端：`cd web && npx biome check . && npx tsc --noEmit`。

---

## Part 2：标签管理接入（Commit: `feat(admin/tags)`）

### 2.1 后端：补 Update 接口

`api/cmd/server/main.go`（当前 `tag` 路由在 `:257-266`）。现状：`GET /tags/` 公开；Create/Delete 在 `AdminRequired` 守卫下（**未用** `RequirePermission`，尽管 `permission.TagCreate/Update/Delete` 常量已存在——属既有 gap）。

本次顺带把 tag 写操作收敛到细粒度权限（与常量对齐），新增 Update：

```go
v1.Route("/tags", func(r chi.Router) {
    r.Get("/", tagH.List)                              // 公开
    r.Group(func(r chi.Router) {
        r.Use(middleware.Auth(...))
        r.Use(middleware.AdminRequired)
        r.With(middleware.RequirePermission(permissionChecker, "tag:create")).
            Post("/", tagH.Create)
        r.With(middleware.RequirePermission(permissionChecker, "tag:update")).
            Patch("/{id}", tagH.Update)               // 新增
        r.With(middleware.RequirePermission(permissionChecker, "tag:delete")).
            Delete("/{id}", tagH.Delete)
    })
})
```

> 注意：tag 路由当前不在 `/admin` 分组内，沿用现状不强行迁移（避免破坏前端 `features/tags/` 的相对路径）。

- `TagRepository`（`domain/tag/entity.go`）已有 `Save`，新增 `application/tag/command/update_tag.go`（UpdateTagHandler，加载 → 改名/slug → Save）。
- Handler 加 `tagH.Update` 方法（命名与现有 `Create`/`Delete` 对齐）。

### 2.2 前端：建管理页 + 侧边栏

- 复用并扩展 `web/src/features/tags/` data layer：
  - `api/keys.ts` / `api/queries.ts` 已有 `useTags`。
  - `api/mutations.ts` 已有 `useCreateTag` / `useDeleteTag`，**新增 `useUpdateTag`**（PATCH `/tags/{id}`）。
  - `model/types.ts` 的 `Tag` 加可选 `slug`（后端有 slug 字段），`UpdateTagRequest { name?, slug? }`。
- 新建 `web/src/features/admin-tags/ui/`：CreateTagDialog / EditTagDialog / 复用 `ConfirmDialog`。
- 新建 `web/src/routes/admin.tags.tsx`：表格（名称 / slug / 操作）+ 新建/编辑/删除，仿 `admin.roles.tsx`。
- 侧边栏 `AdminNavConfig.ts` 加项：

```ts
{ label: '标签管理', to: '/admin/tags', icon: Tag }   // Tag from lucide-react
```

### 2.3 测试要点（Part 2）

- 后端 `go test ./...`（tag domain 用例）。
- 前端 biome + tsc。

---

## Part 3：公告管理接入（Commit: `feat(admin/announcements)`）

后端已完整（`main.go:411-415`），前端从零。

### 3.1 前端 data layer

新建 `web/src/features/admin-announcements/`，遵循项目三文件模式：

- `model/types.ts`：`AnnouncementDTO`（id / title / content / type 枚举 / 生效起止时间 / 创建时间等）、`CreateAnnouncementRequest`、`UpdateAnnouncementRequest`。**字段以实际后端 DTO 为准**——实施时先读 `content` handler 的响应结构对齐。
- `api/client.ts`：
  - `listAnnouncements()` → GET `/admin/announcements`
  - `getAnnouncement(id)` → GET `/admin/announcements/{id}`
  - `createAnnouncement(body)` → POST `/admin/announcements`
  - `updateAnnouncement(id, body)` → PATCH `/admin/announcements/{id}`
  - `deleteAnnouncement(id)` → DELETE `/admin/announcements/{id}`
- `api/keys.ts`：query key 工厂。
- `api/queries.ts`：`useAdminAnnouncements` / `useAnnouncementDetail` / `useCreateAnnouncement` / `useUpdateAnnouncement` / `useDeleteAnnouncement`（参考 `admin-roles/api/queries.ts`）。

### 3.2 前端页面 + 侧边栏

- 新建 `web/src/routes/admin.announcements.tsx`（仿 `admin.roles.tsx`）：
  - 表格列：标题 / 类型(badge) / 生效区间 / 状态 / 操作。
  - 新建/编辑对话框 + 删除 `ConfirmDialog`。
  - 用 `PermissionGuard permission="announcement:manage"` 包裹写操作。
- 侧边栏 `AdminNavConfig.ts` 加项：

```ts
{ label: '公告管理', to: '/admin/announcements', icon: Megaphone }   // Megaphone from lucide-react
```

### 3.3 测试要点（Part 3）

- 前端 `npx biome check . && npx tsc --noEmit`。

---

## 通用约定

- **不动**：文章管理（post）、角色内置逻辑、公开站点前端、菜单的 DB 化（本 spec 仅做静态侧边栏接入）。
- **OpenAPI**：Part 1 的路由改动同步 `paths_admin_rbac.go`；Part 2/3 的标签/公告路由若未文档化则在对应 openapi 文件补全。
- **构建验证**：每个 commit 前跑对应语言的相关检查（go build/test、biome、tsc）。
- **提交纪律**：仅提交本 spec 规定的产物；spec 文档本身的提交只含本 spec 文件。

## 风险与回滚

- **迁移可回滚**：`down.sql` 提供 drop column；menu 节点的 INSERT 用 `ON CONFLICT DO NOTHING` 幂等。
- **路由 breaking**：权限 CRUD 从 `{code}` 改 `{id}` 是契约变更，但前端此前调用即失败（PUT+code 不匹配），现网无实际消费者，改后干净。
- **Code 正则放宽**：仅新增"无冒号也合法"的分支，原有 `module:action` 全部仍合法，不破坏既有数据。
- **menu 节点 grant**：若误把 menu code 授予角色，因中间件匹配的是具体 action code，menu code（如 `post`）不会命中任何路由守卫，无害；前端 `RolePermissionsDialog` 不允许勾选 menu 即可避免混淆。
