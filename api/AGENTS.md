<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# api

## Purpose
Go 后端服务，提供博客平台的 RESTful API。支持文章管理、评论系统、音乐管理、Emoji 系统、项目管理、用户认证等功能。采用严格分层架构 (handler → service → repository)，使用 sqlc 生成数据库查询代码。

## Key Files
| File | Description |
|------|-------------|
| `go.mod` | Go 模块定义 (blog-api, Go 1.25) |
| `sqlc.yaml` | sqlc 代码生成配置 |
| `Dockerfile` | 容器化构建文件 |
| `config.yaml` | 运行时配置 (gitignored) |
| `config.example.yaml` | 配置文件模板 |
| `jwt_private_key.pem` | JWT EC 私钥 (gitignored) |
| `jwt_public_key.pem` | JWT EC 公钥 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `cmd/server/` | 应用入口 main.go (see `cmd/server/AGENTS.md`) |
| `config/` | 配置加载 (Viper) (see `config/AGENTS.md`) |
| `internal/handler/` | HTTP 处理层 (see `internal/handler/AGENTS.md`) |
| `internal/middleware/` | HTTP 中间件 (see `internal/middleware/AGENTS.md`) |
| `internal/model/` | 数据模型定义 (see `internal/model/AGENTS.md`) |
| `internal/repository/` | 数据访问层 + sqlc 生成代码 (see `internal/repository/AGENTS.md`) |
| `internal/service/` | 业务逻辑层 (see `internal/service/AGENTS.md`) |
| `internal/pkg/` | 内部工具包 (see `internal/pkg/AGENTS.md`) |
| `internal/job/` | 后台任务 (see `internal/job/AGENTS.md`) |
| `migrations/` | PostgreSQL 数据库迁移文件 (33 对 up/down) |
| `scripts/` | 工具脚本 (如 B站 Emoji 爬取) |
| `uploads/` | 文件上传存储目录 |

## For AI Agents

### Working In This Directory
- 启动服务: `go run ./cmd/server`
- 生成 sqlc 代码: `sqlc generate` (配置在 sqlc.yaml)
- 新增 handler 需在对应 service 和 repository 层同步实现
- 路由注册使用 chi v5 router
- JWT 认证使用 ES256 算法 (EC P-256 密钥)
- 配置优先级: 环境变量 > config.yaml > 默认值

### Testing Requirements
- `go test ./...` 运行所有测试
- `go vet ./...` 代码静态检查
- 新增功能必须包含对应的单元测试

### Common Patterns
- 严格分层: handler(参数校验+响应) → service(业务逻辑) → repository(数据访问)
- sqlc 从 `internal/repository/queries/*.sql` 生成 Go 代码到 `internal/repository/generated/`
- 统一响应格式: `internal/pkg/response/` 封装
- 请求验证: `go-playground/validator` + `internal/pkg/validator/`
- 日志: zerolog 结构化日志
- 错误处理: 自定义错误类型 + 分层错误传播

## Dependencies

### Internal
- `web/` - 前端消费者
- `../secrets/` - 生产环境 JWT 密钥

### External
- chi v5 - HTTP 路由
- pgx/v5 - PostgreSQL 驱动
- go-redis/v9 - Redis 客户端
- golang-jwt/v5 - JWT 认证
- spf13/viper - 配置管理
- zerolog - 结构化日志
- resend-go/v2 - 邮件发送
- go-playground/validator - 请求验证
- sqlc - SQL 代码生成

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
