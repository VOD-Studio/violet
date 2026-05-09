<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# pages

## Purpose
页面级组件目录，每个子目录/文件对应一个路由页面。包含前端展示页面和管理后台页面。

## Key Files
| File | Description |
|------|-------------|
| `Login.tsx` | 登录页面 |
| `Register.tsx` | 注册页面 |
| `VerifyEmail.tsx` | 邮箱验证页面 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `Home/` | 首页 |
| `About/` | 关于页 |
| `Music/` | 音乐页 |
| `Projects/` | 项目展示页 |
| `blog/` | 博客页面 (文章列表、文章详情) |
| `admin/` | 管理后台页面集 |
| `profile/` | 个人资料页 |

## Subdirectories Detail (admin/)
| File/Dir | Purpose |
|----------|---------|
| `index.tsx` | 管理后台布局/入口 |
| `components/` | 管理后台页面级共享组件 |
| `slug/` | URL slug 管理 |
| `Announcements.tsx` | 公告管理页 |
| `Comments.tsx` | 评论管理页 |
| `Dashboard/` | 仪表盘页 |
| `Emojis/` | Emoji 管理页 |
| `Logs.tsx` | 日志页 |
| `Media.tsx` / `MediaCard.tsx` | 媒体管理页 |
| `Playlists.tsx` | 播放列表管理页 |
| `Post/` | 文章编辑页 |
| `Projects.tsx` | 项目管理页 |
| `Roles.tsx` | 角色管理页 |
| `Settings/` | 设置页 |
| `Tags.tsx` | 标签管理页 |
| `Users.tsx` | 用户管理页 |

## For AI Agents

### Working In This Directory
- 新增页面: 创建子目录或文件，在 `../App.tsx` 注册路由
- 页面组件负责组合 features/ 的 hooks 和 components/ 的 UI 组件
- 管理后台页面放在 admin/ 下

### Common Patterns
- 页面组件组装 features hooks + components UI
- 路由参数通过 React Router useParams 获取
- SEO 相关: 部分页面有 meta 信息配置

## Dependencies

### Internal
- `../features/` - 功能 hooks
- `../components/` - UI 组件
- `../hooks/` - 通用 hooks

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
