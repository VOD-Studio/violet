# SearchInput

SearchInput 管理搜索文本与防抖时序；查询请求、结果和加载状态由调用方管理。它目前仍是 `legacy` 单元，视觉样式尚未迁入纯 CSS 组件契约。

```tsx
import { SearchInput } from "@violet/ui";

<SearchInput
  aria-label="搜索文章"
  name="query"
  defaultValue=""
  onSearch={setKeyword}
/>
```

传入 `value` 后由调用方通过 `onValueChange` 回写；不传时使用 `defaultValue` 初始化组件状态。`onValueChange` 每次编辑立即执行，`onSearch` 默认在 300ms 静默期后执行，初次挂载不搜索。`delay` 调整静默期。

回车立即搜索 input 中的当前文本，并取消同一文本的尾随调用。调用方的 `onKeyDown` 先执行，`preventDefault()` 可取消这次回车搜索，已排队的尾随查询仍按原定时序执行。输入法正在组词或 keyCode 为 229 时，回车保留输入法确认行为。没有 `onSearch` 时，组件保留回车默认行为。

清除按钮进入键盘焦点顺序。激活后取消挂起查询，依次执行 `onValueChange("")`、`onSearch("")`、`onClear()`，并将焦点交回 input。`disabled` 或 `readOnly` 时不能清除；`loading` 时显示加载图标并隐藏清除按钮。

`ref`、原生键盘与焦点事件、`style`、`name`、`form` 等属性作用于真实 input；文本编辑通过 `onValueChange` 接收值。object ref 与 callback ref 均可使用，callback 返回的清理函数在卸载或 ref 更换时执行。`className` 作用于外壳。尺寸 `default` 为 36px，`sm` 为 32px。

这个组件的文本由 React 状态管理，尚未提供非受控原生表单 reset 契约。需要依赖浏览器 reset 的字段应使用 Input 或 TextField；搜索表单可以由调用方在 `onReset` 回写受控值。
