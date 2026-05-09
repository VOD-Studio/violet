<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# internal

## Purpose
Go 应用核心业务代码，遵循 Go 标准 internal 包约定，不可被外部模块导入。包含 HTTP 分层的所有层级。

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `handler/` | HTTP 处理层，参数校验和响应封装 (see `handler/AGENTS.md`) |
| `middleware/` | HTTP 中间件 (认证、CORS、限流等) (see `middleware/AGENTS.md`) |
| `model/` | 数据模型和类型定义 (see `model/AGENTS.md`) |
| `repository/` | 数据访问层 + sqlc 生成代码 (see `repository/AGENTS.md`) |
| `service/` | 业务逻辑层 (see `service/AGENTS.md`) |
| `pkg/` | 内部工具包 (see `pkg/AGENTS.md`) |
| `job/` | 后台定时任务 (see `job/AGENTS.md`) |
| `migrate/` | 数据库迁移辅助 |

## For AI Agents

### Working In This Directory
- 严格分层调用: handler → service → repository，禁止跨层调用
- 新增功能需在各层同步添加代码
- model 包定义跨层共享的数据结构

### Common Patterns
- 依赖注入: 各层通过接口解耦
- 错误传播: 自定义错误类型在各层间传递
- 统一响应: handler 层使用 pkg/response 封装响应

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
