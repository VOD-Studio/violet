## 发布节奏

- **0.x 阶段**：能力随仓库演进按小版本推进，包版本记录在 `web/packages/ui/package.json`。
- **分发形态**：站点经 `workspace:*` 消费源码；独立项目安装构建 tarball，npm 发布尚未执行。
- **文档同步**：组件用法页与示例同源，版本落地时随代码同 commit 更新。

## v0.1.0

2026 年 9 月 28 日

首个成册版本：40+ 通用组件从站点公共层迁入 pnpm 工作区包，变体系统迁移到 `tailwind-variants`，语义主题（基础 token、Violet 色板、Tailwind 映射）随 `@violet/ui/styles.css` 入口随包分发；新增独立构建链，产出 ESM、类型声明与打包 CSS，可压成 tarball 在仓库外安装验证。营造法式同步改造为组件库文档站。

- 新增构建产物三件套：`pnpm --filter @violet/ui build` 产出 dist 下的 ESM、类型声明与单文件主题 CSS。
- 宿主解耦：Toaster 改为主题透传（不再依赖 next-themes），Segmented 移除 TanStack Router 耦合，OverlayScroll 与 chart 消除运行时 CSS 与 innerHTML 注入。
- 文档站五卷成册：入门、纲纪准则、设计法度、构件陈列、智能体，正文按章节路由化并懒加载。
- 组件用法页覆盖 Button、Badge、Checkbox、Dialog、Tabs、Input，见[组件目录](/design-system/specimens)。

## 尚未开放

- scoped npm registry 发布与版本化 CHANGELOG。
- 专用的组件文档 MCP server。
- 用于初始化与安装组件的专用 CLI。
- Figma 组件资产。

需要这些能力时先补齐实际产物，再更新接入说明。
