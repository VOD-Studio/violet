<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-06-15 -->

# store

## Purpose
Zustand 状态管理，管理客户端全局状态。主要用于认证状态、文章缓存、侧边栏状态、主题偏好等。

## Key Files
| File | Description |
|------|-------------|
| `index.ts` | Zustand store 导出入口，re-export 各 slice |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `slices/` | Zustand store slices (每个 slice 一个独立 store) |

## Subdirectories Detail (slices/)
| File | Purpose |
|------|---------|
| `auth.ts` | 认证状态 (令牌、用户信息、权限)，使用 persist 中间件持久化 |
| `post.ts` | 文章相关客户端状态 |
| `sidebar.ts` | 侧边栏开关状态 |
| `theme.ts` | 主题 (明/暗/系统) 状态 |

## For AI Agents

### Working In This Directory
- 服务端状态优先使用 TanStack Query (features/)
- 仅客户端 UI 状态使用 Zustand
- 新增 slice 在 `slices/` 下创建，并在 `index.ts` 中 re-export
- 使用 zustand 的 `create` + 中间件 (如 `persist`) 模式

### Common Patterns
- Zustand: `create<State>()(middleware(...))` 创建 store
- 全局状态: 在组件中用 `useXxxStore(selector)` 选择性订阅，避免不必要的重渲染
- 持久化: 用 `persist` 中间件同步到 localStorage

## Dependencies

### External
- Zustand - 轻量级客户端状态管理

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
