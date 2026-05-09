<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# features

## Purpose
功能模块目录，按业务领域组织。每个子目录包含对应功能的 React Query hooks、API 调用和类型定义。这是前端功能开发的主要工作区。

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `admin/` | 管理后台功能模块 |
| `auth/` | 认证功能 (登录/注册/令牌管理) |
| `comments/` | 评论功能 |
| `emoji-management/` | Emoji 管理功能 |
| `music/` | 音乐功能 |
| `music-player/` | 音乐播放器功能 |
| `playlists/` | 播放列表功能 |
| `posts/` | 文章功能 |
| `projects/` | 项目展示功能 |
| `settings/` | 站点设置功能 |

## Subdirectories Detail (admin/)
| Directory | Purpose |
|-----------|---------|
| `admin/announcements/` | 公告管理 |
| `admin/comments/` | 评论管理 |
| `admin/dashboard/` | 仪表盘 |
| `admin/logs/` | 日志查看 |
| `admin/media/` | 媒体管理 |
| `admin/posts/` | 文章管理 |
| `admin/roles/` | 角色管理 |
| `admin/settings/` | 设置管理 |
| `admin/tags/` | 标签管理 |
| `admin/users/` | 用户管理 |

## For AI Agents

### Working In This Directory
- 新增功能模块: 创建子目录，包含 hooks 和 API 调用
- 每个模块通常包含: useXxxQuery/useXxxMutation hooks
- 使用 TanStack Query v5 的 useQuery/useMutation 封装 API 调用
- API 客户端使用 `../lib/api.ts` 封装的 Axios 实例

### Common Patterns
- 每个功能模块导出 React Query hooks
- mutation hooks 使用 useMutation + optimistic updates
- query keys 集中管理便于缓存失效

## Dependencies

### Internal
- `../lib/api.ts` - API 客户端
- `../types/` - 类型定义

### External
- TanStack Query v5 - 数据获取和缓存

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
