---
name: permission-points
description: Use when designing, adding, removing, or wiring RBAC permission points — deciding action granularity (coarse manage vs fine-grained verbs), seeding a new permission, gating routes or admin UI, or retiring a feature's permissions.
---

# 权限点设计规范

权限点格式 `module:action`：module 为名词，action 多词用连字符。格式与校验正则以仓库的权限实体源码为唯一真相（grep `ParseCode` / 权限码正则定位），不在此复述。

## 粒度判断树

按序判定：

1. 有独立后台页面的 module，先按页面性质分两支：
   - **有独立管理对象**（存在 CRUD 语义的资源，如文章/评论/用户）→ 必建 `view`（页面可见性 + 读接口共用）。
   - **纯聚合只读页**（无管理对象，如后台概览/统计总览）→ 跟随所在区域门禁（如 `admin:access`），不单独建点。裁决标准是**受众**：已持区域门禁者看聚合数字不构成最小权限违规（无被迫升权）；仅当预期出现独立受众角色（如只读运营只看统计、不进其他管理页）时才建 `xxx:view`，属 additive 拆分（第 4 条）。
2. 写操作默认合用一个 `manage`——前提：所有角色对该 module 的写操作总是同时授予，无拆分需求。
3. 出现具体授权差异（存在「能 X 不能 Y」的角色需求）时才拆：
   - CRUD 语义用标准动词 `create` / `update` / `delete`；
   - 业务语义用精确动词（`publish` / `approve` / `ban` 等），不硬套 CRUD。
4. 拆分是 additive（新权限点 seed 给原有角色，授权只增不减）；合并是 breaking（需回收已授权限）。宁粗勿细，等需求出现再拆。
5. `manage` 遮蔽实际能力——一旦某 module 出现部分授予需求，立即拆成显式动词，不往 `manage` 上叠语义。

## 新增权限点同步清单

1. **常量**：权限码预定义常量表（domain 层；项目无此表则建立）加新码。
2. **迁移**：新建 add-permission 迁移，以仓库最近一个同类迁移为模板（INSERT 权限 + 挂 menu/分组 + seed 默认角色，均带幂等保护）。
3. **后端引用**：路由权限中间件与应用层校验一律引用常量，不写字符串字面量。
4. **前端**：后台导航配置的权限数组 + 页面内权限门控 hook / guard。

四层全部落地才算完成；漏前端会让无权限用户看到入口，漏迁移会让常量指向不存在的权限点。

## 鉴权位置

- 路由权限中间件管模块入口（整组端点的粗门禁）。
- 「作者本人 or 持某权限」的双轨判断放应用层 service：路由不挂中间件，service 内校验放行作者或权限持有者。

## 删除权限点

功能下线时反向清理，迁移按外键依赖顺序：先删角色关联，再删孤立分组节点，最后删权限点行；`{up,down}.sql` 成对。确认路由与应用层无引用后删常量，构建验证；前端导航与门控调用点同步移除。

拆分 `manage`（判断树第 5 条）= 先按同步清单新增动词权限点并 seed 给原有角色，引用点全部切换后，旧 `manage` 若无消费方按上述流程删除。
