## 让语义、布局与主题各归其位

先通过 `variant` / `size` 选择组件语义，再用工具类调整布局；主题级色值通过 CSS 变量改变。保留焦点、错误与禁用提示。

```tsx
import { Button } from "@violet/ui";

<Button variant="primary" size="sm" className="w-full">保存</Button>
```

Tailwind v4 的 4px 倍数间距使用数字类，例如 88px 写 `w-22`。功能圆角最大 `rounded-2xl`，浮起只使用规范中的轻软影；具体刻度见[布局规格](/design-system/layout)。

## React 与 HTML 使用同一份 CSS

基础单元的 `styles.ts` 只把参数映射为 BEM 类，视觉定义在组件 CSS。命名为块 `v-<name>`、元素 `v-<name>__<part>` 和修饰符 `v-<name>--<variant>`。

```css
/* Tailwind 宿主 */
@import "tailwindcss";
@import "@violet/ui/styles.css";
```

```css
/* 只取一个组件的 CSS，不需要 Tailwind 扫描组件源码 */
@import "@violet/ui/tokens.css";
@import "@violet/ui/components/button.css";
```

```html
<button type="button" class="v-button v-button--primary">保存</button>
```

`classes.css` 汇集组件 CSS，叶子入口从相同源文件构建。完整入口会加载完整规则，不会因为只渲染 Button 就自动裁掉其他 CSS。legacy 单元的 React recipe 与兼容 BEM 尚未逐个统一，成熟度见[重建进度](/design-system/guides/roadmap)。

## className 落在哪个部件

Button、Input、Label、Textarea 的 `className` 与 `style` 落在其 DOM 元素上。TextField 是组合字段，这两个属性落在 input；外壳、label 与说明通过类型化 `classNames` 指定：

```tsx
import { TextField } from "@violet/ui";

<TextField
  label="邮箱"
  type="email"
  className="text-base"
  classNames={{ root: "w-full max-w-sm", description: "text-xs" }}
  description="用于接收回复通知"
/>
```

组件 CSS 位于 components layer，Tailwind utilities 可以覆盖布局或局部外观。改变整套配色应覆盖语义变量，避免在每个调用点重复设置颜色。

## 用真实状态定制

新 Button 暴露 `data-slot="button"`、`data-variant`、`data-size`、`data-loading` 与 `aria-busy`。Input 的错误状态使用 `aria-invalid`。legacy 的 Radix 控件仍使用实际提供的 `data-state`，不能假定所有组件拥有同一套属性。

```css
[data-slot="button"][data-loading="true"] {
  cursor: progress;
}
```

原生 `:disabled`、`:focus-visible` 和 ARIA 选择器提供状态反馈。普通样式覆盖不能改变事件、ref、表单和键盘契约。组件的 `className` 接收字符串；调用方需要条件样式时使用表达式。

## 包装组件保留行为

应用可以固定变体与尺寸，把其余公开属性透传给原组件：

```tsx
import { Button } from "@violet/ui";
import type { ComponentProps } from "react";

export function SaveButton(props: ComponentProps<typeof Button>) {
  return <Button variant="primary" size="sm" {...props} />;
}
```

公开 recipes 从 `@violet/ui/variants` 读取，适合只计算类名的场景。新增通用变体时修改组件单元的 recipe 与 CSS，按[组件设计方法](/design-system/guides/component-design)补验证。

## 滚动条工具类

包提供标准 `scrollbar-width` / `scrollbar-color` 规则：

| 工具类 | 属性模式 | 效果 |
| --- | --- | --- |
| `scrollbar-thin` | `data-scrollbar="thin"` | 纤细主题滑块 |
| `scrollbar-default` | `data-scrollbar="default"` | 原生滚动条 |
| `scrollbar-none` | `data-scrollbar="none"` | 隐藏滚动条，内容仍可滚动 |

属性可写在元素或祖先。变量说明见[主题](/design-system/guides/theming)，组合语义见[组合](/design-system/guides/composition)。
