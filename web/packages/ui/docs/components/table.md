# Table

后台所有列表共用的一张表：`DataTable`，加上静态表格用的 `Table` 原语。不套卡片，直接放在页面纸片上；表头一条细线，行与行之间一条细线；排序箭头与行内按钮悬停才出现；批量操作不再浮在页面底部，而是在表头原位淡入。

怎么选：

| 组件 | 什么时候用 | 例子 |
| --- | --- | --- |
| `list` | 一行一条，要快速扫，行间不画线 | 设置、成员、文件 |
| `DataTable` | 要按列比较、排序、勾选、批量操作、分页 | 文章管理、用户、评论 |
| `Table` 原语 | 少量静态数据，只要表格的外观与语义，不需要状态 | 用量明细、歌单曲目 |
| `card` | 每条都需要被单独看 | 文章卡片 |
| `tree` | 有层级 | 文档目录 |

```tsx
import { DataTable, type DataTableColumn } from "@violet/ui";

const columns: DataTableColumn<Post>[] = [
  { key: "title", header: "标题", accessorKey: "title", ellipsis: true },
  { key: "views", header: "浏览", accessorKey: "views", align: "right", sortable: true },
  { key: "actions", header: "", sticky: "right", hideable: false, stopClickPropagation: true,
    cell: (post) => (
      <span className="v-table__row-actions">
        <Button variant="ghost" iconOnly size="sm" aria-label={`编辑 ${post.title}`}><Pencil /></Button>
      </span>
    ) },
];

<DataTable
  caption="文章列表"
  columns={columns}
  data={page.items}
  keyExtractor={(post) => post.id}
  sort={sort}
  onSortChange={setSort}
  pagination={{ page: page.number, pageSize: page.size, total: page.total, onChange: (next, size) => load(next, size) }}
  loading={isLoading}
  error={error}
  onRetry={refetch}
  emptyTitle="还没有文章"
  emptyDescription="写下第一篇，它会出现在这里"
/>
```

数据、排序、分页、选择都由调用方持有：`DataTable` 不请求数据、不排序、不切片，只渲染 `data` 这一页。`usePagedQuery` 与 `useClientPagination` 依赖站点的接口层，不在包里。

## DataTable 属性

| 属性 | 作用 |
| --- | --- |
| `columns` / `data` / `keyExtractor` | 列定义、当前页的行、行唯一键（选择与展开都按它记） |
| `caption` | 表格的可访问名称：渲染为屏幕外的 `<caption>`，同时命名横向滚动区域；没传时区域名称是「数据表格」 |
| `density` | `comfortable`（默认）表头 36、行 48；`compact` 表头 32、行 40 |
| `container` | 内部浮层（显示列菜单、每页条数选项、单元格提示）的挂载容器，默认 `body`；同时作为判定「放不下」的边界。陈列室舞台与带缩放的宿主传它，与 `Select`、`TreeSelect` 的 `container` 一致 |
| `className` | 落在根容器上 |
| `toolbar` | 表格上方的槽位（搜索、筛选、密度、导出按钮），由调用方排布；根容器是纵向 flex，工具栏与表格间距 14 |
| `sort` / `onSortChange` | 受控排序态 `{ key, order }`；点一下升序，再点降序 |
| `pagination` | `{ page, pageSize, total, onChange(page, pageSize), pageSizeOptions?, hidePageSizeSelect? }`；不传没有分页栏，`total` 为 0 也不显示 |
| `selectable` / `selectedIds` / `onSelectionChange` | 勾选列；`selectedIds` 受控，不传由组件自管；都跨页保持 |
| `bulkActions` | 批量操作区；传了才有批量栏，见「选择与批量操作」 |
| `onSelectAll` / `totalSelectable` | 「选中全部 N 项」，见「选择与批量操作」 |
| `expandable` / `renderExpandedRow` / `expandedRowKeys` / `onExpandedChange` / `expandedRowFixed` | 展开行；`expandedRowKeys` 受控；`expandedRowFixed` 让面板固定在可视区、不随横向滚动移动 |
| `onRowClick` / `rowClassName` | 整行点击（行显示手型光标）、按行数据附加类名 |
| `resizable` / `columnMinWidth` | 列宽可拖动，最小 80（可改）；记在 `storageKey` 下 |
| `storageKey` | 列显隐与列宽记在这台设备上的键前缀；传了才有表头左上角的「显示列」按钮 |
| `loading` / `error` / `onRetry` / `filtered` | 状态，见「状态」 |
| `emptyTitle` / `emptyDescription` / `emptyAction` | 空状态的标题（默认「暂无数据」）、说明、主操作 |
| `filteredTitle` / `filteredDescription` / `filteredAction` | 筛选后为空的标题（默认「没有匹配的结果」）、说明（默认「换个关键词，或者清除筛选」）、操作 |
| `errorTitle` | 出错状态第一句（默认「没能读取数据」）；第二句取 `error.message` |

## 列定义

| 字段 | 作用 |
| --- | --- |
| `key` | 列唯一标识；排序、显隐、列宽、固定偏移都按它引用 |
| `header` | 表头内容；「显示列」菜单与 CSV 表头只认字符串或数字，其余回退为 `key` / 空 |
| `accessorKey` / `cell(row)` | 取值：`cell` 优先；`accessorKey` 的值非字符串/数字时 `String()`，空值不渲染 |
| `align` | `left`（默认）/ `center` / `right`；`right` 的列数字等宽（`tabular-nums`），表头排序箭头换到左边 |
| `width` | `"120px"` 或 `"20%"`；固定列请用 px，偏移按 px 累加。伸缩列（见「列宽」）的 `width` 只作表格最小宽度的一部分 |
| `fitContent` | 按行内容最大宽度撑开（`width` 作最小宽度）；右固定列默认开启，可写 `false` 关掉 |
| `sticky` | `left` / `right`，同侧多列按宽度累加偏移 |
| `sortable` | 表头变成按钮，写 `aria-sort` |
| `hideable` | 是否出现在「显示列」菜单，默认 `true`；操作列写 `false`，固定在右侧不能隐藏 |
| `resizable` | 是否出现列宽手柄，默认跟随 `resizable`；右固定列与它左边紧邻的一列没有手柄 |
| `ellipsis` / `tooltip(row)` | 单行省略号截断，悬停且**确实被截断**时才显示完整内容；给了 `tooltip` 则不看是否截断，始终显示这段文字 |
| `exportValue(row)` | CSV 取值，缺省取 `accessorKey` |
| `className` | 附加到该列的 `th` 与 `td` |
| `stopClickPropagation` | 该列单元格点击不触发 `onRowClick`（操作列）；在 `td` 上拦截冒泡，禁用按钮不派发 click 落到单元格时同样不会触发整行点击 |

## 状态

优先级：**出错 > 加载中 > 空 > 数据**。表头始终保留；状态写在表体里，是一个跨全部列的 `td`，内容从标题列起左对齐（缩进 = 展开列 + 勾选列 + 单元格内边距），一句说现状，一句说原因或下一步，再给一个按钮。

| 状态 | 呈现 | 读屏 |
| --- | --- | --- |
| 出错（`error` 非空） | 红点 + `errorTitle`，下一行等宽字写 `error.message`（调用方在 `Error.message` 里写清原因与已经做过的事，如「502 · 上游超时，已经重试 2 次」）；传了 `onRetry` 才有「重试」按钮 | `role="alert"` |
| 加载中（`loading`） | 4 行骨架，长短错开，透明度缓慢起伏（`skeleton` 单元，减弱动态静止）；勾选与展开列留空 | 表格 `aria-busy`，屏幕外一句 `role="status"`「加载中」 |
| 空（`data` 为空、`filtered` 为假） | `emptyTitle`、`emptyDescription`、`emptyAction`（页面传入主操作） | `role="status"` |
| 筛选后为空（`filtered` 为真） | `filteredTitle`、`filteredDescription`、`filteredAction`；标题里带上搜索词与「清除筛选」按钮由调用方写 | `role="status"` |

`filtered` 只在 `data` 为空时起作用；有数据时照常显示。空与筛选后为空用两组独立的文案，不按 `filtered` 在同一组文案上分支，免得调用方为两种场景写同一个字符串。

## 选择与批量操作

- 勾选跨页保持：换页只换 `data`，`selectedIds` 里别页的 id 原样保留；批量栏会说明「其中 N 项不在本页」。
- 表头全选框**只管本页**：本页没选时点它选满本页；本页全选或只选了一部分时点它取消本页，不碰其它页（与设计稿的行为一致）。部分选中显示横线（`aria-checked="mixed"`）。
- **批量栏**（传了 `bulkActions` 才存在）盖在表头原位，从勾选列之后到右端，不改变表头高度；有选中项时 160ms 淡入，取消后淡出，淡出的栏不可聚焦、对读屏隐藏。内容依次是「已选 N 项」（`aria-live="polite"`）、整页选满时的「选中全部 N 项」、分隔线、`bulkActions`、「取消选择」。点「取消选择」后焦点回到表头全选框。
- **选中全部结果**：整页选满、传了 `onSelectAll`、已选数小于 `totalSelectable`（缺省取 `pagination.total`）时，批量栏出现「选中全部 N 项」，点击调用 `onSelectAll()`；调用方负责把全部结果的 id 写进 `selectedIds`（可能要请求）。没传 `onSelectAll` 就没有这个按钮。

```tsx
<DataTable
  selectable
  selectedIds={ids}
  onSelectionChange={setIds}
  onSelectAll={async () => setIds(new Set(await fetchAllIds(filters)))}
  bulkActions={<><Button variant="ghost" size="sm">发布</Button><Button variant="ghost" size="sm">归档</Button></>}
  pagination={{ ... total }}
/>
```

## 展开

展开列 32 宽，箭头转 90°（280ms）；面板在行下方高度展开 280ms，与上一行隔 8px、缩进到与标题列对齐，浅底、圆角 10、最宽 760（`--v-table-panel-max` 覆盖），不重复标题。面板**只在展开期间挂载**，`renderExpandedRow` 里的请求因此是懒触发的；收起时过渡结束才卸载。展开按钮带 `aria-expanded`，名称「展开」/「收起」；展开列与面板不触发整行点击。减弱动态下面板直接出现与消失。

## 列显隐、列宽与持久化

传了 `storageKey`，表头左上角（展开列里，没有展开列则是单独的 32 宽首列）出现「显示列」按钮，菜单列出 `hideable !== false` 的列，勾选框连着改不收起；有隐藏列或调整过列宽时多一项「重置列」（恢复全部列与默认列宽）；底部写「记在这台设备上」。「重置列」放在菜单里而不是设计稿的标题行小图标，因为菜单项能用方向键到达。

| 键 | 内容 |
| --- | --- |
| `${storageKey}` | 被隐藏的列 `key` 的数组，如 `["email"]` |
| `${storageKey}-widths-v2` | 用户手动调整过的列宽 `{ key: px }`，只记被拖动的那一列；勾选、展开、显示列与右固定列的记录不再采信 |

键名沿用旧实现，用户设备上已有的记录继续生效；不再读取旧版自适应宽度的键。localStorage 不可用时静默跳过，不影响功能。

列宽手柄在表头单元格右端：拖动时同步改 `colgroup` 与表格最小宽度，下限 `columnMinWidth`（默认 80）；拖拽中表宽钉成各列之和，其余列不会被撑宽；单击不固化自适应宽度；`pointercancel` 还原。手柄是 `button`（`aria-label="调整列宽"`），聚焦后 ← / → 每次调整 8px。只记被拖动的那一列；松手后拖动前写进 DOM 的临时宽度先还原，再由状态重新渲染。

## 列宽

`table-layout: fixed` 加表宽 100% 时，若所有列都写了宽度，多出来的宽度会按比例分给全部列。为让窄列与操作列永远精确：

- 勾选列 36、展开列 32、「显示列」独立首列 32，以及右固定的操作列，宽度不被分摊，也不采信设备上记录的值（旧版曾把它们的实测宽度一并记下）。
- **伸缩列**：第一个没被拖过宽度、非固定、非 `fitContent` 的数据列。它在 `colgroup` 里不写宽度，多余的宽度只归它；声明的 `width` 与用户拖出的宽度只计入表格最小宽度。
- 所有非固定数据列都被拖过宽度时（旧版记下的就是这种），退到最后一个非固定数据列做伸缩列。「重置列」可以清掉记录，让第一个数据列重新伸缩。
- 状态与展开面板的左缘 = 前导列宽度之和 + 单元格内边距 12，正好是首个数据列文字的左缘。

## 固定列与横向滚动

表格是**一张 `<table>`**，`table-layout: fixed`，`min-width` 是所有列宽之和（未声明宽度的列按 120）：容器放不下时在滚动区内横向滑动，不裁切、不挤成一线。表头吸顶，纵向滚动时留在上面。

高度：根容器 `max-block-size: 100%`，滚动区是根容器里的 flex 子项，不依赖百分比高度。父级有确定高度（后台页面里 `min-h-0 flex-1` 的 wrapper，或固定高度的块）时，表格在内部滚动、表头固定、页脚不动；父级高度 auto 时表格自然长高，没有内部滚动，展开行与每页条数变化都不会叠到页脚上。

滚动区是 `role="region"` 且 `tabindex="0"`，以 `caption` 命名，键盘可聚焦、方向键滚动；聚焦环画在滚动区外框上，盖过吸顶表头。

固定列（`sticky`、勾选列、展开列）用 `position: sticky` 贴边，背景与该行同色且不透明，悬停与选中时跟着变色。**只有出现横向滚动时**，固定列内侧边缘才出细线与内容渐隐，不用投影：滚离左端时左固定列边缘出现，右边还有内容时右固定列边缘出现。滚动状态写在根元素的 `data-scrolled-start` / `data-scrolled-end` 上，直接写 DOM，滚动与缩放不触发重渲染。

右固定列与 `fitContent` 列的宽度取内容的实际宽度加单元格左右内边距，在布局阶段测量；有 `width` 时作最小宽度。

## 行内操作的样式钩子

行内「编辑」「更多」这类按钮属于调用方的单元格内容。把它们包进 `className="v-table__row-actions"` 的元素：悬停或聚焦该行时才出现（`opacity` 过渡 160ms），键盘 Tab 进入时也会出现；触屏没有悬停（`hover: none`）时常显；里面的 `button` 与链接固定 28×28。操作列通常写 `sticky: "right"`、`hideable: false`、`stopClickPropagation: true`。

数字、日期等宽显示用 `className="v-table__num"`（`--font-mono`，等宽数字）；右对齐列自带 `tabular-nums`。

## 分页栏

左侧「共 N 条 · 第 p/P 页」与每页条数选择（`select` 单元，选项 10 / 20 / 50，可用 `pageSizeOptions` 改；`hidePageSizeSelect` 隐藏），右侧页码（`pagination` 单元）。翻页保持每页条数；切换条数回到第 1 页，`onChange(1, size)`。行的 `aria-rowindex` 是跨页的全局序号：`(page - 1) × pageSize + 行序`。

## 键盘与读屏

| 部件 | 契约 |
| --- | --- |
| 表格 | 原生 `table`，名称取 `caption`；表头 `th scope="col"`，带 `aria-colindex`；选中的行 `aria-selected`、带全局 `aria-rowindex` |
| 滚动区 | `role="region"`、`tabindex="0"`、名称取 `caption` |
| 排序列 | 表头是 `button`，Enter / Space 激活；`th` 带 `aria-sort`（`none` / `ascending` / `descending`），不可排序的列没有；正在排序的列名加深；箭头装饰对读屏隐藏 |
| 全选框 | 「全选本页」，`aria-checked` 为 `true` / `false` / `mixed` |
| 行勾选框 | 「选择第 N 行」（N 为全局行号） |
| 展开按钮 | `aria-expanded`，名称「展开」/「收起」 |
| 显示列 | 按钮「显示列」打开菜单（`menuitemcheckbox`），方向键、Enter / Space、Esc 都是菜单的原生行为 |
| 列宽手柄 | `button`「调整列宽」，← / → 调 8px |
| 批量栏 | `role="toolbar"`「批量操作」；未出现时 `aria-hidden` 且不可聚焦 |
| 状态 | 出错 `role="alert"`，其余 `role="status"`；状态行是跨全部列的 `td` |

整行点击（`onRowClick`）只响应指针，行本身不进 Tab 序列；需要键盘到达的操作请放进行内按钮。

## 导出 CSV

`exportToCsv(filename, columns, rows)` 把行数据导出为 CSV 并触发下载：以 BOM 开头（Excel 正确识别 UTF-8 中文），只导出有 `accessorKey` 或 `exportValue` 的列（`cell` 渲染出的节点取不出文本，纯展示列不导出），含逗号、引号、换行的字段加引号并转义。导出按钮由调用方放进 `toolbar`，`DataTable` 不内置。

## Table 原语

`Table`、`TableHeader`、`TableBody`、`TableFooter`、`TableRow`、`TableHead`、`TableCell`、`TableCaption` 是静态表格的部件，与 `DataTable` 共用同一份外观（表头 36、行 48、单元格左右 12、表头一条细线、行间一条细线）。每个部件带稳定的 `data-slot`，`className` 与原生属性落在对应元素上；`Table` 外有横向滚动的 `table-container`，`className` 落在 `<table>`。`TableRow` 的 `data-state="selected"` 换成季节色选中底，悬停整行换浅底；`TableHead scope="row"` 用作行标题时按正文样式；`data-density="compact"` 切到表头 32、行 40。没有排序、勾选、固定列、列宽与状态——需要它们用 `DataTable`。

## 外观

- 行底色走每行的 `--v-table-rb`：默认 `--card`；悬停是 `--muted` 与底色 55% 混合；选中是 `--decoration` 5% 混合（悬停 8%）。表格放在 `--card` 以外的底上时，在 `className` 里覆盖 `--v-table-bg`，固定列与表头才不会露出底色差。
- 表头 12 号次级色；行 14 号；排序箭头悬停时是 50% 透明的双向箭头，排序后换成实心上 / 下箭头。
- 过渡：悬停底色 120ms，排序箭头与行内按钮 160ms，展开箭头与展开面板 280ms，批量栏 160ms；不用 `scale`，不用投影。减弱动态（系统偏好与 `[data-motion="reduce"]` 作用域）下全部静止，骨架不起伏，展开面板直接出现与消失。
- 聚焦环：勾选框、排序按钮、图标按钮与手柄都在单元格内，环不会越出滚动区；滚动区自己的环画在外框内侧。

## 设计稿取舍

- 设计稿的「显示列」是自绘的弹出层，这里用 `dropdown-menu`；每页条数用 `select`；二者的滑动高亮与键盘都是单元自带的。
- 设计稿的表头与行是 CSS Grid，这里是真正的 `<table>`：保留表格语义，单元格靠 `table-layout: fixed` 与 `colgroup` 对齐。旧实现的表头与表体是两张 `table` 靠脚本同步横向滚动，这里合并为一张、一个滚动区，表头用 `position: sticky` 吸顶。
- 批量栏的位置与高度跟设计稿一致，但数据由调用方给；设计稿里「选中全部」直接改选中集，这里交给 `onSelectAll`，因为全部结果的 id 在服务端分页下不在前端。
- 列宽手柄的命中区在表头单元格内部（右端 10px），设计稿是骑在列边界上；避免被相邻表头盖住。
- 稿里没有出错状态的重试次数：「已经重试 2 次」这类原因由调用方写进 `Error.message`。

## 已知边界

- 整行点击没有键盘等价，沿用旧实现。
- 展开面板最宽 760 是稿给的值；内容更宽的页面用 `--v-table-panel-max` 覆盖。
- 表格没有行虚拟化，大数据量靠分页。
- 真实 tarball 消费验收（类型、SSR、Vite 构建、按需 CSS）与 `/ui` 陈列室逐态检视（明暗、四季、窄屏、减弱动态）已做；聚焦态只在前台标签里验过。

## 导入

React 从 `@violet/ui` 或 `@violet/ui/table` 导入；按需 CSS 使用 `@violet/ui/components/table.css`，已含按钮、勾选框、下拉菜单、滚动条、分页、选择器、骨架与文字提示的依赖样式。
