<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# internal/service

## Purpose
业务逻辑层，封装所有核心业务规则。每个文件对应一个业务领域，被 handler 层调用，调用 repository 层获取数据。

## Key Files
| File | Description |
|------|-------------|
| `auth_service.go` | 认证业务 (注册/登录/令牌刷新) |
| `auth_types.go` | 认证相关类型定义 |
| `auth_errors.go` | 认证错误定义 |
| `token_service.go` | JWT 令牌生成和验证 |
| `post_service.go` | 文章业务 (CRUD/发布/草稿) |
| `comment_service.go` | 评论业务 |
| `comment_reaction_service.go` | 评论反应业务 |
| `music_service.go` | 音乐业务 |
| `music_search_service.go` | 音乐搜索 |
| `music_playlist_service.go` | 播放列表业务 |
| `music_playlist_admin_service.go` | 播放列表管理 |
| `music_playlist_netease_service.go` | 网易云音乐对接 |
| `music_playlist_tencent_service.go` | QQ 音乐对接 |
| `music_settings_service.go` | 音乐设置 |
| `emoji_service.go` | Emoji 业务 |
| `emoji_query_service.go` | Emoji 查询 |
| `emoji_seed_service.go` | Emoji 种子数据 |
| `emoji_renderer.go` | Emoji 渲染 |
| `project_service.go` | 项目展示业务 |
| `user_service.go` | 用户管理业务 |
| `role_service.go` | 角色管理 |
| `permission_service.go` | 权限管理 |
| `settings_service.go` | 站点设置 |
| `announcement_service.go` | 公告管理 |
| `tag_service.go` | 标签管理 |
| `upload_service.go` | 文件上传 |
| `upload_validator_service.go` | 上传验证 |
| `file_service.go` | 文件管理 |
| `file_storage_service.go` | 文件存储 |
| `email_service.go` | 邮件发送 |
| `github_service.go` | GitHub API 代理 |
| `stats_service.go` | 统计数据 |
| `audit_service.go` | 审计日志 |
| `profile_service.go` | 个人资料 |
| `verification_service.go` | 验证码 |
| `types.go` | 通用类型 |
| `utils.go` | 工具函数 |

## For AI Agents

### Working In This Directory
- 新增业务: 创建 `xxx_service.go`，实现 Service 接口
- 业务错误: 定义明确的错误变量，handler 层映射为 HTTP 状态码
- 跨域调用: 音乐模块对接网易云/QQ音乐外部 API

### Common Patterns
- 接口定义: service 通过接口与 repository 解耦
- 错误包装: 使用 fmt.Errorf("%w", err) 保留错误链
- 外部 API 对接: 音乐搜索/播放列表使用第三方 API

## Dependencies

### Internal
- `../repository/` - 数据访问
- `../model/` - 数据模型
- `../pkg/auth/` - JWT 工具

### External
- resend-go/v2 - 邮件发送
- go-redis/v9 - 缓存

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
