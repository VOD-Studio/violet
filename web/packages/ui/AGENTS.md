# @violet/ui

在此包内新增或编辑组件、样式、公开导出时，先读仓库的 `.agents/skills/violet-ui/SKILL.md`，再读 `frontend-conventions`；改动 Tailwind 类时还要读 `tailwind-canonical-classes`。

- JavaScript/TypeScript 公开入口是 `src/index.ts`，消费者写 `import { Button } from "@violet/ui"`。样式入口是 `@violet/ui/styles.css`，须在宿主导入 Tailwind v4 之后导入。
- 包负责基础语义 token、默认 Violet 色板和通用交互组件；博客业务状态与站点方言留在 `web/src/features/` 和 `web/src/styles/dialects/`。
- 组件文档位于 `web/src/features/design-system/ui/`。示例用真实组件运行，并从同一示例 `.tsx?raw` 展示源码；导出和文档需同时保持一致。
- 包是 `private` 工作区包，JS 出口是 TS 源码。对外写文档时按此契约描述，不把它称为可从 npm 安装的构建包。
