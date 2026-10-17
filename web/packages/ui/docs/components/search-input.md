# SearchInput

SearchInput 是独立的 `search-input` 单元，组合 Input，不是 Input 的视觉变体。它管理搜索文本与防抖时序；查询请求、结果和加载状态由调用方管理。只需要搜索图标或即时本地筛选时，使用 `Input type="search"`，不额外引入搜索调度。

```tsx
import { SearchInput } from "@violet/ui";

<SearchInput
  aria-label="搜索文章"
  name="query"
  variant="soft"
  controlSize="sm"
  defaultValue=""
  onSearch={setKeyword}
/>
```

传入 `value` 后由调用方通过 `onValueChange` 回写；不传时使用 `defaultValue` 初始化组件状态。`onValueChange` 每次编辑立即执行，`onSearch` 默认在 300ms 静默期后执行，初次挂载不搜索。`delay` 调整静默期。

回车立即搜索 input 中的当前文本，并取消同一文本的尾随调用。调用方的 `onKeyDown` 先执行，`preventDefault()` 可取消这次回车搜索，已排队的尾随查询仍按原定时序执行。输入法正在组词或 keyCode 为 229 时，回车保留输入法确认行为。没有 `onSearch` 时，组件保留回车默认行为。

清除按钮进入键盘焦点顺序。激活后取消挂起查询，依次执行 `onValueChange("")`、`onSearch("")`、`onClear()`，并将焦点交回 input。`disabled` 或 `readOnly` 时不能清除；`loading` 时显示加载图标并隐藏清除按钮。

`ref`、`className`、`style`、原生键盘与焦点事件、`name`、`form` 等属性作用于真实 `input type="search"`；外层布局使用 `classNames.root`，视觉外壳使用 `classNames.control`，清除按钮使用 `classNames.action`。文本编辑通过 `onValueChange` 接收值。object ref 与 callback ref 均可使用，callback 返回的清理函数在卸载或 ref 更换时执行。

`variant` 与 `controlSize` 直接沿用 Input：outline / soft / ghost / underline，以及 sm / md / lg（32 / 40 / 48px）。默认 outline / md；原生 `size` 仍是数字字符宽度。工具栏通常选 soft，已有边界的容器内可选 ghost，不维护搜索专属高度或另一套输入框样式。

React 从 `@violet/ui` 或 `@violet/ui/search-input` 导入。按需 CSS 使用 `@violet/ui/components/search-input.css`，该入口包含 Input 的样式依赖；基础 Input 的 CSS 不反向包含搜索样式。

这个组件的文本由 React 状态管理，尚未提供非受控原生表单 reset 契约。需要依赖浏览器 reset 的字段应使用 Input；搜索表单可以由调用方在 `onReset` 回写受控值。
