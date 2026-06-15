# mimo-blog 前端

博客平台 Web 前端应用，基于 React 19 + Vite + TypeScript 构建。

## 技术栈

| 类别 | 选型 |
|------|------|
| UI 框架 | React 19 |
| 构建工具 | Vite |
| 语言 | TypeScript |
| 路由 | React Router v7 |
| 状态管理 | Zustand（客户端状态） + TanStack Query v5（服务端状态） |
| UI 原语 | Radix UI / Base UI（shadcn 风格组件） |
| 样式 | Tailwind CSS v4 + CVA |
| 表单 | React Hook Form + Zod |
| 富文本 | TipTap |
| HTTP | Axios |
| 代码检查 | Biome（非 ESLint/Prettier） |

## 目录结构

```
src/
├── components/   通用组件与业务复用组件
│   ├── ui/       shadcn 基础组件
│   ├── shared/   跨功能复用组件
│   ├── layout/   布局组件 (Header/Footer/Layout)
│   └── editor/   TipTap 富文本编辑器
├── features/     feature-sliced 业务模块 (api/queryKeys/types/组件)
├── pages/        路由级页面组件
├── hooks/        全局自定义 hooks
├── lib/          工具函数与第三方库封装 (api/env/utils/seo)
├── store/        Zustand store (slices/)
├── types/        全局 TypeScript 类型定义
└── middleware/   路由中间件 (认证守卫)
```

## 开发

```bash
# 安装依赖 (推荐 pnpm，也可用 npm)
pnpm install

# 启动开发服务器 (http://localhost:5173)
pnpm dev

# 类型检查
pnpm typecheck

# 代码检查与格式化 (Biome)
pnpm lint           # 检查
pnpm format         # 格式化

# 构建生产版本
pnpm build
pnpm preview        # 预览构建结果
```

## 环境变量

复制 `.env.example` 为 `.env` 并按需修改。所有变量必须以 `VITE_` 前缀：

| 变量 | 说明 |
|------|------|
| `VITE_API_URL` | 后端 API 地址 |
| `VITE_GITHUB_TOKEN` | GitHub Token（用于贡献数据） |
| `VITE_ENABLE_ANALYTICS` | 启用站点分析 |

缺失必需变量时，应用会在启动时通过 `src/lib/env.ts` 的 `requireEnv()` 抛错。

## 架构说明

- **状态管理边界**：Zustand 管理客户端 UI 状态（认证、主题、侧边栏）；TanStack Query 管理所有服务端数据获取与缓存。
- **feature-sliced**：每个业务模块自带 `api.ts` + `queryKeys.ts` + `types.ts` 三件套。
- **权限守卫**：`src/middleware/auth.ts` 提供路由级认证检查；组件级权限使用 `PermissionGuard`。

更多细节参见各子目录下的 `AGENTS.md`。
