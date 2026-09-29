## 先选语义角色，再取色值

颜色体系围绕语义意图构建，而非堆砌色板：先选对角色，色值由主题与[色板生成器](/design-system/palette)提供。命名规则与全站一致：不带后缀的变量用作背景（`--accent`），带 `-foreground` 后缀的是其上的文字（`--accent-foreground`）；成对使用，文本对比度需满足 WCAG AA。

常用角色速查：

| 角色 | 用途 | 工具类 |
| --- | --- | --- |
| 主色源 | 品牌强调动作 | `bg-primary-base text-primary-base-foreground` |
| 柔和淡染 | 弱强调、选中底 | `bg-primary-base-soft text-primary-base-soft-foreground` |
| 主要动作 | 默认按钮等高对比动作 | `bg-primary text-primary-foreground` |
| 信息 / 成功 / 警告 / 危险 | 行为状态反馈 | `bg-info`、`bg-success`、`bg-warning`、`bg-destructive` |
| 画布与表面 | 页面基底与卡片 | `bg-background`、`bg-card` |
| 静默 | 次要文字与弱化区块 | `text-muted-foreground`、`bg-muted` |

完整 token 名称与实时值见 [Token 词典](/design-system/tokens)。

## 在组件中

`Button` 不传 variant（即 default）使用 `--primary`：裸包默认是高对比中性色；本站公开内容方言（`.dialect-public`）已将它映射到 Violet 主色，因此页面上的默认按钮也是紫色。`primary` 始终使用 `--primary-base`，`soft` 使用 `--primary-base-soft` 及各自的前景色。

```tsx
import { Button } from "@violet/ui";

export function ColorUsageDemo() {
	return (
		<div className="flex flex-wrap items-center justify-center gap-3">
			<Button type="button">默认动作</Button>
			<Button type="button" variant="primary">
				主色强调
			</Button>
			<Button type="button" variant="soft">
				柔和淡染
			</Button>
			<span className="rounded-lg bg-primary-base-soft px-3 py-2 text-primary-base-soft-foreground">
				自定义元素
			</span>
		</div>
	);
}
```

## 在 CSS 文件中

应用 CSS 可直接读取 `var(--primary-base)`；使用 `@apply` 时，把规则写在由 Tailwind v4 编译的应用样式中，且先在入口导入 `tailwindcss` 与 `@violet/ui/styles.css`。

```css
/* 在应用的 CSS 文件中；先由入口导入 @violet/ui/styles.css */
.my-component {
	background: var(--primary-base);
	color: var(--primary-base-foreground);
	border: 1px solid var(--border);
}

@layer components {
	.action-button {
		@apply bg-primary-base text-primary-base-foreground;
		&:hover {
			@apply bg-primary-base-hover;
		}
	}
}
```

## 默认主题

入口只需 `@import "@violet/ui/styles.css";`（先导入 `tailwindcss`）。包内的 `tokens.css` 提供默认中性 `--primary` 与画布、状态色；`palettes/violet.css` 提供六个 `--primary-base*` 主色源值；`theme.css` 用 `@theme inline` 注册 `--color-primary-base: var(--primary-base)`，使 `bg-primary-base` 在使用位置读取当前变量。

```css
:root,
[data-theme="violet"] {
	--primary-base: light-dark(oklch(0.53 0.205 286), oklch(0.72 0.148 286));
	--primary-base-foreground: light-dark(oklch(0.99 0 0), oklch(0.14 0.02 286));
	--primary-base-hover: light-dark(oklch(0.47 0.215 286), oklch(0.77 0.138 286));
	--primary-base-soft: light-dark(oklch(0.965 0.022 286), oklch(0.22 0.038 286));
	--primary-base-soft-foreground: light-dark(oklch(0.35 0.14 286), oklch(0.9 0.07 286));
	--primary-base-ring: light-dark(oklch(0.53 0.205 286), oklch(0.72 0.148 286));
}
```

默认 `:root` 为 `color-scheme: light`；宿主把 `.dark` 挂在 html 时，`color-scheme: dark` 激活 `light-dark()` 的暗色值。本站 `.dialect-public` 才将 `--primary` 与前景色映射到主色源；这个站点方言不随包发布。

## 自定义颜色

**覆盖已有颜色**：在应用自己的 CSS 中覆盖主色源六变量（基色、前景、悬停、柔和底与前景、焦点环），保留明暗两套值并检查文字对比度。包内珊瑚色板是完整示例；放在包样式之后导入。仅需局部改变默认动作时，还须在同一作用域成对重映射 `--primary` / `--primary-foreground`；不能只在子元素重写 `--primary-base`，期待上层方言继承的默认动作自动更新。

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

`--success` / `--success-foreground` 等行为状态色不会随主色源切换；若要改其视觉值，另外成对覆盖同名语义变量即可，已有 `--color-*` 映射不用重复注册。

**添加自定义颜色**：新颜色要同时定义底色与前景色，并在应用 CSS 以 `@theme inline` 注册各自的 `--color-*` 映射，再使用 `className="bg-notice text-notice-foreground"`。

```css
/* src/styles/notice.css；在应用入口的包样式之后导入 */
:root {
	--notice: light-dark(oklch(0.52 0.15 240), oklch(0.72 0.12 240));
	--notice-foreground: light-dark(oklch(0.99 0 0), oklch(0.15 0.02 240));
}

@theme inline {
	--color-notice: var(--notice);
	--color-notice-foreground: var(--notice-foreground);
}
```

主题切换、命名主题与站点作用域的完整设置见[主题指南](/design-system/guides/theming)；调好主色后可用[主题构建器](/design-system/guides/theme-builder)导出可落盘的色板 CSS。
