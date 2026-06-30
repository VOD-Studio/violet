<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-06-30 -->

# internal

## Purpose
Go 应用核心业务代码，遵循 Go 标准 internal 包约定，不可被外部模块导入。采用 DDD 四层架构（domain → application → infrastructure → interfaces）。

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `app/` | 依赖注入容器，每个模块的装配入口 |
| `domain/` | 领域层：包含聚合根、值对象、仓储端口（接口）、领域错误 |
| `application/` | 应用层：用例编排（CQRS 读写分离） |
| `infrastructure/` | 基础设施层：GORM 仓储实现、外部 API 适配器（auth/email/github/music/storage） |
| `interfaces/` | 接口层：HTTP handler、中间件适配等 |
| `middleware/` | 全局 HTTP 中间件（认证/限流/CORS/审计） |
| `job/` | 定时任务（文件清理等） |
| `migrate/` | 数据库迁移执行器 |
| `service/` | 启动期数据种子服务 |

## For AI Agents

### Working In This Directory
- 依赖方向严格限制为: interfaces → application → domain ← infrastructure。domain 层零外部依赖。
- 新增功能需遵循 DDD 规范，在各层增加相应实现（详情见 api/README.md「如何新增一个模块」）。

### Common Patterns
- 仓储接口定义在 domain 层，具体实现在 infrastructure/persistence/gorm。
- 统一错误使用 domain/shared.DomainError，在 interfaces 层统一翻译为 HTTP 状态码与结构化响应。

