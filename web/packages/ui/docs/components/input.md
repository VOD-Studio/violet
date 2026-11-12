# Input 与 SearchInput

`input` 单元包含两个组件：`Input` 是原生输入的外壳，`SearchInput` 是组合它的防抖搜索框。两者共用同一份样式，没有独立的搜索单元。

## Input

输入框只管外壳与输入区：高度、圆角、底色、聚焦与出错的画法，加上前置、后置与三种圆钮。**标签、提示、错误文案、字数都不属于它**，归表单项。

```tsx
import { Input } from "@violet/ui";

<Input
  aria-label="邮箱"
  type="email"
  inputMode="email"
  autoComplete="email"
  placeholder="name@example.com"
  leading={<Mail aria-hidden="true" />}
  clearable
/>
```

### 可访问名称与关联

输入框不带可见标签，**单独使用时必须写 `aria-label`**（或由 `<label htmlFor>`、`aria-labelledby` 关联）。`id` 缺省由 `useId` 生成；`aria-describedby`、`aria-invalid` 由表单项传入，原样落在 `<input>`。`className`、`style`、`ref`、`name`、`form` 与所有原生属性都属于 `<input>`；`classNames` 只有 `control`（外壳）、`input`、`leading`、`trailing`、`action` 五个槽。

触屏键盘由调用方写全：邮箱用 `inputMode="email"` 与 `autoComplete="email"`，用户名用 `autoComplete="username"`，一次性验证码用 `inputMode="numeric"` 与 `autoComplete="one-time-code"`。触屏（`pointer: coarse`）下字号一律 16px，不触发 iOS 聚焦放大。

### 变体与尺寸

`variant`：`filled` 凹陷底（默认）、`outline` 描边、`underline` 下划线（只有上两角圆角）、`plain` 无框（行内编辑用）。`controlSize`：`sm` 32、`md` 36（默认）、`lg` 40px，触屏各加 4px；圆角固定 8px，不随高度变化。原生 `size` 仍是字符宽度。

### 状态

| 属性 | 含义 |
| --- | --- |
| `invalid` | 出错外观，并写入 `aria-invalid`；显式值优先于调用方传的 `aria-invalid`。状态位显示 16px 警示图标 |
| `valid` | 通过外观（成功色），只是视觉反馈，不写 ARIA；`invalid` 优先 |
| `loading` | 状态位显示细圆弧，并设 `aria-busy="true"`；优先级 loading > invalid > valid |
| `disabled` / `readOnly` | 原生语义；只读聚焦不播动效，只读可复制 |

聚焦色是季节色混 40% 墨色，出错与通过只替换这一种颜色，环、光晕与涟漪一起跟随。进入聚焦有 240ms 弹性收紧与一次涟漪，退出 120ms 收回；减弱动态下没有涟漪与过冲，颜色直接切换。

### 槽与顺序

从左到右：`leading`、输入区、清除钮、状态图标、`trailing`、操作钮（显隐、复制），间距 8px。`leading` 与 `trailing` 只放不可点内容：图标（前置按尺寸自动 16 / 20px）、一小段文字（`https://`、`@`、`px`）或键帽。清除、显隐、复制钮固定 24px，不随 `lg` 放大。

普通图标槽默认线宽 1.75；`leading` 的默认图标随 `controlSize` 取 16 / 16 / 20，其余普通槽取 16。传 `<Icon {...iconProps(12)} />` 等显式六档时，槽保留图标本身的尺寸与线宽；附加类名放在 `iconProps` 第二参数，不能覆盖返回的 `v-icon` 标记。清除图标使用显式 14 档、线宽 2；状态位的加载圆弧由 indicator 负责，不受普通图标槽重置。

### 清除

`clearable` 提供清除钮，名称默认「清除」（`clearLabel`）。仅在有内容且非禁用、非只读时存在于 DOM，视觉上只在悬停或焦点在控件内时出现，所以 Tab 可达。点击清空、回焦输入区，并派发一次原生 `input` 事件，受控与非受控都成立；`onClear` 在其后触发。输入区按 Esc 同样清空并 `preventDefault`，已空时不拦截。

### 显隐密码

`passwordToggle` 仅在 `type="password"` 时生效。按钮 `aria-label` 固定为「显示密码」（`passwordToggleLabel` 可覆盖），用 `aria-pressed` 表示是否正在显示；切换前后光标位置与焦点保持。

### 只读复制

`copyable` 提供复制钮（`copyLabel`，默认「复制」），写入剪贴板后图标换成成功色对勾 1500ms；`onCopied(value)` 在写入成功后触发，剪贴板不可用时静默失败。通常配合 `readOnly`，输入区改用等宽 13px。

## SearchInput

在 Input 上加搜索图标、清除钮与防抖，`type="search"`、`inputMode="search"`。

```tsx
import { SearchInput } from "@violet/ui";

<SearchInput
  aria-label="搜索文章"
  controlSize="sm"
  shortcut={["mod", "K"]}
  onSearch={setKeyword}
/>
```

传入 `value` 后由调用方通过 `onValueChange` 回写；不传时使用 `defaultValue`。`onValueChange` 每次编辑立即执行，`onSearch` 默认在 300ms 静默期后执行，初次挂载不搜索，`delay` 调整静默期。回车立即搜索当前文本并取消同一文本的尾随调用；调用方的 `onKeyDown` 先执行，`preventDefault()` 可取消回车搜索，已排队的尾随查询照常执行。输入法组词（`isComposing` 或 keyCode 229）时回车保留输入法确认行为。

清除钮名称默认「清除搜索」。激活后取消挂起查询，依次执行 `onValueChange("")`、`onSearch("")`、`onClear()`，焦点回到输入区；受控时只发出变更意图，值由调用方回写。`shortcut`（`KbdKey[]`）在输入区为空时于后置槽显示键帽，默认不显示。`loading` 与 Input 一致。

这个组件的文本由 React 状态管理，尚未提供非受控原生表单 reset 契约；需要依赖浏览器 reset 的字段使用带 `type="search"` 的 Input。

## 导入

React 从 `@violet/ui` 或 `@violet/ui/input` 导入 `Input`、`SearchInput` 及其类型；recipe `inputVariants` 从 `@violet/ui/variants` 导入。按需 CSS 使用 `@violet/ui/components/input.css`，已含键帽与加载指示器的依赖样式。

外壳对派生控件开放：`select` 的触发器直接使用 `v-input-control` 家族类名与同一套 `data-invalid`、`data-valid`、`data-disabled`、`data-readonly` 属性约定（`inputVariants` 生成类名），聚焦用外壳自身的 `:focus-within`，不另起一份外壳样式。
