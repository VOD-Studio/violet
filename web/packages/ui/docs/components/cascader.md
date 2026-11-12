# Cascader

按层级逐列选一条路径：栏目 / 系列 / 章节、省 / 市 / 区。选项只有一层用 select，要多选或要看整棵树用 tree-select，Cascader 只选**一条路径**。

```tsx
import { Cascader } from "@violet/ui";

<Cascader
  aria-label="发布位置"
  options={[
    { value: "tech", label: "技术", children: [{ value: "frontend", label: "前端", children: [{ value: "css", label: "样式" }] }] },
    { value: "essay", label: "随笔" },
  ]}
  value={path}
  onValueChange={(path, nodes) => setPath(path)}
/>
```

不是复合组件：一个 `Cascader` 渲染触发器、面板与隐藏输入。

## 属性

| 属性 | 作用 |
| --- | --- |
| `options` | 选项树，节点是 `{ value, label, children?, disabled?, isLeaf? }`；同级 `value` 唯一 |
| `value` / `defaultValue` / `onValueChange(path, nodes)` | 选中的路径 `string[]`，空数组表示没有选择；回调同时给出路径上能解析到的节点链，清除时都是 `[]` |
| `changeOnSelect` | 每一级都能选 |
| `loadData(nodes)` | 按需加载，见下 |
| `searchable`、`searchPlaceholder` | 触发器换成输入框并按完整路径搜索 |
| `placeholder` | 没有选择时的占位，默认「请选择」 |
| `empty` | 第一级没有选项时的内容，默认「无选项」 |
| `variant`、`controlSize`、`invalid`、`valid`、`loading`、`disabled`、`readOnly`、`required` | 与 Input、Select 一致 |
| `open`、`defaultOpen`、`onOpenChange` | 面板开合 |
| `name`、`form` | 表单字段，见下 |
| `container`、`collisionBoundary`、`contentClassName` | 面板挂载点、碰撞边界、面板上的类名 |
| `id`、`aria-label`、`aria-labelledby`、`aria-describedby`、`aria-invalid`、`className`、`style` | 落在可聚焦元素上（`className`、`style` 落在外壳上） |

叶子是没有 `children` 的节点；`children: []` 是「有子级但目前为空」，面板里显示「没有子项」，默认模式下选不中。受控的 `value` 指向树里找不到的节点时（比如还没加载），没解析到的那一级显示它的 `value`。

## 触发器

复用输入框外壳（四变体、三档尺寸 32 / 36 / 40，触屏各加 4、字号 16、状态与聚焦色同 Input），`role="combobox"`、`aria-haspopup="tree"`、`aria-expanded`、`aria-controls`，右侧 16px `ChevronDown`；`loading` 时换成指示器并设 `aria-busy`，`readOnly` 没有箭头、可聚焦不可展开。

选中后显示完整路径，分隔符「 / 」用次级文字色，单行省略。**多于三级折成「首级 / … / 末级」**：折叠后的可见文字 `aria-hidden`，完整路径放在 `title` 与一段只给读屏的文字里，所以读屏读出的始终是完整路径，不只是最后一级。

`searchable` 时触发器是输入框外壳：前置搜索图标、`role="combobox"` 的 `input`、清除钮（`aria-label="清除"`，有值且可编辑时出现，在 Tab 顺序里紧跟输入框，清除后焦点回到输入框）。关闭时输入框的值是完整路径；展开后输入框清空等待输入，原路径放进占位文字。聚焦不会自动展开，点击、输入、↓、Enter 才展开。

## 面板

`role="tree"`；每一列是一个 `role="group"`（名称「第 N 级」），行是 `role="treeitem"`，带 `aria-level`、`aria-setsize`、`aria-posinset`、`aria-selected`（已选路径的末级），有下一级的行带 `aria-expanded`。

- 列宽 184、列间 4、每列最高 264（滚动）；面板 `width: max-content`、`max-width: calc(100vw - 80px)`，列多于视口时整体横向滚动，新列出现时滚到最右。
- 有下一级的行右侧 `›`；已选的行右侧对勾；当前展开路径上的行字重 600（墨色，不叠季节色底）；禁用行 40% 透明。
- 展开：点击立即展开；鼠标停在有下一级的行上 120ms 后也展开，移开则取消（斜着移向右边的列不会误切换）。悬停只展开不选中，也不触发按需加载；键盘导航会取消尚未到点的悬停展开；触屏的指针不触发悬停。指针悬停的行同时成为读屏光标（`aria-activedescendant`），不改变展开路径、选值与字重。选中叶子后收起并把焦点还给触发器。
- 新列直接出现、不滑入；每一列各有一块跟着指针滑动的底色，键盘光标改为行自身的 `--muted` 底色。
- 展开时（含 `open`、`defaultOpen` 一开始就展开）面板回到已选路径：每一列展开、已选行滚到列中间、光标落在已选行。
- 触屏（`pointer: coarse`）：不并排多列，一次只显示当前一级，行高 ≥44；进入下一级后顶部出现「‹ 返回」。

`changeOnSelect`：点一次有下一级的行，同时展开并选中，路径显示到这一级，面板保持打开；**再点已选中的行取消选择**（行仍保持展开）。叶子照旧：选中并收起。

## 按需加载

给 `loadData` 后，没有 `children` 又没标 `isLeaf` 的节点首次展开时调用 `loadData(nodes)`（`nodes` 是第一级到它的节点链），返回的数组作为它的 `children`；结果缓存在组件里，已加载的不再请求。**有 `loadData` 时叶子必须标 `isLeaf: true`**，否则它会被当成还没加载的节点。

- 加载中：该行右侧换成指示器并设 `aria-busy`，下一列位置显示「加载中…」；同一节点加载中重复点击不会重复请求。
- 失败（Promise 拒绝）：该行变危险色、右侧换成重试图标，读屏多读一句「加载失败，点击重试」；再点这一行重试。
- 键盘 → / Enter 落在未加载的行上同样发起加载，加载完光标落到第一个可用子项。
- 搜索只搜已加载的部分。

## 搜索

输入匹配任意一级的文字（不分大小写），面板换成单列的结果：完整路径、匹配字高亮（`--decoration` 30% 底）、**只列叶子**，路径上任何一级禁用的叶子不列；没有匹配显示「无匹配的路径」。↑ ↓ 移动高亮（默认第一项，不循环，鼠标悬停也会移动），Enter 选中高亮项并收起。结果行没有 `aria-level`，不是严格的 WAI-ARIA tree 模式，与设计稿一致。

## 键盘与读屏

焦点始终在触发器（或搜索输入框）上，光标行由 `aria-activedescendant` 指出。

| 操作 | 结果 |
| --- | --- |
| 触发器上 Enter、↓、↑（非搜索形态还有 Space） | 展开；已选路径上的行为光标，没有已选项且是键盘展开时光标落在第一个可用项 |
| ↑ ↓ | 在当前列移动光标，跳过禁用项，不循环；Home / End 到列首尾 |
| → | 进入下一列并落在它的第一个可用项；叶子上无效 |
| ← | 回上一列（光标回到上一级的行，下一列保持展开）；第一列无效 |
| Enter | 叶子：选中并收起；有下一级：进入下一列（同 →）；`changeOnSelect` 时改为选中它并收起 |
| Space | 叶子：选中并收起；有下一级：进入下一列。搜索形态不拦截空格 |
| Esc | 收起，值不变，焦点回触发器；在对话框里只收起面板，不关对话框 |
| Tab | 收起并去下一个控件，不还焦点 |
| 焦点移出组件、点外部 | 收起 |
| 面板展开时点触发器 | 收起 |
| 搜索词非空时 ↑ ↓ / Enter | 见「搜索」；←、→、Home、End 留给输入框 |

输入法组合期间（`isComposing`）不响应任何导航键。面板上的按下一律 `preventDefault`，触发器不会因点选项或点滚动条而失焦。Esc 在 Radix 的捕获阶段处理，不看 `defaultPrevented`（站点根上常驻的 Radix 层会先对每个 Esc 调用 `preventDefault`）。

## 表单与 Field

`name` 给了才渲染隐藏输入：**选中后每一级一个同名 `<input type="hidden">`，按层级顺序提交**（`formData.getAll(name)` 就是路径数组），没有选择就不提交，`disabled` 时不提交；不用 `/` 串联，因为 `value` 里可能含 `/`。`form` 对应原生 `form` 属性。表单 `reset` 时回到 `defaultValue`（没给则回到空），受控的值也收到一次 `onValueChange`（已相等则不通知）；所属表单按 `form` id 定位，没有则取触发器最近的 `form`，不依赖隐藏输入是否存在。`required` 只写 `aria-required`，必填交给表单项校验。

`Field` 的唯一子元素是 `Cascader` 时，它克隆过来的 `id`、`aria-describedby`、`aria-invalid` 直接落到可聚焦的触发器（或搜索输入框）上，标签 `for` 命中它；显式的 `invalid` 优先于 `aria-invalid`。

## 面板外壳

沿用选择器族共用的 `lib/picker-panel.tsx`：Radix Popover 的 Anchor + Portal + Content，非模态、不抢焦点，下方起点对齐、距触发器 6px，放不下翻到上方；浮出 200ms、收起 140ms，位移 6px / 4px，不缩放；减弱动态（系统偏好与 `[data-motion="reduce"]` 作用域）只做透明度，滑动底色与加载圆弧静止。带局部作用域或缩放的宿主用 `container` 与 `collisionBoundary` 限定面板挂载范围与碰撞边界。

## 设计稿取舍

规格表与演示脚本不一致处一律按规格表实现：

- 列宽取表与 CSS 的 184（正文里的 176 是笔误）。
- 当前展开路径上的行是墨色 600，不用强调色加粗。
- 补齐脚本未实现的：`aria-activedescendant`（行带 id）、搜索态 Enter 选高亮项、`changeOnSelect` 再点取消选择、懒加载失败变危险色点击重试、空格 / → / Enter 进入下一列。
- 脚本里 ↑ ↓ 会立即选中叶子并关闭；这里只移动光标，选中靠 Enter / Space。
- 脚本里搜索态按键直接放弃；这里搜索态有自己的 ↑ ↓ / Enter。
- 设计稿的搜索输入框「打开时显示已选路径」与代码（打开时取搜索词）冲突：这里展开后输入框为空、旧路径放占位。

## 导入

React 从 `@violet/ui` 或 `@violet/ui/cascader` 导入，类型 `CascaderOption`、`CascaderLoadData` 同路径；按需 CSS 使用 `@violet/ui/components/cascader.css`，已含输入框外壳、指示器与面板的依赖样式。
