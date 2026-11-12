---
name: admin-data-table
description: Use when creating or editing an admin list/table page in web/src, wiring any paged query, or implementing a paginated repository/endpoint in api/. Covers DataTable (from @violet/ui) usage, hook choice (usePagedQuery vs useClientPagination), PageQuery type conventions, the backend paging contract, and the table scroll height chain.
---

# Admin 列表页接入规范

## DataTable 来源与导入

`DataTable` 与它的类型、`exportToCsv`、`Table*` 原语都在 `@violet/ui`（`web/packages/ui/src/components/table/`，契约见 `web/packages/ui/docs/components/table.md`），站点不再有自己的实现：

```tsx
import { DataTable, type DataTableColumn, type DataTableSort, exportToCsv } from "@violet/ui";
import { usePagedQuery, useClientPagination } from "@features/admin-shared/ui/data-table";
```

- `usePagedQuery`、`useClientPagination`、`DEFAULT_PAGE_SIZE` 依赖站点接口层，留在 `@features/admin-shared/ui/data-table`（目录里只剩 `hooks/`）；不要在页面里再从这个路径取 `DataTable` 或类型。
- 数据、排序、分页、选择都由页面持有；`DataTable` 只渲染传入的这一页。
- 批量操作栏：`selectable` 且传了 `bulkActions` 才存在，在**表头原位**淡入（不是页面底部浮条），内含「已选 N 项」与「取消选择」。页面不要在 `toolbar` 里再写「已选 N 项」。服务端分页要「选中全部 N 项」时传 `onSelectAll`（由页面把全部结果的 id 写进 `selectedIds`）与可选的 `totalSelectable`。
- 弹层挂载与边界：`container` 默认 `body`；放在带缩放或固定舞台里才需要传。
- 空与出错文案：`emptyTitle`/`emptyDescription`/`emptyAction`、`filtered` + `filteredTitle`/`filteredDescription`/`filteredAction`、`errorTitle`（第二句取 `error.message`）。
- 行内「编辑 / 更多」这类次要图标按钮：放进 `className="v-table__row-actions"` 的容器里，悬停或聚焦该行才出现（触屏常显）；该类只让**直接子级**的 `button`/`a` 固定 28×28。主操作文字按钮与审核类的关键操作（如评论通过 / 标垃圾）不套。操作列写 `sticky: "right"`、`hideable: false`、`stopClickPropagation: true`。
- 静态少量数据用 `Table` 原语，不需要排序、勾选、固定列时才用；外观与 `DataTable` 一致（表头 36、行 48、单元格左右 12），不要再写死 `h-10`、`px-2` 一类覆盖。

## Hook 选择

| 场景 | 用法 |
|---|---|
| 服务端分页表格 | `usePagedQuery(useListHook, baseQuery?, options?)` |
| 客户端全量切片 | `useClientPagination(data, initialPageSize?)` |
| 需全量的下拉（如角色选择） | `useAllRoles` 模式：`limit=100` + `select` 解包 |

- 落位看消费方：跨 feature 的通用分页 hook 放 `web/src/features/admin-shared/ui/data-table/hooks/`（扩展既有 hook，见下）；单一 feature 私有的分页 hook 放该 feature 的 `hooks/` 目录。`useAllRoles` 模式即后者（如 `admin-roles/api/queries.ts`），不在 data-table 下。
- `usePagedQuery` 内管 page/pageSize 状态、拼 PageQuery 调模块 hook，返回的 `pagination` 在 JSX 直接 `pagination={pagination}` 消费。
- 无额外筛选的页面省略 `baseQuery`。
- 要新的分页形态，扩展 hook 本身，不在页面组件手搓变体。
- 默认每页 `DEFAULT_PAGE_SIZE`（导出自 `use-paged-query.ts`）；页面需要偏离默认时显式传 `initialPageSize`（如 posts 页传 10），不复制常量值。

## 类型约定

- 请求类型 `extends PageQuery`（`shared/api/types.ts`）。
- 响应统一 `PagedResponse<T>`（httpClient 拦截器解包后的形态）。
- API client / queries / query keys 统一收 `PageQuery` 对象，不散写 page/limit 参数。

## 后端契约

- 唯一真相在 `api/internal/domain/shared/paging.go`：`PageQuery` / `PageResult[T]`（钳制范围与默认值以源码为准）。
- 仓储统一签名 `FindPage(ctx, shared.PageQuery) (shared.PageResult[T], error)`；GORM 层复用 `countAndFind` helper。
- ORDER BY 必须带唯一列 tiebreaker（`id ASC`）——相同排序键的行在 offset 翻页间会漂移。
- admin 端点用 `RespondPaged`；公开端点（如 tags）无分页参数时返回全量数组保持前台兼容，带参才 paged。

## 滚动与高度

`DataTable` 是一张 `<table>`，外面一个 `role="region"` 的横向滚动区（`tabindex="0"`，名称取 `caption`），表头 `position: sticky` 吸顶；根容器是纵向 flex 且 `max-block-size: 100%`，滚动区是其中的 flex 子项，不依赖百分比高度。

- 父级有确定高度（后台页面里 `min-h-0 flex-1` 的 wrapper）时，表格在内部滚动、表头固定、分页栏不动。
- 父级高度 auto 时表格自然长高，没有内部滚动。
- 后台页面的高度链仍然成立，每层缺一不可：

```
main (overflow-hidden) → PageShell 内容区 (min-h-0 flex-1 overflow-y-auto) → 页面内容 wrapper (min-h-0 flex-1) → DataTable 根
```

任一层丢失 `min-h-0`，`min-height:auto` 会把内容自然高度向上传导，`max-block-size: 100%` 失效，表格退化为整页滚动、表头滚走。

验证方式：浏览器探针断言 `.v-data-table__scroller` 的 `scrollHeight > clientHeight`（内部滚动生效），且页面级滚动不因表格高度被撑开。
