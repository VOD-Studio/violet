# violet / web

博客平台前端应用，基于 **TanStack Start** 构建，支持 SSR/SSG、文件路由与 Server Function。

## 技术栈

| 类别 | 选型 |
|------|------|
| 框架 | React 19 + TypeScript (strict) |
| 全栈框架 | TanStack Start |
| 构建工具 | Vite 8 |
| 路由 | TanStack Router（文件路由） |
| 状态管理 | Zustand + TanStack Query v5 |
| 样式 | Tailwind CSS v4 |
| UI 组件 | Radix UI + shadcn/ui 风格 |
| 表单 | React Hook Form + Zod |
| 富文本 | TipTap v3 |
| 代码高亮 | Shiki / lowlight |
| 图标 | Lucide React |
| 动效 | GSAP + Motion |
| 检查/格式化 | Biome |
| 测试 | Vitest + React Testing Library |

## 目录结构

前端采用 **Feature-Sliced Design** 组织代码：

```
web/src/
├── routes/           # TanStack Start 文件路由
├── features/         # 业务模块（每个模块包含 api / ui / hooks / types 等）
├── entities/         # 跨模块复用的领域实体（类型、查询、UI）
├── widgets/          # 页面级组合组件
├── shared/           # 通用基础能力
│   ├── api/          # axios 实例、请求/响应拦截、CSRF、auth 探活
│   ├── ui/           # 通用 UI 组件
│   ├── lib/          # 工具函数
│   ├── config/       # 环境配置与常量
│   ├── server/       # SSR server 端辅助函数
│   └── vendor/       # 外部库本地适配
├── test/             # 测试配置与 setup
├── router.tsx        # 路由器入口
└── styles.css        # 全局样式与 Tailwind 入口
```

## 开发环境

项目使用 **pnpm** 作为包管理器，请勿使用 npm 或 yarn。

```bash
# 安装依赖
pnpm install

# 启动开发服务器（默认 http://localhost:5173）
pnpm dev
```

更推荐从项目根目录使用 `make` 一键管理：

```bash
make install      # 安装前后端依赖
make setup        # 初始化 .env、数据库迁移
make dev          # 同时启动 API + Web + Postgres + Redis
```

## 常用命令

```bash
# 开发
pnpm dev                 # 启动 Vite 开发服务器
pnpm generate-routes     # 重新生成文件路由 (tsr generate)

# 构建
pnpm build               # 生产构建
pnpm preview             # 预览生产构建

# 代码质量
pnpm lint                # Biome lint
pnpm format              # Biome format
pnpm check               # Biome lint + format 检查
pnpm typecheck           # TypeScript 类型检查（tsc --noEmit）

# 测试
pnpm test                # 运行 Vitest 单元测试

# 静态资源
pnpm sync:pdf-worker     # 同步 pdfjs worker 到 public/（postinstall 已自动执行）
```

## 路由

本项目使用 **TanStack Router 文件路由**。在 `src/routes/` 下新增 `.tsx` 文件即可自动生成路由。

主要路由：

| 路由 | 说明 |
|------|------|
| `/` | 首页/文章列表 |
| `/blog/:slug` | 文章详情 |
| `/blog/archive` | 文章归档 |
| `/announcements/:id` | 公告详情 |
| `/projects` | 项目展示 |
| `/friends` | 友链页 |
| `/about` | 关于页 |
| `/profile` | 个人资料 |
| `/login`, `/register`, `/forgot-password` | 认证 |
| `/changelog` | 更新日志 |
| `/admin/*` | 后台管理（文章/评论/媒体/用户/角色权限/友链/审计日志/MCP/订阅/设置等） |

路由配置入口：`src/router.tsx`。根布局：`src/routes/__root.tsx`。

## 状态管理

- **TanStack Query**：服务端状态（文章、评论、媒体等）缓存、失效、重试。
- **Zustand**：客户端全局状态（播放器、主题、编辑器临时状态等）。

## API 与认证

- 开发环境通过 Vite 反向代理将 `/api/*` 与 `/uploads/*` 转发到后端 `http://localhost:9090`，避免跨域与 CSRF 边界问题。
- 后端认证采用 **opaque session cookie**：
  - `violet_session`：HttpOnly session id
  - `violet_csrf`：CSRF token，写请求需回传 `X-CSRF-Token`
  - `violet_uid`：前端可读 user id
- SSR 场景只读 `/auth/session` 探活，不续期、不写 cookie。

API 基础配置见 `src/shared/api/`。

## 样式

- Tailwind CSS v4，入口 `src/styles.css`。
- 支持 v4 任意值简写（如 `max-w-50`）。
- 暗色/亮色主题通过 `next-themes` 管理。

## 测试

```bash
pnpm test
```

- 测试文件：`src/**/*.test.{ts,tsx}`
- 环境：jsdom
- setup：`src/test/setup.ts`

## 环境变量

开发环境复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

| 变量 | 说明 |
|------|------|
| `VITE_API_BASE_URL` | 浏览器端 API 基础路径（默认 `/api/v1`） |
| `VITE_API_PROXY_TARGET` | dev 反向代理目标（默认 `http://localhost:9090`） |
| `VITE_SSR_API_BASE_URL` | SSR 服务端直连后端地址 |
| `VITE_SITE_URL` | 前端对外地址（用于 SEO/OpenGraph） |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `VITE_GITHUB_CLIENT_ID` | GitHub OAuth Client ID |

## 构建与部署

```bash
# 生产构建
pnpm build

# 或从根目录
make web-build
make build          # 前后端一起构建
```

生产环境使用 `server.mjs`（srvx 桥接）作为 Node.js SSR 入口，经外部 nginx-proxy 反代对外提供服务（线上 xunrua.top）。详见根目录 README「生产部署」章节。

## 代码规范

- 缩进：tab（biome.json / .editorconfig 统一为 tab 4）
- 换行符：LF
- 格式化 + Lint：Biome（`pnpm check`，`make web-format` 可自动修复）
- 类型检查：`pnpm typecheck`（strict 模式）

Git 钩子会在提交前检查前端 biome 规则，可通过根目录 `scripts/install-hooks.sh` 安装。

## 相关文档

- [项目总览](../README.md)
- [项目级代理规范与开发须知](../AGENTS.md)
- [后端说明](../api/README.md)
- [贡献指南](../CONTRIBUTING.md)
