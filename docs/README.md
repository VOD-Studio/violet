# violet 文档目录

本文档库按用途分层组织，避免 issue、PRD、规范、历史记录混在一起。

## 目录说明

| 目录 | 用途 |
|---|---|
| `adr/` | 架构决策记录（Architecture Decision Records），包含已被采纳或 superseded 的决策。 |
| `archive/` | 已过时或过渡性的文档，保留历史上下文但不再作为当前依据。 |
| `deploy/` | 部署、运维、发布手册：含 [发布手册](./deploy/release-runbook.md)、[手动部署](./deploy/manual-deploy.md)、[runner 搭建](./deploy/runner-setup.md)。 |
| `guides/` | 开发规范、风格指南、最佳实践。含 [前端代码规范](./guides/frontend-style-guide.md)、[Go 测试规范](./guides/go-testing-guide.md)、[MCP Server 使用指南](./guides/mcp-servers.md)。 |
| `issues/` | 历史任务快照及 GitHub 不可用时的本地 issue 降级记录；新任务优先使用 GitHub Issues。 |
| `prd/` | 产品需求文档（Product Requirements Documents），含 [后台运维与数据保护](./prd/0027-后台运维与数据保护.md)。 |
| `superpowers/` | 被 `.gitignore` 忽略，不纳入版本控制。 |

## 使用约定

- PRD 主文件直接放在 `prd/` 根目录。
- 新 PRD 和拆分任务发布到 GitHub Issues；仅在 `gh` 不可用时放入 `issues/<PRD编号或主题>/`，按目录内从 `0001` 起编号。
- issue 来源、降级与依赖规则以 [issue tracker](./agents/issue-tracker.md) 为准，不为已有 GitHub issue 维护第二份本地正文。
- 被新决策替代的旧文档移入 `archive/`，不直接删除。
