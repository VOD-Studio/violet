# Select

从固定的几项里选一个或几个：状态、可见性、每页条数。选项很多、要边输入边筛，或者允许输入选项以外的内容，用 combobox（阶段 B），Select 只能选，不能打字。

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@violet/ui";

<Select value={status} onValueChange={setStatus}>
  <SelectTrigger aria-label="状态" className="w-48">
    <SelectValue placeholder="选择状态" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="draft">草稿</SelectItem>
    <SelectItem value="published">已发布</SelectItem>
    <SelectItem value="removed" disabled>已删除</SelectItem>
  </SelectContent>
</Select>
```

## 部件

| 部件 | 作用 |
| --- | --- |
| `Select` | 根：值、开合、表单字段。不渲染 DOM（`name` 时附带隐藏输入） |
| `SelectTrigger` | `role="combobox"` 的按钮，外壳就是输入框外壳 |
| `SelectValue` | 触发器里的值；`placeholder` 用次级色；`children` 自定义已选值的呈现 |
| `SelectContent` | 选项面板；`container`、`className`、`empty`、`loading` |
| `SelectItem` | 选项；`value`、`disabled`、`textValue`、`icon`、`description`、`meta` |
| `SelectGroup` / `SelectLabel` | 分组与组名；不画分割线，组间只靠组名上的 8px 内边距区分 |
| `SelectSeparator` | 只占一个很小的间隔，不画线 |

不再基于 Radix Select。`SelectScrollUpButton`、`SelectScrollDownButton`、`position`、`align`、`size="sm" | "default"` 随之删除：面板固定在触发器下方、与触发器同宽，超出 264px 原生滚动；触发器尺寸改用 `controlSize`。

## 值

单选的值是 `string`，空串表示没有选择；多选传 `multiple`，值是 `string[]`，类型随之收窄（`multiple` 时给字符串是类型错误）。受控用 `value` + `onValueChange`，非受控用 `defaultValue`。`open`、`defaultOpen`、`onOpenChange` 同理。

已选项的文字在面板关闭时也要显示。面板关闭时，`SelectContent` 的子节点渲染进游离的 `DocumentFragment`（不进入文档与无障碍树），选项挂载时登记 `{ value, label, disabled }`；打开后同一批子节点在面板里渲染。选项的文字标签取 `textValue`，缺省取选项文字节点的文本（不含说明与附加信息）。服务端渲染与水合前选项还没挂载，此时从复合子树静态读选项文字（`SelectContent` 下直接的 `SelectItem`、`SelectGroup` 里的 `SelectItem`、数组与 Fragment 都透传；`textValue` 优先，缺省拼接选项文字里的文本子节点），所以已选值、多选芯片与已选摘要在 SSR HTML 里就有，水合后由实时登记接管，两边取文字的方式一致，不会闪空。边界：选项被包在自定义组件里渲染（如 `SelectContent` 里放一个自己渲染选项的组件）时静态遍历取不到它的 children，SSR 首帧仍为空，挂载后照常显示；这类场景给 `SelectItem` 显式写 `textValue` 也无法覆盖，需要把选项直接写在 `SelectContent` 下。

## 触发器

`SelectTrigger` 透传 `id`、`aria-label`、`aria-labelledby`、`aria-describedby`、`aria-invalid` 与其它按钮属性。`Field` 的唯一子元素是 `Select` 根时，它克隆到根上的 `id`、`aria-describedby`、`aria-invalid`（以及 `aria-labelledby`）经 context 落到真正可聚焦的触发器（多选是展开钮）：标签 `for` 命中触发器，`aria-describedby` 指向提示或错误；触发器自己显式给的同名属性优先，`aria-describedby` 取并集，显式的 `invalid` 优先于传入的 `aria-invalid`。`variant`（`filled` / `outline` / `underline` / `plain`）、`controlSize`（`sm` / `md` / `lg`，默认 `md`）、`invalid`、`valid`、`loading` 与 Input 一致：外壳样式、聚焦环、出错与通过的颜色、只读与禁用的画法共用 `input` 单元的同一份 CSS（`v-input-control`），`inputVariants` 也在 `@violet/ui/variants`。

- 尾部是 16px 的 `ChevronsUpDown`，次级文字色，`aria-hidden`；`loading` 时换成 16px 指示器并设 `aria-busy`；`readOnly`（写在 `Select` 上）时没有箭头，可聚焦、不可展开。
- 占位文字、已选值太长时单行省略；面板里的选项最多换成两行。
- `onPointerDown` 等事件属性落在按钮上，Sheet 内防拖拽误关的 `stopPropagation` 仍然有效。

### 多选触发器

多选时外壳是 `div`，里面依次是：芯片、展开钮（真正的 `role="combobox"` 按钮，`id` 与 `aria-*` 落在它上面）、「清除全部」（`aria-label="清除全部"`，有选中且可编辑时才有）、箭头。Tab 顺序是展开钮 → 清除全部；清除后按钮卸载，焦点回到展开钮。外壳 `height: auto`、`min-height` 为尺寸档高度、可换行。芯片高 24、圆角 6，移除钮 18×18、`tabindex="-1"`、`aria-label="移除 {标签}"`。已选超过 `maxChips`（默认 2）折成「+N」。移除钮不进 Tab 顺序（设计稿没有退格删除的键盘路径，清除全部可 Tab 到达）。展开钮的可访问名称取 `aria-label`、`aria-labelledby` 或表单项的标签；都没有时（没有 `id`）用 `SelectValue` 里的占位文案兜底；有值时占位只留给读屏（视觉隐藏），已选内容以「已选 X、Y 等 N 项」的视觉隐藏摘要经 `aria-describedby` 关联到展开钮。选项行前置 16px 勾选框，选择后面板不收起。

## 键盘与读屏

焦点始终在触发器上，高亮项由 `aria-activedescendant` 指出；面板是 `role="listbox"`，选项是 `role="option"`，多选加 `aria-multiselectable`。`aria-selected` 表示实际选中；高亮另有 `data-active`，只在键盘操作时才给行画自身的 `--muted` 底色（`data-kb`），鼠标悬停用共享的滑动高亮。

| 操作 | 结果 |
| --- | --- |
| 触发器上 Enter、Space、↓、↑ | 展开，高亮已选项（没有则第一个可用项） |
| ↑ ↓ | 移动高亮，跳过禁用项，**不循环** |
| Home / End、PageUp / PageDown | 到首尾；一次移动 8 项 |
| 字符键 | 前缀预测输入，500ms 内连打组成前缀；汉字标签同时按拼音声母匹配 |
| Enter、Space | 选中高亮项：单选选完收起并还焦点，多选不收起；Space 优先于前缀预测输入，键入前缀后仍是确认 |
| Esc | 收起，值不变，焦点回触发器；在对话框里只收起面板，不关对话框 |
| Tab | 收起并去下一个控件，不还焦点 |
| 焦点移出组件、点外部 | 收起 |
| 面板展开时点触发器 | 收起 |

选项的 `onMouseDown` 与面板上的所有按下都会 `preventDefault`，触发器不会因点选项或点滚动条而失焦。禁用项 40% 透明、`aria-disabled`，不能选，键盘高亮跳过。

## 表单

给了 `name` 才渲染隐藏 `<input type="hidden">`，参与 `FormData`：单选没选时提交空串，多选每个值一个，`disabled` 时不提交。`form` 对应原生 `form` 属性。表单 `reset` 时回到 `defaultValue`（没给则回到空；单选 `""`、多选 `[]`），不论受控与否都经 `onValueChange` 通知。监听的表单取 `form` 对应 id 的表单，没有则取触发器的祖先 `form`，与隐藏输入是否存在无关（多选清空后同样生效）。`required` 只写 `aria-required`，隐藏输入不参与原生必填校验，必填交给表单项校验。

## 面板

面板是共用的 `lib/picker-panel.tsx`：Radix Popover 的 `Anchor + Portal + Content`，非模态、不抢焦点，挂到 `document.body`，用 `container` 指定局部作用域或带缩放的宿主容器。下方起点对齐、距触发器 6px，放不下翻到上方，浮出方向随之反转；最小宽 160px；触发器滚出视野时收起。没有选项显示「无选项」（`empty` 覆盖）；`loading` 且没有选项时显示指示器与「加载中…」。

动效沿用共享的浮出 `v-float`：**进入 200ms**、退出 140ms，位移 6px 与 4px，不缩放、不裁剪，减弱动态只做 100ms 透明度。收起时交互面板立即退出 Radix 浮层栈，只在原容器保留一份不可聚焦、不可点击且不参与无障碍树的退场画面；动画结束后画面卸下。这样在对话框内选完后立刻按 Esc 会关闭对话框，不会被退场面板截走。站点 Dropdown 的浮出（`use-dropdown-motion`）是 220ms，两者相差 20ms，各自沿用自己单元的既有常量，没有统一。

## 选择器族共用的地基

combobox、tag-input、cascader、tree-select 复用同一套部件，不要各自再写一份：

- `lib/use-listbox.ts`：无 DOM 假设的键盘与激活引擎。输入有序项 `{ id, disabled?, textValue? }[]` 与 `open`，输出 `activeIndex`、`activeId`、`mode`、`handleKeyDown`、`getItemProps`、`registerItem`、`scrollActiveIntoView`。`selectedFor: "active"` 让 `aria-selected` 表示高亮项（组合框）；`typeahead` 在输入框形态要保持关闭。
- `lib/picker-panel.tsx`：`PickerPanel`（浮层外壳）、`PickerList`、`PickerOption`、`PickerGroup`、`PickerLabel`、`PickerEmpty`、`highlightMatch`；样式在 `lib/picker.css`，各单元的 CSS 用 `@import "../../lib/picker.css"` 引入同一份。

选项行：最小高 36（两行 48）、圆角 8、内边距 6/10、间距 12；选中是**墨色、字重 600、透明底**，不叠季节色淡底，季节色只属于聚焦环；图标块 32×32、圆角 8、`--muted` 底；右侧 `meta` 12px 次级文字；匹配高亮 `<mark>` 用 `--decoration` 30% 底、圆角 2。面板内边距 6、圆角 12、`1px var(--ol)` 描边、唯一软影 `--shadow-soft`。

## 导入

React 从 `@violet/ui` 或 `@violet/ui/select` 导入；按需 CSS 使用 `@violet/ui/components/select.css`，已含输入框外壳、指示器与面板的依赖样式。
