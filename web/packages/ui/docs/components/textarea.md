# Textarea

多行文本控件：外壳与 `Input` 完全一样（四种变体、圆角 8、聚焦与出错的画法），高度由行数决定。标签、提示与错误文案不属于它，归表单项（Field）。

```tsx
import { Textarea } from "@violet/ui";

<Textarea
  aria-label="留言"
  autoSize
  showCount
  maxLength={500}
  placeholder="写点什么…"
/>
```

## 可访问名称与关联

不带可见标签，**单独使用时必须写 `aria-label`**（或由 `<label htmlFor>`、Field 关联）。`id` 缺省由 `useId` 生成；`aria-describedby`、`aria-invalid` 由表单项传入，原样落在 `<textarea>`。`className`、`style`、`ref`、`name`、`form` 与所有原生属性都属于 `<textarea>`；`classNames` 有 `control`（外壳）、`input`、`count`、`bar` 四个槽。

## 变体

`variant`：`filled` 凹陷底（默认）、`outline` 描边、`underline` 下划线、`plain` 无框（用在已有容器边界的行内编辑）。没有尺寸档：字号 14、行高 24 固定，内边距上下 10、左右 12。不显示拖拽柄（`resize: none`），增高不做过渡。

## 四种形态

| 形态 | 用法 |
| --- | --- |
| 自动增高 | `autoSize`，默认 3–8 行（`{ minRows: 3, maxRows: 8 }`），超出在输入区内部滚动，外壳不再变高 |
| 固定行数 | 原生 `rows`，对话框、侧边面板这类高度不能变的地方用 |
| 带字数 | `showCount` + `maxLength`，外壳内右下角显示 `n / max` |
| 带操作栏 | `toolbar` 放图标钮、发送提示等，外壳底部一行高 32，不画分割线 |

自动增高由输入事件直接驱动，不依赖消费方重渲染，受控与非受控都成立；窗口宽度变化时重算。设置了 `autoSize` 后原生 `rows` 被忽略。

## 字数

`showCount` 需要配合 `maxLength`，没有 `maxLength` 时不渲染。视觉字数 `n / max` 用等宽 12 号，达到上限 90% 变危险色（`data-over`）；超出后由原生 `maxLength` 截断，不能再输入。读稿用 `aria-live="polite"`，**只在接近上限（≥ 90%）时开始播报**，之前保持安静。字数只是展示，不替调用方做校验。

`toolbar` 与 `showCount` 同时使用时，字数自动排到操作栏右端，外壳不再另有一份。

## 操作栏

`toolbar` 是外壳底部的一行（高 32），放不可滚动的内容：图标钮、⌘↵ 发送提示、字数。栏内图标钮可用 `.v-textarea__action`（28px 圆形、悬停出浅底），宿主也可以带自己的按钮样式。与文字之间只靠间距分开，不画分割线。

## 状态

| 属性 | 含义 |
| --- | --- |
| `invalid` | 出错外观，并写入 `aria-invalid`；显式值优先于调用方传的 `aria-invalid`。错误文案放在外面的表单项 |
| `disabled` / `readOnly` | 原生语义；只读无底色、一圈细线，聚焦不播动效；禁用整体 50% 透明 |

聚焦色是季节色混 40% 墨色，出错时环、光晕与涟漪整体换危险色——与 Input 同一套状态机，外壳上的 `data-invalid`、`data-disabled`、`data-readonly` 属性约定一致。减弱动态下没有涟漪与过冲，颜色直接切换。

## 键盘

Enter 始终换行；需要「回车发送」的场景（聊天）由调用方在 `onKeyDown` 里处理 ⌘↵（并跳过输入法组词），把提示写进 `toolbar`。组件自身不拦截任何按键。

## 导入

React 从 `@violet/ui` 或 `@violet/ui/textarea` 导入 `Textarea` 及其类型；recipe `textareaVariants` 从 `@violet/ui/variants` 导入。按需 CSS 使用 `@violet/ui/components/textarea.css`，它已包含 Input 外壳的依赖样式，宿主只需先导入 `tokens.css`。
