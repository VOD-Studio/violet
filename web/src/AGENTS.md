<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# src

## Purpose
React 前端源代码目录，包含所有组件、页面、hooks、状态管理、类型定义和应用基础设施。

## Key Files
| File | Description |
|------|-------------|
| `App.tsx` | 应用主组件，路由配置和全局 Provider 包裹 |
| `main.tsx` | 应用挂载入口，渲染根组件 |
| `index.css` | 全局样式，Tailwind CSS 入口 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `components/` | React 组件 (按功能分类) (see `components/AGENTS.md`) |
| `features/` | 功能模块 (按领域划分) (see `features/AGENTS.md`) |
| `pages/` | 页面级组件 (see `pages/AGENTS.md`) |
| `hooks/` | 自定义 React Hooks (see `hooks/AGENTS.md`) |
| `lib/` | 工具函数和第三方封装 (see `lib/AGENTS.md`) |
| `store/` | Redux store 和 slices (see `store/AGENTS.md`) |
| `types/` | TypeScript 类型定义 (see `types/AGENTS.md`) |
| `styles/` | 额外 CSS 样式 (see `styles/AGENTS.md`) |
| `middleware/` | 路由中间件 (认证守卫等) |
| `assets/` | 静态资源文件 |

## For AI Agents

### Working In This Directory
- 新增页面: 在 pages/ 创建，在 App.tsx 注册路由
- 新增功能: 在 features/ 下创建模块，包含 hooks 和组件
- 新增通用组件: 在 components/ 下对应分类中创建
- API 调用: 使用 `lib/api.ts` 封装的 Axios 实例

### Common Patterns
- 功能模块化: features/ 下按领域组织 hooks 和组件
- 服务端状态: TanStack Query (useQuery/useMutation)
- 客户端状态: Redux (store/) 用于全局状态如播放器
- 路由: React Router v7 (在 App.tsx 配置)

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
