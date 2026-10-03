## 规范文件

在本仓库工作的编码智能体动笔前读取实际文件：

| 文件 | 职责 |
| --- | --- |
| `AGENTS.md` | 整仓架构边界、开发命令和提交规范 |
| `web/packages/ui/AGENTS.md` | 组件单元、公开入口、样式、文档与消费验证边界 |
| `.agents/skills/violet-ui/SKILL.md` | 使用与扩展组件库的操作流程 |

整仓约定从根 `AGENTS.md` 读取；涉及组件库时继续读取包内 `AGENTS.md` 和 `violet-ui` 技能。文件随代码演进，本页只提供入口。

## 开发命令

`make dev` 启动完整开发环境。前端检查入口为 `make web-lint`、`make web-typecheck` 和 `make web-test`；包自身的检查与真实 tarball 验证流程见 `violet-ui` 技能。
