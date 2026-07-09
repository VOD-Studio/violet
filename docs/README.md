# mimo-blog 文档目录

本文档库按用途分层组织，避免 issue、PRD、规范、历史记录混在一起。

## 目录说明

| 目录 | 用途 |
|---|---|
| `adr/` | 架构决策记录（Architecture Decision Records），包含已被采纳或 superseded 的决策。 |
| `archive/` | 已过时或过渡性的文档，保留历史上下文但不再作为当前依据。 |
| `deploy/` | 部署、运维、发布手册。 |
| `guides/` | 开发规范、风格指南、最佳实践。 |
| `issues/` | 按 PRD 或功能主题分组的历史任务/issue 记录。 |
| `prd/` | 产品需求文档（Product Requirements Documents）。 |
| `superpowers/` | 被 `.gitignore` 忽略，不纳入版本控制。 |

## 使用约定

- PRD 主文件直接放在 `prd/` 根目录。
- 每个 PRD 的拆分 issue 放在 `issues/<PRD编号或主题>/` 下，按文件夹内从 `0001` 起重新编号。
- 跨 PRD 的公共功能主题（无对应 PRD）放在 `issues/<主题>/` 下。
- 被新决策替代的旧文档移入 `archive/`，不直接删除。
