## 包内规则

`web/packages/ui/AGENTS.md` 约束导出、样式归属和示例同步，原文如下：

```markdown
# @violet/ui

在此包内新增或编辑组件、样式、公开导出时，先读仓库的 `.agents/skills/violet-ui/SKILL.md`，再读 `frontend-conventions`；改动 Tailwind 类时还要读 `tailwind-canonical-classes`。

- 公开根入口 `@violet/ui` 在仓库内指向 `src/index.ts`（workspace 直接吃源码）；pack 产物由 `publishConfig` 指向 dist 的 ESM 与类型声明，`@violet/ui/styles.css` 同理指向打包 CSS，宿主在 Tailwind v4 之后导入。
- 包负责基础语义 token、默认 Violet 色板和通用交互组件；博客业务状态与站点方言留在 `web/src/features/` 和 `web/src/styles/dialects/`。
- 组件文档位于 `web/src/features/design-system/ui/`。示例用真实组件运行，并从同一示例 `.tsx?raw` 展示源码；导出和文档需同时保持一致。
- `pnpm --filter @violet/ui build` 后打包 tarball，可在仓库外的 React 19 + Tailwind v4 项目安装。npm scoped 发布尚未执行；消费指南应给 tarball 安装命令，不写未发布的 registry 安装命令。
```
本页引文是快照，以文件原文为准。

## 整仓规范

根目录 `AGENTS.md` 继续约束整仓架构、提交和检查，与组件库消费直接相关的部分：

- **架构边界**：跨 feature 的通用组件与基础语义 token 在 `web/packages/ui/`；站点方言在 `web/src/styles/dialects/`；业务逻辑不进公共层。
- **开发流与命令**：`make dev` 一键启动完整开发环境；`make web-typecheck`、`make web-test`、`make web-lint` 是前端检查入口。
- **提交规范**：中文 Conventional Commits，scope 指向最小改动单元，前后端分离提交。

## 消费方式

在本仓库工作的编码智能体动笔前读取这两份文件：涉及包内改动先读包 `AGENTS.md`（它会再引导读取上文的 `violet-ui` skill），整仓约定以根 `AGENTS.md` 为准。两份文件都在仓库内随代码演进，更新文件即更新规范。
