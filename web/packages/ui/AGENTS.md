# @violet/ui

在此包内新增或编辑组件、样式、公开导出时，先读仓库的 `.agents/skills/violet-ui/SKILL.md`，再读 `frontend-conventions`；改动 Tailwind 类时还要读 `tailwind-canonical-classes`。

- 公开根入口 `@violet/ui` 在仓库内指向 `src/index.ts`（workspace 直接吃源码）；pack 产物由 `publishConfig` 指向 dist 的 ESM 与类型声明，`@violet/ui/styles.css` 同理指向打包 CSS，宿主在 Tailwind v4 之后导入。
- 包负责基础语义 token、默认 Violet 色板和通用交互组件；博客业务状态与站点方言留在 `web/src/features/` 和 `web/src/styles/dialects/`。
- 组件文档位于 `web/src/features/design-system/ui/`。示例用真实组件运行，并从同一示例 `.tsx?raw` 展示源码；导出和文档需同时保持一致。
- `pnpm --filter @violet/ui build` 后打包 tarball，可在仓库外的 React 19 + Tailwind v4 项目安装。npm scoped 发布尚未执行；消费指南应给 tarball 安装命令，不写未发布的 registry 安装命令。
