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
| UI 组件 | `@violet/ui`（native / Radix 行为、typed BEM recipe 与同源 CSS） |
| 表单 | React Hook Form + Zod |
| 富文本 | TipTap v3 |
| 代码高亮 | Shiki / lowlight |
| 图标 | Lucide React |
| 动效 | GSAP + Motion |
| 检查/格式化 | Biome |
| 测试 | Vitest + React Testing Library |

## 目录结构

前端采用 **Feature-Sliced Design** 组织代码：

```text
web/src/
├── routes/           # TanStack Start 文件路由
├── features/         # 业务模块（每个模块包含 api / ui / hooks / types 等）
├── entities/         # 跨模块复用的领域实体（类型、查询、UI）
├── widgets/          # 页面级组合组件
├── shared/           # 通用基础能力
│   ├── api/          # axios 实例、请求/响应拦截、CSRF、auth 探活
│   ├── ui/           # 站点专用通用件；跨 feature 原语在 packages/ui
│   ├── lib/          # 工具函数
│   ├── config/       # 环境配置与常量
│   ├── server/       # SSR server 端辅助函数
│   └── vendor/       # 外部库本地适配
├── test/             # 测试配置与 setup
├── router.tsx        # 路由器入口
├── styles.css        # 全局样式唯一入口（只负责导入）
└── styles/           # 站点方言 / 基础行为 / 转场（基础 token 与 theme 映射在 packages/ui）
```

`src/routeTree.gen.ts` 是文件路由的本地生成物，不纳入 Git，也不从宿主复制进镜像或开发容器；只修改 `src/routes/` 下的路由源码，不手动编辑或提交生成文件。

- `pnpm generate-routes` 直接执行官方 `tsr generate`，不加载 Vite 配置或启动开发服务器。
- `pnpm dev`、`pnpm typecheck`、`pnpm test`、`pnpm build` 和 `pnpm build:analyze` 都先执行路由生成。CI 与 Docker 使用这些项目命令，不绕过前置步骤直接调用 `vite build`。
- 应用的 SSR 与路由类型在 `src/router.tsx` 显式登记，不依赖 CLI 生成物携带 Start 专属声明；开发期路由监听与最终 SSR 构建仍由 TanStack Start 插件处理。
- 缺少根路由、路由冲突等首次生成错误会以非零退出码中止生成、校验或构建；已有旧生成文件也不会被判为成功。

旧分支需同步这项跟踪规则变更；切换到仍跟踪生成文件的历史分支时，Git 仍会按旧规则管理它。

## 模块要点

- **@violet/ui**：通用 UI workspace 包，单元放在 `packages/ui/src/components/<name>/`，`component-manifest.json` 管理公开入口与 foundation / legacy 成熟度。`/ui` 文档站与组件预览、复制源码同源。包内规范见 [packages/ui/docs/](packages/ui/docs/architecture.md)。
- **音乐播放器**：`src/features/music-player/` 接入 `@violetjs/kite-player@0.3.0`；后台展示歌单驱动队列，进入工具页暂停。桌面默认靠左，宿主仅设置按钮颜色与布局，不覆盖播放器原生外观和动效；媒体源使用本站 `/stream` 302，不批量预取 CDN 地址。
- **上传**：`features/upload/` 提供分片上传、会话续传与按在途文件数的批量调度；429 保留原始 `Retry-After`。`CropUploadDialog` 的确认回调支持异步保存，失败时保留图片与选区重试。
- **自定义表情**：评论、推文与聊天共用 `features/customemoji` 的表情选择器；上传与收藏合并在同一网格。
- **代码运行器**：`entities/code-runner/` 提供编辑器与阅读器共用的运行器 API；执行能力由应用层注入，读取失败或语言被禁时保留源码并显示原因。
- **评论区**：共享评论区通过 `renderAuthorName` / `renderAvatar` 插槽扩展作者展示；回复标注按实际 `parent_id` 判断。
- **AI 署名**：`entities/comment/` 解析 AI 自署名、头像与角色简介，名称与头像复用站点 `CartoonPopover` 展示。

播放器升级时同步 `pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 精确版本；容器安装保留其余依赖的 24 小时发布冷却期。

## 文章编辑与阅读

源码模式与富文本维护同一份文档，保存和 `.md` 导出无需先退出源码。编辑器支持脚注新建、编辑与重复引用；GitHub 五类提示块与原生折叠块支持 Slash 插入与源码往返。项目路线图可从 Slash 菜单插入卡片、看板或关系画布，读取阅读时的当前数据。

Mermaid 图块统一使用手写字体与 `@violetjs/inkline` 笔触渲染，编辑器预览与阅读端同源；字体仅在图块出现时加载，SVG 导出内嵌字体与版权通知。语法和格式边界见[编辑器手册](src/features/editor/docs/README.md)（站内渲染于 `/editor-guide`）。

## 独立包演示页

- [`/inkline`](packages/inkline/README.md)：`src/features/inkline-workbench/` 一屏式工作台，直接使用包内 `examples/` 场景，导出走 `@violetjs/inkline/export`。
- [`/tweets`](packages/react-tweet/README.md)：文章嵌入、X 快照与推文时间线共用 `@violetjs/react-tweet`；站内互动与权限由 `features/tweets` 管理。
- [`/kanban`](packages/kanban/README.zh-CN.md)：项目路线图画布使用 `@violetjs/kanban`；演示原样渲染包内 `examples/`，API 正文读取包内 `docs/api.md`。

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
pnpm generate-routes     # 通过 Start 插件重新生成文件路由和 SSR 类型

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

本项目使用 **TanStack Router 文件路由**。在 `src/routes/` 下新增 `.tsx` 文件即可自动生成路由。主要路由：

| 路由 | 说明 |
|------|------|
| `/` | 首页 |
| `/blog/:slug` | 文章详情（目录、批注、内容卡片、路线图嵌入、可选作者落款） |
| `/blog/archive` | 文章归档 |
| `/notes`、`/notes/:id` | 公开笔记流（游标分页 + 标签筛选）与详情 |
| `/galleries`、`/galleries/:slug` | 公开图集浏览流与稳定地址详情 |
| `/tweets` | 推文时间线与 X 转发 |
| `/projects`、`/projects/:slug` | 项目列表与路线图详情（画布/阶段切换、筛选、管理员拖动，详见 [PRD-0036](../docs/prd/0036-项目路线图.md)） |
| `/chat` | 登录用户的私聊与私有房间工作区 |
| `/users/:username` | 公开主页 |
| `/profile` | 本人资料与账户安全设置 |
| `/login`、`/register`、`/forgot-password` | 认证 |
| `/ui`、`/kanban`、`/inkline` | 组件库与独立包的文档、演示页 |
| `/pet` | 电子宠物演示（WebAssembly 规则核心；需并排检出 [kodama](https://github.com/VOD-Studio/kodama) 并执行 `pnpm pet:sync`） |
| `/admin/*` | 后台管理（文章/评论/媒体/用户/角色权限/友链/审计日志/MCP/订阅/设置等） |

路由配置入口：`src/router.tsx`。根布局：`src/routes/__root.tsx`。

## 状态管理

- **TanStack Query**：服务端状态（文章、评论、媒体等）缓存、失效、重试。
- **Zustand**：客户端全局状态（播放器、主题、编辑器临时状态等）。

SSR 的 `getRouter()` 每请求创建独立 QueryClient，浏览器复用 `clientQueryClient`；QueryClientProvider 由 Router 统一装配。已显示的 SSR 内容不因客户端接管退回骨架。

## API 与认证

- 开发环境通过 Vite 反向代理将 `/api/*` 与 `/uploads/*` 转发到后端 `http://localhost:9090`，避免跨域与 CSRF 边界问题。
- 后端认证采用 **opaque session cookie**：
  - `violet_session`：HttpOnly session id
  - `violet_csrf`：CSRF token，写请求需回传 `X-CSRF-Token`
  - `violet_uid`：前端可读 user id
- SSR 场景只读 `/auth/session` 探活，不续期、不写 cookie。

API 基础配置见 `src/shared/api/`。

## 样式

- Tailwind CSS v4，`src/styles.css` 是全局入口；基础语义 token、默认色板和 Tailwind 映射归 `packages/ui/src/styles/`，站点视觉方言、基础行为和转场归 `src/styles/`。
- 通用组件的结构、recipe、CSS 与测试放 `packages/ui/src/components/<name>/`；站点 feature 样式放组件旁 `*.module.css`。
- 主题 token 分层：组件库基础语义在 `packages/ui/src/styles/`，站点方言在 `src/styles/dialects/`。公开页面挂 `.dialect-public`、工具界面挂 `.dialect-tool`、沉浸舞台挂 `.dialect-immersive`；页面消费 semantic token，不直接绑定色值。
- 支持 v4 任意值简写（如 `max-w-50`）。
- 暗色/亮色主题通过 `next-themes` 管理。

## 测试

```bash
pnpm test            # Vitest 单元测试（jsdom）
pnpm test:contract   # 主题浏览器契约（Playwright，需先 pnpm build）
```

- 测试文件：`src/**/*.test.{ts,tsx}`；setup：`src/test/setup.ts`。
- 浏览器契约覆盖组件库文档、看板文档、编辑器路线图入口、路线图筛选与 SSR 首访连续性等交互。
- 需要客户端交互的用例通过 `e2e/support.ts` 的 `openClientPage` 导航：先等待 `/auth/me` 探活响应，再点击、拖拽或发送键盘事件。SSR 文本可见不代表事件监听已挂载。

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

生产环境使用 `server.mjs`（srvx 桥接）作为 Node.js SSR 入口，经外部 nginx-proxy 反代对外提供服务。详见根目录 README「生产部署」章节。

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
