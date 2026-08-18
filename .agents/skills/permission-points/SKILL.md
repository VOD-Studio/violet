---
name: permission-points
description: Use when adding, removing, or wiring RBAC permission points — creating an admin page or endpoint that needs RequirePermission, gating admin nav or UI with useHasPermission/PermissionGuard, adding a permission seed migration, deciding action granularity (manage vs fine-grained verbs), or retiring a feature's permissions.
---

# 权限点设计规范

RBAC 权限点格式 `module:action`（正则 `^[a-z]+(:[a-z][a-z-]*)?$`，见 `api/internal/domain/permission/entity.go`）：module 为名词，action 多词用连字符（`update-role` / `manage-tokens` / `delete-any`）。

## 粒度判断树

按序判定：

1. 有独立后台页面的 module → 必建 `view`（页面可见性 + 读接口共用）。
2. 写操作默认合用一个 `manage`——前提：所有角色对该 module 的写操作总是同时授予，无拆分需求。
3. 出现具体授权差异（存在「能 X 不能 Y」的角色需求）时才拆：
   - CRUD 语义用标准动词 `create` / `update` / `delete`；
   - 业务语义用精确动词（`publish` / `approve` / `ban` / `refetch` / `toggle`），不硬套 CRUD。
4. 拆分是 additive（新权限点 seed 给原有角色，授权只增不减）；合并是 breaking（需回收已授权限）。宁粗勿细，等需求出现再拆。
5. `manage` 遮蔽实际能力——一旦某 module 出现部分授予需求，立即拆成显式动词，不往 `manage` 上叠语义。

## 新增权限点四层同步

1. **常量**：`api/internal/domain/permission/entity.go` 预定义表加 `XxxYyy = MustParse("module:action")`。
2. **迁移**：新建 `api/migrations/NNN_add_xxx_permission.{up,down}.sql`，模板照抄 `063_add_subscription_manage_permission.up.sql`（INSERT permissions + 挂 menu parent + seed admin 角色）。
3. **后端引用**：路由 `middleware.RequirePermission(perm, ...)` 与应用层 `HasPermission(...)` 引用 domain 常量（参数为 `...string`，传 `Code.String()`）。
4. **前端**：`web/src/features/admin-layout/ui/nav-menu/nav-menu-config.ts` 的 `permissions` 数组 + 页面内 `useHasPermission` / `PermissionGuard`。

四层全部落地才算完成；漏前端会让无权限用户看到入口，漏迁移会让常量指向不存在的权限点。

## 鉴权位置

- 路由中间件 `RequirePermission` 管模块入口（整组端点的粗门禁）。
- 「作者本人 or 持某权限」的双轨判断放应用层（`post.canModify` / `tweet:delete-any` 模式）：路由不挂中间件，service 内 `HasPermission(role, isRoot, code)` 放行作者或权限持有者。

## 删除权限点

功能下线时反向清理四层，迁移照抄 `055_remove_dead_permissions.up.sql` 的顺序——外键依赖决定顺序：

1. **迁移**：先删 `role_permissions` 关联，再删孤立 menu 分组节点，最后删 `permissions` 行；`{up,down}.sql` 成对。
2. **后端引用**：确认路由与应用层无引用后，删 domain 常量；容器内 `go build ./...` 验证。
3. **前端**：nav-menu-config、`PermissionGuard`、`useHasPermission` 调用点同步移除。

拆分 `manage`（判断树第 5 条）= 先按四层同步新增动词权限点并 seed 给原有角色，引用点全部切换后，旧 `manage` 若无消费方按上述流程删除。

