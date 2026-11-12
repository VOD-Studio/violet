# TreeSelect

从一棵树里选一个或几个节点：素材目录、权限范围、分类。选项是平铺的几项用 select；只有「栏目 / 系列 / 章节」这样的固定层级、逐级向右展开用 cascader；树的内容本身要展示或导航（不是选值）是 [Tree 单元](./tree.md)，TreeSelect 的树行与它同源但**不共享实现**：缩进每级 18（Tree 是 20）、右侧 4px 内边距（Tree 是 8px）、焦点在触发器（Tree 的焦点在树容器上）。

```tsx
import { TreeSelect } from "@violet/ui";

<TreeSelect
  aria-label="素材目录"
  placeholder="选择目录"
  options={[
    { value: "2026", label: "2026", children: [{ value: "spring", label: "春" }] },
    { value: "avatar", label: "头像" },
  ]}
  value={folder}
  onValueChange={setFolder}
/>
```

## API

单一组件，`options` 是树；不是组合式部件。

| 属性 | 作用 |
| --- | --- |
| `options` | 节点 `{ value, label, children?, lazy?, disabled?, icon?, meta? }`；`value` 在整棵树里必须唯一 |
| `value` / `defaultValue` / `onValueChange` | 单选 `string`（空串表示没有选择）；`multiple` 时 `string[]`，类型随之收窄 |
| `multiple` | 多选，勾选联动 |
| `leafOnly` | 仅单选：点到目录只展开收起，只有叶子能选 |
| `searchable` | 触发器变成搜索输入 |
| `loadChildren` | 懒加载，见下 |
| `expanded` / `defaultExpanded` / `onExpandedChange` | 展开着的节点 `value` 数组 |
| `open` / `defaultOpen` / `onOpenChange` | 面板开合 |
| `placeholder` / `emptyText` / `maxChips` | 占位（可搜索时是搜索输入的占位）、没有节点时的文字（默认「无节点」）、多选最多画几个芯片（默认 2） |
| `variant` / `controlSize` / `invalid` / `valid` / `loading` / `disabled` / `readOnly` / `required` | 与 Input、Select 一致 |
| `name` / `form` | 隐藏输入，见「表单」 |
| `container` / `collisionBoundary` / `panelClassName` / `className` / `style` | 面板挂载容器、判定「放不下」的边界、面板与外壳样式 |
| `id` / `aria-label` / `aria-labelledby` / `aria-describedby` / `aria-invalid` | 落在真正可聚焦的元素上 |

`TreeSelectOption.icon` 缺省：目录是文件夹（展开时是打开的文件夹）、叶子是文件，16px 次级色。`meta` 是行右侧的 12px 次级信息（等宽数字），通常放目录下的叶子数，由调用方计算。

## 值与勾选联动

- **单选**：值是被选节点的 `value`，目录与叶子都能选（`leafOnly` 时只能选叶子）。点行选中并收起、焦点回触发器；点行前的箭头只展开收起。选中行字重 600，右侧一个墨色对勾。找不到节点的值（例如它在尚未取回的子树里）触发器里原样显示 `value`。触发器的 `title` 是完整路径（「2026 / 季节 / 春」），选中后一个 `role="status"` 的隐藏播报区读出同一条路径。
- **多选**：值是被勾选的**叶子**的 `value` 数组，目录的 `value` 不会进入值。勾选目录 = 勾选它之下所有可选的叶子；已全部选满则全部取消。目录的三态由叶子推出：未选、部分选中（短横）、全部选中（对勾）；取消其中一个叶子目录变部分选中，全部选满目录自动变全选。禁用的叶子不被目录的勾选动到，已选中的禁用叶子保留并计入目录状态。不能被勾选的行（禁用节点、没有可选叶子的目录、尚未取回的懒节点）点击不改值，也不触发 `onValueChange`。
- **触发器芯片「覆盖最少节点」**：选满的目录只显示目录名，不再列出它下面的叶子；部分选中的目录往下找；超过 `maxChips`（默认 2）折成不可移除的「+N」。芯片的移除钮 `aria-label="移除 {标签}"` 取消该芯片覆盖的全部叶子（含已选中的禁用叶子；行上的勾选仍不会动禁用项）；有选择且可编辑时有「清除全部」。值里不在树中的项（还没取回的节点等）也列成芯片，免得选了却看不见。

## 展开、搜索与懒加载

- **展开记忆**：展开状态由组件记着，关闭再打开保持；打开时已选节点的祖先全部展开，并把已选行滚到面板中间。受控用 `expanded`。
- **搜索过滤**（`searchable`）：不分大小写、匹配任意一级的文字，只保留匹配节点与它们的祖先，祖先强制展开，匹配字用 `<mark>`（`--decoration` 30% 底）高亮；无匹配显示「无匹配节点」。搜索时的展开独立于记下的展开状态，清空搜索词后恢复原样；搜索中展开箭头不响应。关闭时搜索词清空，输入框回到显示已选路径。单选的输入框打开后先是空的，选中项的路径只在关闭态显示；多选的输入框跟在芯片之后。
- **懒加载**：节点写 `lazy: true` 且传了 `loadChildren(option) => Promise<TreeSelectOption[]>`。首次展开时箭头换成梅花指示器、行带 `aria-busy`，取回成功后子节点直接出现（已取回的不再取）；取回失败（拒绝或同步抛错）时整行变危险色、右侧提示「加载失败，点击重试」、行收起，点这一行、点箭头、或键盘 →/Enter 都会重试。取回为空数组的节点变成叶子。没传 `loadChildren` 时 `lazy` 按叶子处理。取回的节点同样参与搜索，**尚未取回的子树不会被搜到**。取回的子节点缓存属于传入的 `options`：`options` 或 `loadChildren` 的引用变了（换了数据源），旧缓存清空、在途请求的结果作废，同一节点重新等待取回。
  - 多选里未取回的节点没有叶子可勾，点行等同于展开取回；单选里点这一行选中节点本身，用箭头展开。
  - 取回的节点的 `value` 同样要在整棵树里唯一。

## 触发器

复用输入框外壳（`v-input-control`，四变体、三档尺寸、九种状态共用 `input` 单元同一份 CSS）。

- 单选：`button[role="combobox"][aria-haspopup="tree"]`，尾部 16px `ChevronsUpDown`；`loading` 换成指示器并设 `aria-busy`；`readOnly` 没有箭头、可聚焦不可展开。
- 多选：外壳是 `div`，依次是芯片、展开钮（真正的 `role="combobox"`，`id` 与 `aria-*` 落在它上面）、「清除全部」、箭头；外壳高度随芯片换行，最小为尺寸档高度。收起后有一个隐藏的已选摘要（「已选 X、Y」；超过两项是「已选 X、Y 等 N 项」）经 `aria-describedby` 关联到展开钮，与调用方传入的取并集；没有 `aria-label`、`aria-labelledby` 与 `id`（也就没有 label for）时用占位文案兜底命名。
- 可搜索：外壳 `div`，前置 16px 搜索图标，`input[role="combobox"][aria-autocomplete="list"]`，有内容时出现「清除」钮（多选是「清除全部」），没有尾部箭头。
- 「清除全部」与「清除」在 Tab 顺序里，排在展开钮或输入框之后；清除后按钮卸载，焦点回到触发器。芯片上的 × 是 `tabindex="-1"`，不参与 Tab：键盘路径是面板里取消勾选与「清除全部」。

## 键盘与读屏

焦点始终在触发器（可搜索时是搜索输入）上，高亮行由 `aria-activedescendant` 指出，行有稳定的 id；面板是 `role="tree"`（多选加 `aria-multiselectable`），行是 `role="treeitem"`，带 `aria-level`、`aria-posinset`、`aria-setsize`，目录带 `aria-expanded`，名称取自文字（不含箭头钮的「展开或收起」）。单选用 `aria-selected`；多选用 `aria-checked`（`true`/`false`/`mixed`），**不写 `aria-selected`**。展开箭头是 `tabindex="-1"` 的按钮、`aria-label="展开或收起"`。树的名称取 `aria-label`，否则取 `aria-labelledby` 或触发器的 `id`。

| 操作 | 结果 |
| --- | --- |
| 触发器上 ↓ ↑（非搜索时还有 Enter、Space） | 展开，高亮已选行（没有则第一行） |
| ↑ ↓ | 在可见行间移动，跳过禁用的叶子，**不循环**；键盘高亮是行自身的 `--muted` 底色 |
| Home / End | 到首行 / 末行；可搜索时留给输入框光标 |
| → | 收起的目录先展开；已展开再按进入第一个子行；叶子不动 |
| ← | 展开的目录先收起；已收起或叶子回到上级行；可搜索且有搜索词时留给光标 |
| Enter | 单选：选中并收起；多选：勾选；目录在 `leafOnly` 时是展开收起 |
| Space | 同 Enter；可搜索时是输入一个空格 |
| Esc | 收起，值不变，焦点回触发器；在对话框里只收起面板，不关对话框 |
| Tab | 收起并去下一个控件，不还焦点 |
| 焦点移出组件、点外部 | 收起 |
| 输入法组合中（`isComposing`） | 所有键都不处理 |

禁用的叶子 40% 透明、`aria-disabled`，不能选；禁用的目录键盘仍可到达并展开，只是不能被选。行上与面板上的按下都会 `preventDefault`，触发器不会因点行、点箭头或点滚动条而失焦。悬停是共享的滑动高亮（`list-highlight`），键盘移动时让位给行自身底色。

## 表单与 Field

给了 `name` 才渲染隐藏 `<input type="hidden">`：单选没选时提交空串，多选每个被勾选的叶子一个、没选不提交，`disabled` 时不提交；`form` 对应原生 `form` 属性，组件会把 reset 监听挂到那个表单上，不依赖隐藏输入存在（多选清空后隐藏输入全部卸载）。表单 `reset` 不论受控与否都回到 `defaultValue`（没给则回到空），受控的值收到一次 `onValueChange`。`required` 只写 `aria-required`，必填交给表单项校验。

`Field` 的唯一子元素直接是 `TreeSelect`，它克隆进来的 `id`、`aria-describedby`、`aria-invalid` 落在真正可聚焦的元素上（单选按钮、多选展开钮、搜索输入），标签 `for` 命中它。显式的 `invalid` 优先于 `aria-invalid`。

## 面板与动效

面板是共用的 `lib/picker-panel.tsx`（Radix Popover 的 Anchor + Portal + Content，非模态、不抢焦点），与触发器（多选、可搜索时是整个外壳）同宽，下方 6px、放不下翻到上方；内边距 6、圆角 12、唯一软影；最多 8 行（264px）超出滚动。`container` 改挂到陈列室舞台或带缩放的宿主，`collisionBoundary` 配合使用。

行高 32、圆角 8、缩进每级 18（`padding-inline-start = 4px + 层级 × 18px`）。展开箭头 20px 圆钮、图标 14px，展开时转 90°，140ms；子节点直接出现与消失，不做高度动画。勾选框 16px、圆角 5，底色 140ms 过渡。减弱动态（系统偏好与 `[data-motion="reduce"]` 两个作用域）下箭头不转、勾选框不过渡，面板只做透明度。

## 设计稿取舍

设计稿的演示脚本与规格表不一致处，一律按规格表实现：

- 行补 `id` 与触发器的 `aria-activedescendant`（脚本里没有）；多选补 `aria-checked="mixed"`；打开时把已选行滚到可见；Home / End 保留。
- 懒加载失败重试按规格实现（脚本只演示成功路径）。
- 设计稿里目录右侧的数字是自动算出的叶子数；这里改成调用方给的 `meta`，组件不替调用方决定显示什么。
- 设计稿的搜索输入获得焦点就展开面板；这里点击、输入、↓ 才展开，Tab 进入输入框不会弹出面板。
- 设计稿的单选 Space 无效；这里与 Select 一致，Space 选中（可搜索时是输入空格）。

## 导入

React 从 `@violet/ui` 或 `@violet/ui/tree-select` 导入；按需 CSS 使用 `@violet/ui/components/tree-select.css`，已含输入框外壳、指示器与面板的依赖样式。
