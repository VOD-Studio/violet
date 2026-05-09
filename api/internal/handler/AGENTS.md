<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# internal/handler

## Purpose
HTTP 处理层，负责请求参数解析、校验、调用 service 层、封装 HTTP 响应。每个文件对应一个业务领域的 HTTP 端点。

## Key Files
| File | Description |
|------|-------------|
| `auth.go` | 认证端点 (注册/登录/刷新令牌/邮箱验证) |
| `post.go` | 文章 CRUD 端点 |
| `comment.go` | 评论 CRUD 端点 |
| `comment_reaction.go` | 评论反应端点 |
| `music.go` | 音乐播放端点 |
| `music_admin.go` | 音乐管理端点 |
| `emoji.go` | Emoji 管理端点 |
| `project.go` | 项目展示端点 |
| `media.go` | 媒体管理端点 |
| `upload.go` | 文件上传端点 |
| `user_management.go` | 用户管理端点 |
| `role.go` | 角色管理端点 |
| `permission.go` | 权限管理端点 |
| `settings.go` | 站点设置端点 |
| `announcement.go` | 公告管理端点 |
| `tag.go` | 标签管理端点 |
| `admin.go` | 管理后台统计端点 |
| `audit.go` | 审计日志端点 |
| `github.go` | GitHub 代理端点 |
| `request_utils.go` | 请求处理工具函数 |

## For AI Agents

### Working In This Directory
- 新增端点: 创建对应文件，实现 handler 函数，在 cmd/server/main.go 注册路由
- 请求校验: 使用 go-playground/validator 标签
- 响应封装: 使用 `pkg/response` 的 Success/Error 方法
- 请求解析: 使用 `request_utils.go` 中的辅助函数

### Common Patterns
- 每个 handler 接收 chi 路由参数
- 统一错误码和 HTTP 状态码映射
- 文件上传使用 multipart form 解析

## Dependencies

### Internal
- `../service/` - 业务逻辑调用
- `../model/` - 请求/响应数据结构
- `../pkg/response/` - 响应封装
- `../pkg/request/` - 请求解析
- `../pkg/validator/` - 参数校验

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
