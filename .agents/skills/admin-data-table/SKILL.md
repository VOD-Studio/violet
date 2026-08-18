---
name: admin-data-table
description: Use when creating or editing an admin list/table page in web/src, wiring any paged query, or implementing a paginated repository/endpoint in api/. Covers hook choice (usePagedQuery vs useClientPagination), PageQuery type conventions, the backend paging contract, and the DataTable min-h-0 scroll chain.
---

# Admin 列表页接入规范

## Hook 选择

| 场景 | 用法 |
|---|---|
| 服务端分页表格 | `usePagedQuery(useListHook, baseQuery?, options?)` |
| 客户端全量切片 | `useClientPagination(data, initialPageSize?)` |
| 需全量的下拉（如角色选择） | `useAllRoles` 模式：`limit=100` + `select` 解包 |

- `usePagedQuery` / `useClientPagination` 位于 `web/src/features/admin-shared/ui/data-table/hooks/`；`useAllRoles` 模式是各 feature 自己的查询 hook（如 `admin-roles/api/queries.ts`），不在 data-table 下。新分页 hook 一律放各 feature 的 `hooks/` 目录。
- `usePagedQuery` 内管 page/pageSize 状态、拼 PageQuery 调模块 hook，返回的 `pagination` 在 JSX 直接 `pagination={pagination}` 消费。
- 无额外筛选的页面省略 `baseQuery`。
- 要新的分页形态，扩展 hook 本身，不在页面组件手搓变体。
- 默认每页 `DEFAULT_PAGE_SIZE`（导出自 `use-paged-query.ts`）；posts 页传 `initialPageSize: 10`。

## 类型约定

- 请求类型 `extends PageQuery`（`shared/api/types.ts`）。
- 响应统一 `PagedResponse<T>`（httpClient 拦截器解包后的形态）。
- API client / queries / query keys 统一收 `PageQuery` 对象，不散写 page/limit 参数。

## 后端契约

- 唯一真相在 `api/internal/domain/shared/paging.go`：`PageQuery` / `PageResult[T]`（钳制范围与默认值以源码为准）。
- 仓储统一签名 `FindPage(ctx, shared.PageQuery) (shared.PageResult[T], error)`；GORM 层复用 `countAndFind` helper。
- ORDER BY 必须带唯一列 tiebreaker（`id ASC`）——相同排序键的行在 offset 翻页间会漂移。
- admin 端点用 `RespondPaged`；公开端点（如 tags）无分页参数时返回全量数组保持前台兼容，带参才 paged。

## min-h-0 滚动链

表格内部自适应滚动依赖一条 CSS 高度链，每层 `min-h-0` 缺一不可：

```
main (overflow-hidden) → PageShell 内容区 → 页面内容 wrapper → DataTable 根 → 卡片 → OverlayScroll
```

任一层丢失 `min-h-0`，`min-height:auto` 会把内容自然高度向上传导，`max-h-full` 失效，表格退化为整页滚动、表头滚走。

验证方式：浏览器探针断言 `.os-host` 的 `scrollHeight > clientHeight`（内层滚动生效），且页面级滚动不因表格高度被撑开。
