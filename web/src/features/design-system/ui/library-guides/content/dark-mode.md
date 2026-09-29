## CSS 驱动，无需 Provider

主题 token 以 `light-dark()` 单声明成对提供明暗取值；`.dark` 类只负责把 `color-scheme` 切到 dark 以激活暗色支。深色模式不依赖任何 JS 运行时或 Provider——库不注入主题管理，任何能切换 `html` 类的方案都能驱动它：

```html
<html class="light">
	<body class="bg-background text-foreground"><!-- 应用 --></body>
</html>
```

`bg-background`、`text-foreground` 等语义工具类读取的是 `light-dark()` 变量，明暗切换后全部使用点自动跟随，无需为深色另写一套类名。

## 与 next-themes 集成

宿主使用 `next-themes` 时（`pnpm add next-themes`），在根部放 Provider 并关闭其内联 `color-scheme` 注入，让包内的 `.dark` 规则驱动取值：

```tsx
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
	return (
		<ThemeProvider attribute="class" defaultTheme="system" enableColorScheme={false}>
			{children}
		</ThemeProvider>
	);
}
```

在根布局挂 Provider，并给 `html` 加 `suppressHydrationWarning`——next-themes 会在客户端改写类，服务端输出的类与首帧不一致是预期行为：

```tsx
import { Providers } from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="zh-CN" suppressHydrationWarning>
			<body className="bg-background text-foreground">
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
```

切换器读取的主题值在服务端未知，直接渲染会在水合前后跳变；用 mounted 守卫避免不匹配：

```tsx
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeSwitch() {
	const { setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	if (!mounted) return null;
	return (
		<div>
			<button type="button" onClick={() => setTheme("light")}>浅色</button>
			<button type="button" onClick={() => setTheme("dark")}>深色</button>
			<button type="button" onClick={() => setTheme("system")}>跟随系统</button>
		</div>
	);
}
```

## 命名主题与明暗是两个正交轴

一些组件库把自定义主题名与明暗合在同一个属性上，例如让 next-themes 用 `attribute="data-theme"` 配一份主题名列表。`@violet/ui` 把两轴分开：

- `dark` 类控制明暗，作用于整页；
- `data-theme` 属性选择命名色板（`violet`、`coral`），可整站也可局部生效。

```html
<html lang="zh-CN" class="dark" data-theme="coral">
```

用 next-themes 时让它只管理 `class` 轴，色板轴由应用状态直接挂属性。色板导入位置与作用域规则见[主题](/design-system/guides/theming)的「命名主题」一节。

## 无框架方案：useTheme

不引主题库的应用可以用包根导出的 `useTheme`：light / dark / system 三态，`system` 经 `prefers-color-scheme` 解析并跟随系统变化，选择持久化在 `localStorage["violet-theme"]`，`html` 的 `dark` 类由 hook 应用。SSR 环境下安全，同页多个实例共享同一状态。

```tsx
import { useTheme } from "@violet/ui";

export function ThemeSwitch() {
	const { theme, setTheme } = useTheme();
	return (
		<div>
			<button type="button" data-active={theme === "light"} onClick={() => setTheme("light")}>
				浅色
			</button>
			<button type="button" data-active={theme === "dark"} onClick={() => setTheme("dark")}>
				深色
			</button>
			<button type="button" data-active={theme === "system"} onClick={() => setTheme("system")}>
				跟随系统
			</button>
		</div>
	);
}
```

`useTheme` 接受可选的 `defaultTheme`（默认 `"system"`），返回 `{ theme, resolvedTheme, setTheme }`：`theme` 是用户选择，`resolvedTheme` 是 `system` 解析后的实际明暗。

## SSR 与首屏同步

SSR 页面需要在首屏同步主题类，避免 hydration 前背景闪烁。本站由应用持久化主题 cookie、服务端输出 `html` 类，客户端交给 next-themes 接管；这一流程不由 `@violet/ui` 自动完成。无论采用哪种方案，都不要内联设置 `color-scheme`——它会盖过类选择器。

## 只用一个主题控制器

一个应用只应有一个写入 `html` 主题类的入口。next-themes 与 `useTheme` 同时启用会互相覆盖；多个切换器各持一份状态也会闪烁。选定一个控制器后，其余代码只读不写。
