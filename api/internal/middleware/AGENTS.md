<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# internal/middleware

## Purpose
HTTP 中间件层，处理横切关注点：认证、CORS、日志、限流、安全头、错误恢复。

## Key Files
| File | Description |
|------|-------------|
| `auth.go` | JWT 认证中间件，解析令牌并注入用户信息到 context |
| `cors.go` | 跨域资源共享配置 |
| `logger.go` | 请求日志中间件 (zerolog) |
| `ratelimit.go` | IP 限流中间件 (基于 Redis) |
| `recoverer.go` | panic 恢复中间件 |
| `security.go` | 安全头中间件 (X-Frame-Options, CSP 等) |
| `utils.go` | 中间件工具函数 |

## For AI Agents

### Working In This Directory
- 新增中间件: 实现 `func(http.Handler) http.Handler` 接口
- 在 cmd/server/main.go 中注册到路由链
- 中间件顺序影响行为：先注册先执行

### Common Patterns
- chi 中间件签名: `func(next http.Handler) http.Handler`
- 认证中间件从 JWT 提取用户信息存入 context
- 限流使用 Redis 滑动窗口

## Dependencies

### Internal
- `../pkg/auth/` - JWT 令牌解析

### External
- go-redis/v9 - 限流计数
- zerolog - 请求日志

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
