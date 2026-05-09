<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# cmd/server

## Purpose
Go 应用入口点，负责初始化配置、数据库连接、Redis 连接、路由注册和 HTTP 服务启动。

## Key Files
| File | Description |
|------|-------------|
| `main.go` | 应用主入口，组装所有依赖并启动 HTTP 服务 |

## For AI Agents

### Working In This Directory
- 修改服务启动逻辑在此文件
- 路由注册、中间件挂载、依赖注入都在 main.go 中完成
- 新增 handler/service/repository 需在此注册

### Common Patterns
- 依赖注入: 手动构造各层实例并注入
- 优雅关闭: 监听系统信号处理 graceful shutdown

## Dependencies

### Internal
- `config/` - 配置加载
- `internal/handler/` - HTTP 处理器
- `internal/middleware/` - 中间件
- `internal/repository/` - 数据访问
- `internal/service/` - 业务逻辑

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
