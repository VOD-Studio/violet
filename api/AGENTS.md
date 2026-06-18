<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-06-18 -->

# api

## Purpose
Go 后端服务，提供博客平台的 RESTful API。采用 **DDD 四层架构**（domain → application → infrastructure → interfaces），使用 GORM 管理数据库。详见 `README.md`。

## Key Files
| File | Description |
|------|-------------|
| `README.md` | 新人入门文档（架构说明 + 如何新增模块） |
| `go.mod` | Go 模块定义 (blog-api, Go 1.25) |
| `Dockerfile` | 容器化构建文件 |
| `config.yaml` | 运行时配置 (gitignored) |
| `config.example.yaml` | 配置文件模板 |
| `jwt_private_key.pem` | JWT EC 私钥 (gitignored) |
| `jwt_public_key.pem` | JWT EC 公钥 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `cmd/server/` | 应用入口（main.go 路由注册 + 依赖装配） |
| `config/` | 配置加载 (Viper) |
| `internal/app/` | 依赖注入容器（每模块一个 *_container.go + wire.go） |
| `internal/domain/` | 领域层：聚合根、值对象、仓储端口（接口）、领域错误 |
| `internal/application/` | 应用层：用例编排（CQRS command/query） |
| `internal/infrastructure/` | 基础设施层：GORM 仓储实现 + 外部 API 适配器（auth/email/github/music/storage） |
| `internal/interfaces/http/` | 接口层：HTTP handler + 中间件 |
| `internal/middleware/` | 全局 HTTP 中间件（Auth 端口化/限流/CORS） |
| `internal/job/` | 定时任务（上传会话/临时文件清理） |
| `internal/migrate/` | golang-migrate 执行器 |
| `internal/service/` | 仅 emoji_seed_service.go（启动期 B站表情种子） |
| `migrations/` | PostgreSQL 数据库迁移文件 |
| `uploads/` | 文件上传存储目录 |

## For AI Agents

### Working In This Directory
- 启动服务: `make api`（热重载）或 `go run ./cmd/server`
- 数据库迁移: `make migrate`
- 新增模块须遵循 DDD 四层（domain → application → infrastructure → interfaces），详见 README.md「如何新增一个模块」
- 依赖方向: interfaces → application → domain ← infrastructure（domain 零外部依赖）
- 路由注册使用 chi v5，全部在 cmd/server/main.go
- GORM AutoMigrate 在 main.go 启动时执行
- role/permission 模块用 google/wire DI，其余手工装配

### Testing Requirements
- `go test ./...` 运行所有测试
- `go vet ./...` 代码静态检查
- 测试集中在 domain 层（聚合根不变量）和 application 层（用例编排）

### Common Patterns
- DDD 四层: domain（聚合根+端口）→ application（用例）→ infrastructure（实现端口）→ interfaces（HTTP）
- 仓储端口在 domain 定义，GORM 实现在 infrastructure/persistence/gorm
- 外部 API（GitHub/网易云/邮件）封装为 infrastructure adapter，实现 domain 端口
- 统一错误: domain/shared.DomainError（NotFound/Conflict/BadRequest/Internal/Unauthorized/Forbidden）
- 日志: zerolog 结构化日志
- 配置优先级: 环境变量 > config.yaml > 默认值

## Dependencies

### Internal
- `web/` - 前端消费者
- `../secrets/` - 生产环境 JWT 密钥

### External
- chi v5 - HTTP 路由
- gorm.io - ORM（全量 AutoMigrate）
- pgx/v5 - PostgreSQL 驱动
- go-redis/v9 - Redis 客户端
- golang-jwt/v5 - JWT 认证（ES256）
- spf13/viper - 配置管理
- zerolog - 结构化日志
- resend-go/v2 - 邮件发送
- go-playground/validator - 请求验证
- google/wire - 编译期依赖注入（role/permission 模块）
- golang-migrate - 数据库迁移

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
