<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# web

## Purpose
React 前端应用，博客平台的用户界面。支持文章浏览/编辑、音乐播放、评论互动、Emoji 表情、项目管理、管理后台等功能。使用 Vite 构建，Tailwind CSS v4 样式，Biome 代码检查。

## Key Files
| File | Description |
|------|-------------|
| `package.json` | 项目依赖和脚本配置 |
| `vite.config.ts` | Vite 构建配置 |
| `tsconfig.json` | TypeScript 配置 |
| `biome.json` | Biome 代码检查/格式化配置 |
| `index.html` | 应用入口 HTML |
| `src/App.tsx` | React 应用主组件 |
| `src/main.tsx` | 应用挂载入口 |
| `src/index.css` | 全局样式 (Tailwind 入口) |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `public/` | 静态资源 (favicon, icons) |
| `src/components/` | React 组件 (按功能分类) (see `src/components/AGENTS.md`) |
| `src/features/` | 功能模块 (按领域划分) (see `src/features/AGENTS.md`) |
| `src/pages/` | 页面级组件 (see `src/pages/AGENTS.md`) |
| `src/hooks/` | 自定义 React Hooks (see `src/hooks/AGENTS.md`) |
| `src/lib/` | 工具函数和第三方库封装 (see `src/lib/AGENTS.md`) |
| `src/store/` | Redux store 配置 (see `src/store/AGENTS.md`) |
| `src/types/` | TypeScript 类型定义 (see `src/types/AGENTS.md`) |
| `src/styles/` | CSS 样式文件 (see `src/styles/AGENTS.md`) |
| `src/middleware/` | 路由中间件 (认证守卫) |
| `src/assets/` | 静态资源文件 |

## For AI Agents

### Working In This Directory
- 启动开发: `npm run dev`
- 构建: `npm run build`
- 代码检查: `npx biome check .` (非 ESLint)
- 格式化: `npx biome format --write .`
- 类型检查: `npx tsc --noEmit`
- **Tailwind CSS v4**: 支持任意数字值写法，如 `max-w-50` = 200px (数值×4px)，无需 `[]` 语法

### Testing Requirements
- `npm run build` 确保 TypeScript 编译通过
- `npx biome check .` 确保代码规范
- `npx tsc --noEmit` 类型检查

### Common Patterns
- 数据获取: TanStack Query v5 (useQuery/useMutation)
- 状态管理: Redux (全局状态) + React Query (服务端状态)
- 表单处理: React Hook Form + Zod 验证
- HTTP 客户端: Axios (封装在 `src/lib/api.ts`)
- 组件样式: Tailwind CSS v4 + CVA (class-variance-authority)
- UI 组件: Radix UI + Base UI 原语组件
- 富文本编辑: TipTap 编辑器
- 音乐播放: APlayer

## Dependencies

### Internal
- `../api/` - 后端 API 服务

### External
- React 19 - UI 框架
- Vite - 构建工具
- Tailwind CSS v4 - 样式系统
- TanStack Query v5 - 服务端状态管理
- Radix UI / Base UI - 无障碍 UI 原语
- TipTap - 富文本编辑器
- Biome - 代码检查和格式化
- Axios - HTTP 客户端
- React Hook Form + Zod - 表单处理
- Lucide React - 图标库
- APlayer - 音乐播放器

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
