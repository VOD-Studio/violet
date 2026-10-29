# violet 文档目录

本文档库按用途分层组织，避免 issue、PRD、规范、历史记录混在一起。

## 目录说明

| 目录 | 用途 |
|---|---|
| `adr/` | 架构决策记录（Architecture Decision Records），包含已被采纳或 superseded 的决策。 |
| `archive/` | 已过时或过渡性的文档，保留历史上下文但不再作为当前依据。 |
| `deploy/` | 部署、运维、发布手册：含 [发布手册](./deploy/release-runbook.md)、[手动部署](./deploy/manual-deploy.md)、[runner 搭建](./deploy/runner-setup.md)。 |
| `guides/` | 开发规范、风格指南、最佳实践。含 [前端代码规范](./guides/frontend-style-guide.md)、[Go 测试规范](./guides/go-testing-guide.md)、[MCP Server 使用指南](./guides/mcp-servers.md)、[页面转场指南](./guides/view-transitions.md)、[Nowbeam 接入指南](./guides/nowbeam.md)。 |
| `issues/` | 按 PRD 或功能主题分组的历史任务/issue 记录。 |
| `prd/` | 产品需求文档（Product Requirements Documents）。 |
| `research/` | 基于一手来源的接入与技术可行性分析，含 [Kite 接入分析](./research/kite-integration.md)。 |
| `superpowers/` | 被 `.gitignore` 忽略，不纳入版本控制。 |

## 组件库开发

组件库规范留在 `web/packages/ui/docs/`；`web/src/features/ui-docs/` 在 `/ui` 展示同一正文与组件用法：

- [组件库架构](../web/packages/ui/docs/architecture.md)：组件单元、同源 CSS、成熟度与验证边界。
- [组件设计方法](../web/packages/ui/docs/component-design.md)：消费场景、清单登记、同源示例与真实 tarball 验收。
- [包内规范](../web/packages/ui/AGENTS.md)与[包 README](../web/packages/ui/README.md)：公开入口与当前可执行命令。

## 独立 npm 包

- [发布步骤](./deploy/release-runbook.md#npm-独立包发布)：发布权限、双包独立验收和显式手动发布。
- [Inkline 开发说明](../web/packages/inkline/DEVELOPMENT.md)：示例图、双语 README 同步和 tarball 消费验证。
- [React Tweet 开发说明](../web/packages/react-tweet/DEVELOPMENT.md)：推文示例生成、样式入口和独立消费验证。
- [Kanban 使用说明](../web/packages/kanban/README.zh-CN.md)、[API 文档](../web/packages/kanban/docs/api.md)与[开发说明](../web/packages/kanban/DEVELOPMENT.md)：同源示例、全入口 tarball 消费验收和发布前清单；尚未发布 npm。
- [Theme 开发说明](../web/packages/theme/DEVELOPMENT.md)：门槛遍历测试、算法调参与 tarball 的 Node / Chromium 消费验证；尚未发布 npm。

## 使用约定

- PRD 主文件直接放在 `prd/` 根目录。
- 每个 PRD 的拆分 issue 放在 `issues/<PRD编号或主题>/` 下，按文件夹内从 `0001` 起重新编号。
- 跨 PRD 的公共功能主题（无对应 PRD）放在 `issues/<主题>/` 下。
- 被新决策替代的旧文档移入 `archive/`，不直接删除。
