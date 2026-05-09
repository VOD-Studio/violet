<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# hooks

## Purpose
自定义 React Hooks，封装可复用的有状态逻辑。包括认证、防抖、Emoji、文件上传、GitHub、无限滚动、权限、主题等通用 hooks。

## Key Files
| File | Description |
|------|-------------|
| `useAuth.ts` | 认证状态和操作 (登录/登出/当前用户) |
| `useDebounce.ts` | 防抖 hook |
| `useEmojis.ts` | Emoji 数据获取 |
| `useEmojisAdmin.ts` | Emoji 管理操作 |
| `useFileUpload.ts` | 文件上传逻辑 |
| `useGitHub.ts` | GitHub API 数据获取 |
| `useInfiniteScroll.ts` | 无限滚动加载 |
| `usePermission.ts` | 权限检查 |
| `usePosts.ts` | 文章数据获取 |
| `useReducedMotion.ts` | 减少动画偏好检测 |
| `useTags.ts` | 标签数据获取 |
| `useTheme.ts` | 主题切换 (明/暗模式) |

## For AI Agents

### Working In This Directory
- 新增通用 hook: 创建 `useXxx.ts` 文件
- 领域特定 hooks 放在 `../features/xxx/` 下
- 此目录仅放跨功能复用的 hooks

### Common Patterns
- 使用 TanStack Query 的 useQuery/useMutation
- 状态管理使用 React useState/useReducer
- 返回 [state, actions] 或对象解构模式

## Dependencies

### Internal
- `../lib/api.ts` - API 调用
- `../store/` - Redux store

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
