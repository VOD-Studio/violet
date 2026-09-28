## Vite（已验证）

在 Vite 项目的全局 CSS 中先导入 Tailwind，再导入包样式，即可使用全部组件。以下路径在仓库外的独立 React 19 + Vite 8 项目实测通过：

```ts
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [tailwindcss(), react()] });
```

```css
/* src/styles.css */
@import "tailwindcss";
@import "@violet/ui/styles.css";
```

## TanStack Start（已验证）

本站即宿主：通过 `workspace:*` 消费包，SSR 页面在根布局加载同一份全局样式，让首屏与客户端拿到同一套变量；把 `.dark` 挂在 html 或共同祖先，主题持久化由应用负责，见[深色模式](/design-system/guides/dark-mode)。

```bash
# 安装（工作区）
cd web
pnpm install
pnpm dev
```

## 纯 HTML 与非 React 框架

不使用 React 的页面用两份 CSS 即可获得组件外观：`@violet/ui/tokens.css` 提供语义变量，`@violet/ui/classes.css` 提供预编译的 BEM 类（`.v-button` 等，`v-` 前缀避免与宿主类名冲突）。安装 tarball 后从 `node_modules/@violet/ui/dist/` 复制或引用这两份文件：

```html
<!doctype html>
<html lang="zh-CN">
	<head>
		<!-- 先 token 后组件类：classes.css 的颜色、圆角全部取自语义 token -->
		<link rel="stylesheet" href="./tokens.css" />
		<link rel="stylesheet" href="./classes.css" />
	</head>
	<body style="background: var(--background); color: var(--foreground)">
		<button type="button" class="v-button v-button--primary">保存</button>
		<a class="v-button v-button--outline" href="./docs.html">查看文档</a>
	</body>
</html>
```

给 html 加 `dark` 类可切换深色取值，与[深色模式](/design-system/guides/dark-mode)的规则一致。

这些类覆盖颜色、尺寸与原生伪类状态（`:hover`、`:focus-visible`、`:disabled`），并保留 `[data-state]`、`[aria-*]` 属性形态；弹层开合、焦点管理、键盘导航等交互行为不在其中，仍由 React 组件提供。纯 HTML 场景适合展示型用途，交互密集的界面请使用 React 组件。

## RTL 与国际化

组件未在 RTL（从右到左书写）环境下验证，方向相关样式尚未全面切换为逻辑属性，阿拉伯语等 RTL 界面使用前需自行验证。包不提供 `I18nProvider` 或包级的区域设置配置，文案、日期与数字格式化由宿主应用处理。

## 更多框架

以下宿主尚未验证或暂无计划，先列出方向；开放后在此补充实测步骤：

- **Next.js（App Router）**：SSR 布局导入验证中
- **Remix**：暂未开放
- **Astro**：暂未开放
- **Storybook**：暂未开放

没有 Vue/Svelte 原生组件；构建产物面向 React 19 宿主。
