<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# internal/pkg

## Purpose
内部工具包，提供跨层复用的通用功能：API 错误码、认证、分页、请求/响应封装、参数校验。

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `apierr/` | API 错误码定义 |
| `auth/` | JWT 令牌生成/解析工具 |
| `pagination/` | 分页参数和响应封装 |
| `request/` | 请求解析工具 |
| `response/` | HTTP 响应封装 (JSON 统一格式) |
| `validator/` | 参数校验工具 |

## For AI Agents

### Working In This Directory
- 这些包被 handler/service/middleware 广泛引用
- 修改工具包需注意向后兼容
- 新增通用工具在此添加

### Common Patterns
- response 包: Success/Error 统一 JSON 响应格式
- auth 包: ParseToken/GenerateToken JWT 操作
- pagination 包: 标准化分页参数解析
- apierr 包: 集中定义 API 错误码和消息

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
