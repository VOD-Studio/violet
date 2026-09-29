## 如何使用颜色

先选语义角色，再成对使用背景与前景色；自定义元素也一样用 `bg-primary-base-soft text-primary-base-soft-foreground`，不要只换背景不换文字。

### 在组件中

`Button` 不传 variant（即 default）使用 `--primary`：裸包默认是高对比中性色；本页处于本站公开内容方言，已将它映射到 Violet 主色，因此下方预览的默认按钮也是紫色。`primary` 始终使用 `--primary-base`，`soft` 使用 `--primary-base-soft` 及各自的前景色。

```palette-demo
ColorUsageDemo
```

### 在 CSS 文件中

应用 CSS 可直接读取 `var(--primary-base)`；使用 `@apply` 时，把规则写在由 Tailwind v4 编译的应用样式中，且先在入口导入 `tailwindcss` 与 `@violet/ui/styles.css`。

```palette-css
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

入口只需 `@import "@violet/ui/styles.css";`（先导入 `tailwindcss`）。包内的 `tokens.css` 提供默认中性 `--primary` 与画布、状态色；`palettes/violet.css` 提供六个 `--primary-base*` 主色源值；`theme.css` 用 `@theme inline` 注册 `--color-primary-base: var(--primary-base)`，使 `bg-primary-base` 在使用位置读取当前变量。下面展示包内预设源码，不是可导入的包子路径。

默认 `:root` 为 `color-scheme: light`；宿主把 `.dark` 挂在 html 时，`color-scheme: dark` 激活 `light-dark()` 的暗色值。本站 `.dialect-public` 才将 `--primary` 与前景色映射到主色源；这个站点方言不随包发布。

```palette-violet
violet.css
```

## 自定义颜色

### 覆盖已有颜色

在应用自己的 CSS 中覆盖主色源六变量（基色、前景、悬停、柔和底与前景、焦点环），保留明暗两套值并检查文字对比度。本站的珊瑚文件是完整示例；放在包样式之后导入。仅需局部改变默认动作时，还须在同一作用域成对重映射 `--primary` / `--primary-foreground`；不能只在子元素重写 `--primary-base`，期待上层方言继承的默认动作自动更新。

`--success` / `--success-foreground` 等行为状态色不会随主色源切换；若要改其视觉值，另外成对覆盖同名语义变量即可，已有 `--color-*` 映射不用重复注册。

```palette-coral
coral.css
```

```palette-entry
/* src/styles.css：先加载包，再加载应用自己的覆盖文件 */
@import "tailwindcss";
@import "@violet/ui/styles.css";
@import "@violet/ui/palettes/coral.css";

/* 仅需要品牌色作为默认动作时，在自己的作用域里成对映射 */
.brand-actions {
	--primary: var(--primary-base);
	--primary-foreground: var(--primary-base-foreground);
}
```

### 添加自定义颜色

新颜色要同时定义底色与前景色，并在应用 CSS 以 `@theme inline` 注册各自的 `--color-*` 映射。把示例文件在包样式后以 `@import "./styles/notice.css";` 导入应用入口，再使用 `className="bg-notice text-notice-foreground"`。现有 `primary-base`、`success` 等已经注册，不必重复声明。

```palette-notice
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

主题切换与站点作用域的完整设置见[主题指南](/design-system/guides/theming)；调好主色后可用[主题构建器](/design-system/guides/theme-builder)导出可落盘的色板 CSS。
