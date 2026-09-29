## 职责顺序

先通过组件的 `variant`/`size` 选择语义，再用 `className` 调整布局；主题级色值放在 CSS 变量。不要为单个按钮覆写变体色，让同一动作在不同方言下失去含义。

```tsx
import { Button } from "@violet/ui";

<Button variant="primary" size="sm" className="w-full">保存</Button>
```

Tailwind v4 间距以 4px 为单位，例如 88px 用 `w-22`。功能性圆角最大 `rounded-2xl`；浮起只用轻软影或边界描边。具体数值见[布局规格](/design-system/layout)。

## className 与 style

组件接受标准 `className` 与 `style` 属性：`className` 与变体类合并后落到根元素，`style` 透传为内联样式。布局与间距用 `className`，动态计算的数值（如跟随内容的宽度）用 `style`：

```tsx
<Button variant="primary" className="gap-3" style={{ minWidth: 120 }}>
	保存
</Button>
```

## 基于状态的样式

每个组件根元素挂 `data-slot` 与 `data-variant` 属性，宿主 CSS 可用属性选择器按状态定制：

```css
/* 应用全局 CSS */
[data-slot="button"][data-variant="primary"] {
	box-shadow: none;
}
```

优先用 `className` 组合（variants 已处理优先级），属性选择器留给无法通过组合表达的覆盖。

## 条件样式

组件不接受函数形式的 `className`（接收 props 返回类名的渲染属性）；按状态换类在调用点用条件表达式完成：

```tsx
<Button variant={isDanger ? "destructive" : "default"} className={pending ? "opacity-60" : undefined}>
	提交
</Button>
```

## 滚动条工具类

包提供主题化滚动条工具类（标准 `scrollbar-width` / `scrollbar-color` 属性，不依赖 `::-webkit-scrollbar`）：

| 工具类 | 属性模式 | 效果 |
| --- | --- | --- |
| `scrollbar-thin` | `data-scrollbar="thin"` | 纤细主题滑块（默认形态） |
| `scrollbar-default` | `data-scrollbar="default"` | 原生滚动条 |
| `scrollbar-none` | `data-scrollbar="none"` | 隐藏滚动条（内容仍可滚动） |

属性模式可声明在元素自身或任意祖先上。滑块颜色与宽度变量（`--scrollbar-*`）的定制见[主题](/design-system/guides/theming)的「滚动条」一节。

## BEM 类名

不用 Tailwind 的宿主可以导入 `@violet/ui/classes.css`，获得核心组件的预编译类。命名遵循 BEM：块 `v-<name>`、元素 `v-<name>__<element>`、修饰符 `v-<name>--<modifier>`（如 `.v-button`、`.v-button--primary`、`.v-tabs__list`）。颜色与圆角全部取自语义 token，必须先导入 `tokens.css` 或 `styles.css`：

```css
@import "@violet/ui/tokens.css";
@import "@violet/ui/classes.css";
```

```html
<button type="button" class="v-button v-button--primary">保存</button>
```

React 组件与 BEM 类是两套并行入口：React 项目用组件与 variants，纯 HTML 或其他框架用 `classes.css`。

## 创建包装组件

应用级按钮常是固定变体加尺寸的组合。从包根导出的 variants recipes（`buttonVariants`、`badgeVariants`、`checkboxVariants`、`tabsListVariants`）是 tailwind-variants 实例，用 `extend` 派生，不复制基类：

```tsx
import { buttonVariants } from "@violet/ui";
import { cn } from "cn";
import type { ComponentProps } from "react";

const ctaButton = buttonVariants.extend({
	base: "tracking-wide",
	variants: {
		size: {
			cta: "h-12 px-8 text-base",
		},
	},
	defaultVariants: {
		variant: "primary",
		size: "cta",
	},
});

export function CallToAction({ className, ...props }: ComponentProps<"button">) {
	return <button type="button" className={cn(ctaButton(), className)} {...props} />;
}
```

`extend` 保留原有变体并叠加新值，上游调整基类样式时包装组件自动跟随。

## 与 CSS-in-JS 一起用

组件接受并转发 `className`，styled-components 可以直接包裹：

```tsx
import styled from "styled-components";
import { Button } from "@violet/ui";

const PromoButton = styled(Button)`
	width: 100%;
	margin-top: 1rem;
`;
```

emotion 用 `css` 属性同理（`className` 经 jsx 运行时传入组件）：

```tsx
/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import { Button } from "@violet/ui";

<Button css={css`width: 100%;`}>保存</Button>
```

样式优先级建议保持「变体 → 工具类 → CSS-in-JS」的层次，CSS-in-JS 只写局部布局微调，主题色仍走 CSS 变量。

## 相关资源

- [主题](/design-system/guides/theming)：token 层次与组件样式覆盖
- [布局规格](/design-system/layout)：间距与圆角数值
- [组合模式](/design-system/guides/composition)：asChild 与复合部件
