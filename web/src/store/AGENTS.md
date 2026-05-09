<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# store

## Purpose
Redux 状态管理，管理客户端全局状态。主要用于音乐播放器状态、侧边栏状态、主题偏好和文章缓存等。

## Key Files
| File | Description |
|------|-------------|
| `index.ts` | Redux store 配置和创建 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `slices/` | Redux Toolkit slices |

## Subdirectories Detail (slices/)
| File | Purpose |
|------|---------|
| `auth.ts` | 认证状态 (令牌、用户信息) |
| `post.ts` | 文章相关客户端状态 |
| `sidebar.ts` | 侧边栏开关状态 |
| `theme.ts` | 主题 (明/暗/系统) 状态 |

## For AI Agents

### Working In This Directory
- 服务端状态优先使用 TanStack Query (features/)
- 仅客户端 UI 状态使用 Redux
- 新增 slice 在 `slices/` 下创建，在 `index.ts` 注册

### Common Patterns
- Redux Toolkit: createSlice + createAsyncThunk
- 全局状态: store 中用 useSelector/useDispatch 读写

## Dependencies

### External
- Redux Toolkit - 状态管理

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
