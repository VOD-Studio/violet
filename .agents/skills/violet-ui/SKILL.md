---
name: violet-ui
description: 在 violet 仓库使用、扩展 @violet/ui 组件或营造法式组件用法文档时，核对包导出、主题入口、示例与组件真实行为。
---

# 使用 @violet/ui

1. 在 `web/packages/ui/src/index.ts` 核对导出；发布形态（dist ESM、类型与 CSS）由 `package.json` 的 `publishConfig` 在 pack 时接管。缺失时先区分通用组件与业务 feature 私有组件。只有跨 feature 的组件进入包。
2. 从根入口 `@violet/ui` 导入组件。应用的全局 CSS 在 `@import "tailwindcss";` 之后导入 `@import "@violet/ui/styles.css";`；主题值由包的 `src/styles/` 管，站点方言由 `web/src/styles/dialects/` 管。达到：消费方不需要复制 token 文件或扫描包源码。
3. 在 `/design-system/specimens` 找组件用法页，确认真实 props 与键盘/焦点语义。组件新增或变更时让文档从 `ui/examples/<component>/*.tsx?raw` 读取同源示例。达到：预览渲染的代码与复制内容一致。
4. 在明暗主题和窄屏预览实际界面，并运行仓库的前端检查。达到：导出、颜色和交互与页面一致。

包可构建为 ESM、类型声明和 CSS，并通过 tarball 在仓库外安装；npm scoped 发布尚未执行。没有专门的组件文档 MCP 工具，智能体可读取站点 `/llms.txt`、上述源码与此 skill。
