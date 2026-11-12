# violet 文档目录

本文档库按用途分层组织，避免 issue、PRD、规范、历史记录混在一起。

## 目录说明

| 目录 | 用途 |
|---|---|
| `adr/` | 架构决策记录（Architecture Decision Records），包含已被采纳或 superseded 的决策。 |
| `archive/` | 已过时或过渡性的文档，保留历史上下文但不再作为当前依据。 |
| `deploy/` | 部署、运维、发布手册：含 [发布手册](./deploy/release-runbook.md)、[手动部署](./deploy/manual-deploy.md)、[runner 搭建](./deploy/runner-setup.md)。 |
| `design/` | 外部设计工具产出的设计稿原稿，含 [Violet 页面与基础设计稿](./design/ued/README.md)：保留画布索引、页面原稿与引用资源，旧组件画板已移除。 |
| `guides/` | 开发规范、风格指南、最佳实践。含 [前端代码规范](./guides/frontend-style-guide.md)、[Go 测试规范](./guides/go-testing-guide.md)、[MCP Server 使用指南](./guides/mcp-servers.md)、[页面转场指南](./guides/view-transitions.md)、[Nowbeam 接入指南](./guides/nowbeam.md)。 |
| `issues/` | 按 PRD 或功能主题分组的历史任务/issue 记录。 |
| `prd/` | 历史本地产品需求文档；新 PRD 使用 GitHub Issue，不在此保留正文副本。 |
| `research/` | 基于一手来源的接入与技术可行性分析，含 [Kite 接入分析](./research/kite-integration.md)。 |
| `superpowers/` | 被 `.gitignore` 忽略，不纳入版本控制。 |

## 前台改版计划

- [#758 前台页面改版规格](https://github.com/VOD-Studio/violet/issues/758)：前台页面范围、现有组件优先规则、数据能力与路由迁移；14 个实施子 Issue 通过原生子任务与依赖关系关联。

## 组件库开发

组件库规范留在 `web/packages/ui/docs/`；组件陈列室已下线，开发与验收直接使用包内规范、独立消费者和实际业务页面：

- [组件库架构](../web/packages/ui/docs/architecture.md)：组件单元、同源 CSS、成熟度与验证边界。
- [组件设计方法](../web/packages/ui/docs/component-design.md)：消费场景、清单登记与真实 tarball 验收。
- [包内规范](../web/packages/ui/AGENTS.md)与[包 README](../web/packages/ui/README.md)：公开入口与当前可执行命令。
- [页面与组件设计优先级](./adr/0030-frontend-pages-use-existing-components.md)：已有组件优先于旧页面稿，页面改版不复制同类控件。

## 独立 npm 包

- [发布步骤](./deploy/release-runbook.md#npm-独立包发布)：发布权限、双包独立验收和显式手动发布。
- [Inkline 开发说明](../web/packages/inkline/DEVELOPMENT.md)：示例图、双语 README 同步和 tarball 消费验证。
- [React Tweet 开发说明](../web/packages/react-tweet/DEVELOPMENT.md)：推文示例生成、样式入口和独立消费验证。
- [Kanban 使用说明](../web/packages/kanban/README.zh-CN.md)、[API 文档](../web/packages/kanban/docs/api.md)与[开发说明](../web/packages/kanban/DEVELOPMENT.md)：同源示例、全入口 tarball 消费验收和发布前清单；尚未发布 npm。
- [Theme 开发说明](../web/packages/theme/DEVELOPMENT.md)：门槛遍历测试、算法调参与 tarball 的 Node / Chromium 消费验证；尚未发布 npm。

## OMP 用量接入

- [采集扩展安装与隐私说明](./guides/omp-usage.md)：OMP 原生 Marketplace 安装与管理、PAT、目标站点、离线队列和看板统计口径。
- [共享 PostgreSQL 契约](../api/pkg/ompusage/README.md)：参数绑定、原生宿主职责、独立打包与 Rust 消费验收；不依赖 Violet 的鉴权或 UI。

## 使用约定

- 新 PRD 使用 GitHub 父 Issue，实施任务使用子 Issue；规格与验收标准只在 Issue 维护，仓库保留索引链接。
- 仅 `gh` 不可用时降级为本地 Markdown：PRD 放 `prd/`，拆分任务放 `issues/<PRD编号或主题>/`。
- 历史本地 PRD 与任务记录保留，不创建同主题的正文副本。
- 被新决策替代的旧文档移入 `archive/`，不直接删除。
