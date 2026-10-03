## Vite

React 19 宿主可安装本包 tarball。Tailwind CSS v4 项目先导入 Tailwind，再导入完整包样式：

```ts
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [tailwindcss(), react()] });
```

```css
@import "tailwindcss";
@import "@violet/ui/styles.css";
```

不使用 Tailwind 时先导入 `@violet/ui/tokens.css`，再导入 `@violet/ui/classes.css`；按需可将后者换为 `@violet/ui/components/button.css`。组合组件的 CSS 包含真实子组件样式依赖，例如 TextField 带齐 Input 与 Label 的规则。完整入口保留 legacy 兼容样式，基础组件无需宿主扫描其 TSX 来生成外观。

包自带的 `consumer` 命令在工作区外安装真实 tgz，检查类型、SSR 与 Vite 构建；检查方法见[组件设计流程](/design-system/guides/component-design)。框架接入必须以实际执行的结果为准。

## TanStack Start

本站通过 `workspace:*` 消费源码。SSR 页面在根布局加载全局样式，首屏与客户端使用同一套变量；`.dark` 放在 html 或共同祖先，主题持久化由应用负责，见[深色模式](/design-system/guides/dark-mode)。

```bash
cd web
pnpm install
pnpm dev
```

本站字体和装饰动效位于 `web/src/styles/site-theme.css`，在包样式之后导入。它们不进入独立消费者的默认主题。

## 纯 HTML 与非 React 框架

安装 tarball 后可从 `node_modules/@violet/ui/dist/` 引用两份预编译 CSS：tokens 提供语义变量，classes 提供 `.v-button` 等 BEM 类。React 基础控件与 HTML 共用这些规则。

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./tokens.css" />
    <link rel="stylesheet" href="./classes.css" />
  </head>
  <body style="background: var(--background); color: var(--foreground)">
    <button type="button" class="v-button v-button--primary">保存</button>
    <a class="v-button v-button--outline" href="./docs.html">查看文档</a>
  </body>
</html>
```

html 上的 `dark` 类切换明暗取值。CSS 提供外观与原生伪类反馈；原生 button 和 input 的键盘、提交等行为仍由浏览器提供。Dialog 焦点管理、集合导航等复合行为需要 React 实现，不能靠 CSS 获得。

## 方向、语言与其他框架

包未完成全库 RTL 验证；方向相关样式尚未全部切换为逻辑属性。文案、日期和数字格式由宿主处理，当前没有包级 I18nProvider。

尚未给 Next.js、Remix、Astro 或 Storybook 建立独立消费者检查，也没有 Vue/Svelte 原生实现。需要接入时先建立最小宿主，验证样式、SSR 与交互，再记录实际范围。
