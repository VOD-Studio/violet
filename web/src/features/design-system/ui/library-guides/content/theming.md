## 主题如何工作

`@violet/ui` 的主题由三层 CSS 变量构成：

1. **主色源预设**（`palettes/*.css`）：提供六个 `--primary-base*` 变量——实色、前景、悬停、柔和底、柔和前景、焦点环。
2. **语义值**（`tokens.css`）：`--background`、`--primary`、`--success` 等描述用途的变量，画布、状态色都在这层。
3. **Tailwind 映射**（`theme.css` 的 `@theme inline`）：把上述变量绑定成 `bg-primary`、`text-foreground` 等工具类。

`@theme inline` 让工具类在使用点读取变量，所以运行时在任何作用域覆盖变量都生效。命名规则与语义色板一致：不带后缀的颜色用作背景（`--accent`），带 `-foreground` 后缀的是其上的文字（`--accent-foreground`）。角色速查见[颜色](/design-system/palette)。

## 快速开始

在应用全局 CSS 中先导入 Tailwind，再导入包样式：

```css
@import "tailwindcss";
@import "@violet/ui/styles.css";
```

给 `html` 挂主题类，`body` 应用画布色：

```html
<html class="light">
	<body class="bg-background text-foreground"><!-- 应用 --></body>
</html>
```

### 切换浅色与深色

包中的 `:root` 声明 `color-scheme: light`，`.dark` 声明 `color-scheme: dark`；语义值用 `light-dark(浅色, 深色)` 写在一条声明里。给 `html` 加或移除 `dark` 类即可切换，JS 切换与偏好持久化由宿主实现。

宿主使用 `next-themes` 时（`pnpm add next-themes`），在根部放 Provider 并关闭其内联 `color-scheme` 注入，让包内的 `.dark` 规则驱动取值：

```tsx
import { ThemeProvider, useTheme } from "next-themes";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
	return (
		<ThemeProvider attribute="class" defaultTheme="system" enableColorScheme={false}>
			{children}
		</ThemeProvider>
	);
}

export function ThemeSwitch() {
	const { setTheme } = useTheme();
	return (
		<div>
			<button type="button" onClick={() => setTheme("light")}>浅色</button>
			<button type="button" onClick={() => setTheme("dark")}>深色</button>
			<button type="button" onClick={() => setTheme("system")}>跟随系统</button>
		</div>
	);
}
```

SSR 宿主须在首屏 `html` 上输出与持久化偏好一致的主题类；不要内联设置 `color-scheme`（会盖过类选择器），仅加 `suppressHydrationWarning` 也消不掉首屏闪色。本站的 cookie 同步方案见[深色模式](/design-system/guides/dark-mode)。

普通 React 应用（Vite 等）可以不用 next-themes，直接用包级 `useTheme`：三态选择、localStorage 持久化、把 `dark` 类挂到 `html` 都是内置行为。用法见[深色模式](/design-system/guides/dark-mode)。

### 覆盖颜色

在包样式之后覆盖同名变量即可，明暗值既可以合写在 `light-dark()` 里，也可以按选择器拆开（两种写法等效）：

```css
@import "tailwindcss";
@import "@violet/ui/styles.css";

:root {
	--success: oklch(0.48 0.12 155);
	--success-foreground: oklch(0.99 0 0);
}

.dark {
	--success: oklch(0.76 0.12 155);
	--success-foreground: oklch(0.15 0.03 158);
}
```

包已注册 `--color-success` 等 Tailwind 映射，覆盖变量后 `bg-success` 自动跟随，无需重复注册。

## 导入策略

样式入口按粒度分四个：

```css
/* 完整（推荐）：变量 + Tailwind 映射 + 滚动条 + @source 扫描 */
@import "@violet/ui/styles.css";

/* Headless：只要 CSS 变量，不进 Tailwind 映射（无 @theme/@source），
   适合不用 Tailwind 的宿主直接 var(--primary) 消费 */
@import "@violet/ui/tokens.css";

/* 主色源子导出：换主题色时替换默认色板 */
@import "@violet/ui/palettes/violet.css"; /* 默认，styles.css 已含 */
@import "@violet/ui/palettes/coral.css";  /* 暖珊瑚，按需替换 */
```

JS 侧是 ESM tree-shaking：`import { Button } from "@violet/ui"` 只打包用到的组件，无需按组件导样式。

## 命名主题

主题色板支持 `[data-theme]` 命名作用域：包内色板同时命中 `:root` 与 `[data-theme="..."]`，在宿主容器上挂属性即可局部换色板，`dark` 类继续独立控制明暗，两轴正交：

```html
<html lang="zh-CN" class="light">
	<body>默认 violet</body>
	<section data-theme="coral">这片是暖珊瑚</section>
</html>
```
两种导入位置对应两种效果：

- **整站替换**：在包样式之后导入 coral——同特异性后者胜，`:root` 整体切换：

```css
@import "tailwindcss";
@import "@violet/ui/styles.css";
@import "@violet/ui/palettes/coral.css";
```

- **只换子树**：在包样式**之前**导入 coral，`:root` 保持 violet，只有挂属性的子树切换：

```css
@import "tailwindcss";
@import "@violet/ui/palettes/coral.css";
@import "@violet/ui/styles.css";
```

要创建自有命名主题，复制一份色板文件，把选择器改成你的名字（如 `[data-theme="ocean"]`），六个 `--primary-base*` 成对改值。主色推导效果可在[颜色](/design-system/palette)页预览，再手动写入色板文件。

## 自定义组件样式

组件样式没有独立 CSS 文件，定制走两条稳定 API：

**1. `data-slot` / `data-variant` 属性**——每个组件根元素都挂语义化 data 属性，宿主 CSS 可精确覆盖：

```css
/* 应用全局 CSS */
[data-slot="button"][data-variant="primary"] {
	box-shadow: none;
}
```

**2. variants recipes 导出**——带变体的组件从包根导出 tailwind-variants 函数（`buttonVariants`、`checkboxVariants`、`tabsListVariants`、`badgeVariants`），供宿主组合自己的类：

```tsx
import { buttonVariants } from "@violet/ui";
import { cn } from "cn";

<button className={cn(buttonVariants({ variant: "soft", size: "lg" }), "rounded-full")}>
	胶囊化的柔和按钮
</button>
```

优先用 `className` 组合（variants 已处理优先级），data 属性选择器留给无法通过组合表达的覆盖。

## 替换主色源与已有语义值

换主色源六项要一起调整：实色与文字、悬停、浅染与文字、焦点环。每项提供浅色和深色值，并检查文字对比度（WCAG AA）：

```css
:root,
[data-theme="coral"] {
	--primary-base: light-dark(oklch(0.625 0.19 25), oklch(0.72 0.15 22));
	--primary-base-foreground: light-dark(oklch(0.99 0 0), oklch(0.17 0 0));
	--primary-base-hover: light-dark(oklch(0.575 0.185 25), oklch(0.67 0.155 22));
	--primary-base-soft: light-dark(oklch(0.95 0.025 25), oklch(0.25 0.025 22));
	--primary-base-soft-foreground: light-dark(oklch(0.36 0.11 25), oklch(0.88 0.065 22));
	--primary-base-ring: light-dark(oklch(0.625 0.19 25), oklch(0.72 0.15 22));
}
```

主色源不等于主要动作：包的 `--primary` 默认是高对比中性色，`Button variant="default"` 用它；`variant="primary"` 用 `--primary-base`，`variant="soft"` 用 `--primary-base-soft`。换主色源不会改动 `--success`、`--destructive` 等行为状态色。

## 添加自定义颜色

新角色要在宿主 CSS 定义背景与前景变量，并用 `@theme inline` 注册 Tailwind 映射：

```css
:root {
	--notice: light-dark(oklch(0.52 0.15 240), oklch(0.72 0.12 240));
	--notice-foreground: light-dark(oklch(0.99 0 0), oklch(0.15 0.02 240));
}

@theme inline {
	--color-notice: var(--notice);
	--color-notice-foreground: var(--notice-foreground);
}
```

```tsx
<div className="bg-notice text-notice-foreground">通知内容</div>
```

已有角色只覆盖变量，不要重复声明包内的 `--color-*` 映射。

## 变量参考

完整 token 名称与实时值见 [Token 词典](/design-system/tokens)。滚动条相关变量：

| 变量 | 作用 | 默认 |
| --- | --- | --- |
| `--scrollbar-thumb` | 滑块颜色 | `color-mix(in oklab, var(--foreground) 15%, transparent)` |
| `--scrollbar-track` | 轨道颜色 | `transparent` |
| `--scrollbar-width` | 滑块宽度 | `thin` |
| `--scrollbar-gutter` | 间隙 | `auto` |

## 滚动条

包提供主题化滚动条工具类（标准 `scrollbar-width` / `scrollbar-color` 属性，不依赖 `::-webkit-scrollbar`）：

```html
<!-- 纤细主题滑块（默认形态） -->
<div class="scrollbar-thin">…</div>

<!-- 原生滚动条 -->
<div class="scrollbar-default">…</div>

<!-- 隐藏 -->
<div class="scrollbar-none">…</div>
```

也可以用属性模式，在元素或祖先上声明：

```html
<div data-scrollbar="thin">纤细</div>
<div data-scrollbar="default">原生</div>
<div data-scrollbar="none">隐藏</div>
```

按滚动槽定制时覆盖对应 token 即可：

```css
.my-scroll-area {
	--scrollbar-thumb: color-mix(in oklab, var(--primary-base) 30%, transparent);
}
```

## 只为局部区域换色

把色板文件的 `:root` 换成局部选择器，并在同一作用域重映射语义别名——上层方言（如本站 `.dialect-public`）求值过的 `--primary` 不会因后代覆盖 `--primary-base` 自动重算，必须成对重声明：

```css
.campaign-theme {
	--primary-base: light-dark(oklch(0.625 0.19 25), oklch(0.72 0.15 22));
	/* …其余五个 --primary-base*… */

	--primary: var(--primary-base);
	--primary-foreground: var(--primary-base-foreground);
	--accent: var(--primary-base-soft);
	--accent-foreground: var(--primary-base-soft-foreground);
	--ring: var(--primary-base-ring);
}
```

```tsx
import { Button } from "@violet/ui";

export function CampaignActions() {
	return (
		<section className="campaign-theme">
			<Button>主要动作</Button>
			<Button variant="primary">主色动作</Button>
		</section>
	);
}
```

本站的 `.dialect-public` / `.dialect-tool` 就是这种作用域方言，属于站点 `web/src/styles/dialects/`，不随包发布。

## 相关资源

- [颜色](/design-system/palette)：语义色角色与主色推导
- [深色模式](/design-system/guides/dark-mode)：明暗切换的宿主职责
- [样式](/design-system/guides/styling)：Tailwind v4 与组件变体
