---
name: permission-points
description: Use when adding, renaming, or wiring RBAC permission points — creating an admin page or endpoint that needs RequirePermission, gating admin nav or UI with useHasPermission/PermissionGuard, adding a permission seed migration, or deciding action granularity (manage vs fine-grained verbs).
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

