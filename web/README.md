# Violet Web

Violet 的 React 前端，使用 TanStack Start 提供 SSR 与文件路由。站点代码位于 `src/`，可复用组件包位于 `packages/`；两者在同一 pnpm workspace 中开发。

[快速开始](#快速开始) · [环境变量](#环境变量) · [路由](#路由) · [数据与认证](#数据与认证) · [样式与组件](#样式与组件) · [项目结构](#项目结构)

## 快速开始

本机开发需要 Node.js 22.12+ 和 pnpm 11。前端依赖 Go API；后端尚未启动时，先按[后端 README](../api/README.md#快速开始)准备。

使用整套容器环境时，在仓库根先运行 `make env` 并配置根 `.env`，再运行 `make docker-dev`；这条路径不要求本机安装 Go 或 Node.js。

只在本机运行前端时，从仓库根进入 `web/`：

```bash
cd web
pnpm install
```

首次配置将 [`.env.example`](.env.example) 复制为 `web/.env`；已有 `.env` 或 `.env.local` 时直接核对现有配置，不要覆盖。后端在本机 `:9090` 时可使用模板默认地址。

```bash
pnpm dev
```

访问 <http://localhost:5173>。**本文件后续 pnpm 命令均在 `web/` 执行**；Make 命令在仓库根执行。不要让本机 Vite 与 Compose 的 Web 容器同时占用 5173。

## 环境变量

浏览器请求和 SSR 请求走不同链路：浏览器使用同源路径，经 Vite / 生产反向代理转发；SSR 直接访问后端。更换 API 地址时，应同时核对代理目标和 SSR 地址。

| 变量 | 用途 | 本地示例 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 浏览器 API 基础路径 | `/api/v1` |
| `VITE_API_PROXY_TARGET` | Vite 转发 `/api`、`/uploads` 的目标，不含 API 前缀 | `http://localhost:9090` |
| `VITE_SSR_API_BASE_URL` | SSR 直连 API 的完整基础地址 | `http://localhost:9090/api/v1` |
| `VITE_SITE_URL` | SEO 与 OpenGraph 使用的站点地址 | `http://localhost:5173` |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth 的公开 Client ID | 按应用配置 |
| `VITE_GITHUB_CLIENT_ID` | GitHub OAuth 的公开 Client ID | 按应用配置 |

`VITE_` 配置可能进入浏览器构建产物，**不能放客户端密钥、PAT、站点音乐凭据或数据库密码**。SSR 的 API 地址优先读取 Node 进程中的 `VITE_SSR_API_BASE_URL`，可在运行时覆盖；浏览器端配置随构建固定。开发环境变更后重启 Vite。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动 Vite 开发服务 |
| `pnpm generate-routes` | 通过官方 `tsr generate` 生成路由树 |
| `pnpm typecheck` | 生成路由后执行 TypeScript 检查 |
| `pnpm check` | Biome 代码与格式检查 |
| `pnpm format --write .` | 写入 Biome 格式化结果 |
| `pnpm test` | 生成路由后执行 Vitest |
| `pnpm test:contract` | 执行 Playwright 浏览器契约 |
| `pnpm build` | 生成路由，构建客户端与 SSR 服务端 |
| `pnpm build:analyze` | 构建并输出体积分析报告 |

脚本定义在 [package.json](package.json)。不要直接调用 `vite build` 绕过项目脚本的路由生成步骤。

## 路由

路由文件在 [src/routes/](src/routes/)，应用路由器在 [src/router.tsx](src/router.tsx)，根布局在 [src/routes/__root.tsx](src/routes/__root.tsx)。路由层组合页面、加载数据和处理访问条件；主要业务实现放在 feature 中。

`src/routeTree.gen.ts` 是本地生成物，不提交 Git，也不复制进开发容器。只修改路由源文件，再运行 `pnpm generate-routes`；开发时的路由监听由 Start 插件处理。缺少根路由或路由冲突会让生成命令失败，不能用旧生成物继续构建。SSR 类型在 `router.tsx` 显式登记，不依赖 CLI 附加声明。

### 页面入口

| 路由 | 页面 |
| --- | --- |
| `/` | 首页与发布物入口 |
| `/blog`、`/blog/:slug`、`/blog/archive` | 文章列表、阅读与归档 |
| `/series`、`/series/:slug` | 系列书架与连续阅读 |
| `/notes`、`/notes/:id` | 笔记流与详情 |
| `/galleries`、`/galleries/:slug` | 图集流与详情 |
| `/tweets`、`/tweets/:id` | 推文时间线与讨论 |
| `/projects`、`/projects/:slug` | 项目与路线图 |
| `/chat` | 私聊、房间与 Bot 会话 |
| `/users/:username`、`/profile` | 公开主页与本人资料 |
| `/persona`、`/about`、`/friends`、`/changelog` | 人设、关于、友链与更新日志 |
| `/login`、`/register`、`/forgot-password` | 认证流程 |
| `/admin/*` | 内容与站点管理 |
| `/editor-guide`、`/ui`、`/kanban`、`/inkline` | 编辑器手册、组件与工具文档 |
| `/pet` | 电子宠物演示 |

`/pet` 的 SDK 不入库；开发该页面时需准备 [kodama](https://github.com/VOD-Studio/kodama)，再执行 `pnpm pet:sync`。脚本默认读取并排检出的仓库，也可通过 `PET_REPO` 指定。

## 数据与认证

### SSR 与查询缓存

TanStack Query 管理服务端数据。`getRouter()` 在服务端为每次请求创建独立 QueryClient，浏览器复用 `clientQueryClient`；Router 负责将服务端查询结果交给客户端，不在其他 Provider 里再建一份缓存。

Zustand 用于需要跨组件共享的客户端交互状态，不替代服务端查询。修改数据后使用所属模块的查询键失效缓存。已展示的 SSR 正文不应在客户端接管或后台刷新时退回骨架。

### HTTP 与会话

[shared/api/http.ts](src/shared/api/http.ts) 集中配置 API 地址、Cookie、CSRF、错误翻译与响应解包：业务代码使用解包后的 `data` / `pagination`，不重复处理后端信封。SSR 请求转发 Cookie 时创建当前请求专用的客户端，不把用户凭据写进进程共享实例。

| Cookie | 前端处理 |
| --- | --- |
| `violet_session` | HttpOnly，由浏览器发送，不在脚本中读取 |
| `violet_csrf` | 写请求由 HTTP 客户端回传 `X-CSRF-Token` |
| `violet_uid` | 可读用户标识，不作为权限判断依据 |

SSR 通过 `/auth/session` 只读探活，不续期、不写 Cookie。客户端会话查询、登录弹窗及失效处理复用 `shared/api/` 与 `features/auth/`，不要在单个页面另做一套登录状态。

## 模块定位

开发时先区分页面装配、业务功能和共享能力，再找对应目录。下表是常用入口，不是逐控件行为清单。

| 改动范围 | 主要位置（`src/` 下） |
| --- | --- |
| 文章列表、阅读、归档、系列 | `features/posts`、`archive`、`series` |
| 富文本、内容块、手册 | `features/editor`、`article-rich-content`、`editor-docs` |
| 笔记、图集、人设 | `features/note-browse`、`gallery-browse` / `gallery-editor`、`persona-browse` / `persona-editor` |
| 批注、推文、聊天、通知 | `features/comments`、`tweets`、`chat`、`notifications` |
| 登录与个人资料 | `features/auth`、`profile`，共享用户模型在 `entities/user` |
| 项目与路线图 | `features/projects`、`admin-projects` |
| 上传、媒体与表情 | `features/upload`、`media`、`emojis`、`customemoji` |
| 站点音乐 | `features/admin-music`、`music-player`，共享模型在 `entities/music` |
| 管理后台 | `features/admin-*`，公共后台布局与表格在 `admin-layout` / `admin-shared` |
| 运行策略与代码执行 | `entities/runtime-policy`、`entities/code-runner`、`features/admin-settings` |
| 首页组合与导航 | `widgets/` 与 `shared/config/nav.ts` |

只在一个 feature 内使用的实现留在 feature。第二个 feature 需要同一业务能力时，提到 `entities/`；站点专用基础能力放 `shared/`，通用 React 组件放 `packages/ui/`。不要让 `shared` 反向导入业务 feature。

### 音乐播放器接入

播放器通过公开 `position` 属性默认靠左。宿主只设置 `--kite-blob`、`--kite-blob-icon` 按钮颜色和层级、边距、移动端导航避让，保留播放器原生外观与开合动效；不要通过部件 CSS 重写圆角、阴影或动画。

升级播放器依赖时同步 `pnpm-workspace.yaml` 中 `minimumReleaseAgeExclude` 的精确版本，并验证生产 Docker 构建；其余依赖保留默认的 24 小时发布冷却期。

### 编辑器与正文渲染

编辑器和阅读端共用内容格式契约，源码模式与富文本维护同一份文档。内容块、Markdown / HTML 往返、脚注、图表导出等细节维护在[编辑器手册](src/features/editor/docs/README.md)，不在本 README 复制功能规格。

修改内容块时同时检查编辑预览与阅读渲染。可运行代码依赖服务端有效策略；项目卡片与路线图读取当前项目数据，而非在文章里保存一份静态副本。

## 样式与组件

全局入口是 [src/styles.css](src/styles.css)：Tailwind v4 后导入 `@violet/ui/styles.css`，再加载站点主题、方言和转场。

| 样式内容 | 归属 |
| --- | --- |
| 基础语义 token、色板与通用组件 CSS | `packages/ui/` |
| 站点字体、装饰与主题适配 | `src/styles/` |
| 公开内容、工具界面、沉浸舞台的方言 | `src/styles/dialects/` |
| feature 私有样式 | 所属组件旁的样式文件 |

页面分别使用 `.dialect-public`、`.dialect-tool`、`.dialect-immersive`，通过语义 token 适配明暗主题，不锁定色板值。通用组件从 `@violet/ui` 使用；组件的公开入口与成熟度以 [component-manifest.json](packages/ui/component-manifest.json) 为准。

### 独立包与文档站

| 包 | 文档站 / 站内用途 | 开发依据 |
| --- | --- | --- |
| `@violet/ui` | `/ui`，通用 UI 与主题 | [架构](packages/ui/docs/architecture.md)、[组件设计](packages/ui/docs/component-design.md) |
| `@violetjs/kanban` | `/kanban`，项目路线图看板与画布 | [使用说明](packages/kanban/README.zh-CN.md)、[维护指南](packages/kanban/DEVELOPMENT.md) |
| `@violetjs/inkline` | `/inkline`，手绘工作台与文章图表 | [使用说明](packages/inkline/README.zh-CN.md)、[维护指南](packages/inkline/DEVELOPMENT.md) |
| `@violetjs/react-tweet` | 文章引用与推文页面 | [使用说明](packages/react-tweet/README.zh-CN.md)、[维护指南](packages/react-tweet/DEVELOPMENT.md) |

文档站复用包内正文与示例，不维护第二套 API 说明。修改包实现时按包内流程做构建和真实 tarball 消费验证；站点 workspace 能运行不能替代独立包验收。安装方式与发布状态见各包 README。

## 测试

### 单元测试

```bash
pnpm test
```

Vitest 使用 jsdom，配置在 [vitest.config.ts](vitest.config.ts)。站点、workspace 包和路由脚本的测试分别位于 `src/`、`packages/*/src/`、`scripts/`，测试文件与实现就近放置。

### 浏览器契约

```bash
pnpm build
pnpm test:contract
```

[playwright.config.ts](playwright.config.ts) 会启动测试 API（9410）和构建后的 SSR 服务（4173），不是连接线上业务环境。可在命令后指定用例文件，例如 `pnpm test:contract e2e/ssr-hydration.spec.ts`。

SSR 内容可见不代表客户端交互已挂载。需要交互的测试使用 [e2e/support.ts](e2e/support.ts) 的 `openClientPage` 等待会话探活；涉及页面 effect 的聚焦刷新再使用对应就绪辅助函数，不能仅凭文本出现就派发窗口事件。

## 生产构建与部署

`pnpm build` 输出 `dist/client/` 和 `dist/server/`。生产由 `node server.mjs` 把 SSR Handler 接到 HTTP 服务，`PORT` / `HOST` 控制监听；静态资源、上传文件和后端请求由部署中的反向代理共同处理。单独启动 Node 入口不等于完整生产站点。

容器构建见 [Dockerfile](Dockerfile)，环境编排见[根 README 的生产部署](../README.md#生产部署)，版本发布与回滚见[发布手册](../docs/deploy/release-runbook.md)。前端对外地址和公开 OAuth Client ID 等构建参数变化后，需要重新构建客户端。

## 项目结构

```text
web/
├── src/
│   ├── routes/          页面路由与数据加载入口
│   ├── widgets/         页面级组合
│   ├── features/        业务功能
│   ├── entities/        跨 feature 的业务模型、查询与 UI
│   ├── shared/          站点级 API、工具与基础能力
│   ├── styles/          站点主题与方言
│   ├── test/            测试装配
│   ├── router.tsx       路由器与 SSR 查询缓存
│   └── styles.css       全局样式入口
├── packages/            可独立交付的 workspace 包
├── e2e/                 浏览器契约与测试 API
├── scripts/             路由回归、资源同步等脚本
├── public/              静态资源
├── vite.config.ts       Start、构建与开发代理
└── server.mjs           生产 SSR 入口
```

## 相关文档

- [项目总览](../README.md)
- [后端接口与开发](../api/README.md)
- [前端代码规范](../docs/guides/frontend-style-guide.md)
- [页面转场指南](../docs/guides/view-transitions.md)
- [贡献指南](../CONTRIBUTING.md)
