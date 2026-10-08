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

`web/packages/ui/` 是通用 UI workspace 包。所有单元放在 `src/components/<name>/`，结构、recipe、CSS、导出与测试共置；`component-manifest.json` 管理公开入口与 foundation / legacy 状态。当前 8 个 foundation 单元为 Button、Checkbox、ImagePixelReveal、Input、Label、Textarea、TextField、UploadTile，其余 36 个 legacy 单元保留兼容 API 并逐个重建；成熟度以清单为准。

`@violet/ui/styles.css` 在 Tailwind v4 后导入；React 基础单元和 HTML 共用 BEM CSS，纯 CSS 可选择 `tokens.css` 与组件叶子入口。Maple 字体、签名和装饰动画归站点 `src/styles/site-theme.css`。Maple Mono 与 Alex Brush 使用 Fontsource 5.3.0 的 jsDelivr CDN，`@font-face` 在该文件声明，由 `src/styles.css` 引入，不再打包本地字体。包可输出 preserveModules ESM、类型声明与 CSS，`pnpm --filter @violet/ui consumer` 在工作区外安装真实 tarball 验收；npm 发布尚未执行。架构与操作流程以包内 [architecture.md](packages/ui/docs/architecture.md) 和 [component-design.md](packages/ui/docs/component-design.md) 为权威。`src/features/ui-docs/` 负责 `/ui` 组件库文档，架构与设计规范直接读取包内正文，组件预览与复制源码共用同一份示例文件。

ImagePixelReveal 已归入 `@violet/ui`，通过瓦片裁剪展开拼合始终静止的原图或自定义内容；默认随机顺序每轮重新洗牌，悬停可完整重播，减弱动态直接显示。`/ui/components/image-pixel-reveal` 提供四种顺序、完整重播、切换图片和 children 的同源示例，资源使用内嵌 SVG，不依赖站点头像配置。

UploadTile 提供与图片网格等大的加号入口，支持原生键盘激活、禁用和忙碌状态；文件选择与网络上传由消费方负责。`/ui/components/upload-tile` 的演示与复制源码同源，使用包内 Checkbox 控制状态，外部 tarball 消费验收覆盖根入口、叶子入口和普通 CSS。

后台 `DataTable` 默认让未调整的列随容器伸缩；右固定列按行内容撑开，操作按钮增减无需维护 `width`。时间等需完整展示的非固定列可设置 `fitContent: true`；拖拽列宽后记录当时的列布局，重置列设置可恢复自适应。

文件选择与拖放共用 `features/upload/hooks/use-file-selection` 的类型、大小和数量校验；取消后可重新选择同一个文件。`Uploader` 保留默认分片上传和自定义上传策略，表情继续使用公共 `useUploadEmoji` 的专用端点，避免改变 GIF 文件与表情 URL 的契约。

## 文章编辑与阅读

源码模式与富文本维护同一份文档，保存和 `.md` 导出无需先退出源码。编辑器支持脚注的新建、正文编辑与重复引用；普通表格保留转义和列对齐，合并单元格以 HTML 表格载体往返。阅读端保留安全的链接锚点、列表编号、文本样式与脚注回链，HTML 和 Markdown 的 Mermaid、可运行代码、任务列表及高亮共用阅读组件。语法和格式边界见[编辑器手册](../docs/editor-syntax.md)。

正文上下标使用 `<sub>/<sup>`，工具栏可互相切换；GitHub 五类提示块和原生折叠块支持 Slash 插入、正文编辑与源码往返。折叠内容保存默认展开状态，阅读端保留原生键盘交互。HTML 载体内部包含脚注时，导出整篇 HTML 保留统一引用与回链；其他文档继续使用 Markdown。已知 Markdown 来源显式选择解析链路，版本预览和文章目录支持混合 HTML，不再由正文里任意一个标签决定整篇格式。

Mermaid 图块统一使用手写字体与 Rough.js 笔触，编辑器预览与阅读端同源，覆盖手册第 9 节的全部 13 种示例图型。Excalifont 使用 Excalidraw 0.18.1 发布的 jsDelivr CDN 分片，中文小赖体使用[中文网字计划 CDN](https://chinese-font.netlify.app/zh-cn/cdn/)，仅在图块出现时加载。SVG 导出内嵌所需字体与 OFL 通知，PNG 从同一 SVG 生成；字体版权通知保存在 `src/assets/fonts/diagram/` 并由导出模块引用。宽图保持自然字号，通过图内横向滚动阅读；存量文章无需重新保存。

## 推文组件包

[`@violet/react-tweet`](packages/react-tweet/README.md) 是独立推文组件包；安装、API、主题与构建说明统一维护在包内 README。

本站的文章嵌入、已保存 X 快照、`/tweets` 时间线和详情共用该包；站内互动与权限由 `features/tweets` 管理，同源取数边界位于 `src/shared/server/tweet-reference.ts`。

`/tweets` 使用单列独立卡片，时间线与详情的宽度上限统一为 768px；引用以底色和留白区分，不逐层叠加边框。发布区让头像与正文并排，正文和底部工具栏在添加 X 原文时保持常驻；工具栏集中图片、X 转发、表情和剩余字数，发布按钮保留小色块与纸飞机，不单独显示作者栏或顶部模式按钮。X 转发通过链接图标打开 `@violet/ui` 的 Popover，浮层仅有链接输入与预览；`Enter` 获取原文，成功后自动收起并在正文下方显示原文。`Esc` 或点击外部取消链接输入，添加或移除原文不清空正文与附图。控件保留触控目标与键盘焦点，移动端工具栏占满一行，链接浮层与视口边缘至少间隔 16px。图片上传完成后再发布，正文内支持 `Ctrl/Cmd+Enter`。评论、引用、点赞与聊天分享位于卡片底部，详情的完整发布时间位于作者行，不单独添加分隔栏；刷新共享原文、下架和删除收在更多菜单，下架与删除仍需确认。X 正文默认折叠为六行，嵌套引用独立展开；文章嵌入可用 `maxTextLines: 0` 展示全文。

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
pnpm generate-routes     # 重新生成文件路由（tsr generate）

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
| `/blog/:slug` | 文章详情（正文与目录整体居中、桌面阅读轨与完整目录围绕阅读位置原位展开收拢并支持减弱动态、窄屏浮动目录、批注、人物提及、语义内容卡片与可选作者落款） |
| `/blog/archive` | 文章归档 |
| `/announcements/:id` | 公告详情 |
| `/projects` | 项目展示 |
| `/friends` | 友链页 |
| `/about` | 关于页 |
| `/profile` | 个人资料 |
| `/login`, `/register`, `/forgot-password` | 认证 |
| `/changelog` | 更新日志 |
| `/ui`、`/ui/guides/:slug`、`/ui/components/:name` | violet/ui 组件库文档、接入指南与组件 API 示例 |
| `/chat` | 登录用户的私聊与私有房间工作区（消息、消息表情反应、图片、Bot 斜杠命令补全、未读、Web Push 设置、账号级聊天外观）；评论、推文与聊天输入共用 `features/customemoji` 自定义表情能力 |
| `/galleries`, `/galleries/:slug` | 公开图集浏览流与稳定地址详情 |
| `/notes`, `/notes/:id` | 公开笔记流（游标分页 + 标签筛选）与详情，复用文章渲染管线 |
| `/persona` | 当前人设的多语言公开档案、完整设定正文与有序设定图 |
| `/admin/personas` | 多份人设档案及语言版本管理、完整文档编辑与当前人设切换 |
| `/admin/galleries` | 图集管理（作者与状态筛选、自动保存、更新发布、撤回与永久删除、他人作品审核处置） |
| `/admin/chat-bots` | 聊天 Bot 凭据管理（注册虚拟用户可带头像、启停、重置一次性 token、吊销） |
| `/admin/*` | 后台管理（文章/评论/媒体/用户/角色权限/友链/审计日志/MCP/订阅/设置等） |

路由配置入口：`src/router.tsx`。根布局：`src/routes/__root.tsx`。

## 状态管理

- **TanStack Query**：服务端状态（文章、评论、媒体等）缓存、失效、重试。
- **Zustand**：客户端全局状态（播放器、主题、编辑器临时状态等）。

表情目录与会话内个人表情由 TanStack Query 缓存，关闭浮层不丢弃列表。后台目录变更、个人表情增删收藏和后台下架会失效对应缓存；登出或收到 401 时取消并清除私有查询，重登弹窗打开期间暂停个人列表请求。

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
- 通用组件的结构、recipe、CSS 与测试放 `packages/ui/src/components/<name>/`；站点 feature 样式放组件旁 `*.module.css`，运行时 DOM 规则由所属 feature 持有。
- 主题 token 分层：组件库的基础语义与主色源在 `packages/ui/src/styles/`，站点方言在 `src/styles/dialects/`。公开页面主容器挂 `.dialect-public`、后台等工具界面挂 `.dialect-tool`、灯箱等沉浸舞台挂 `.dialect-immersive`；页面消费 semantic token，不直接绑定色值。
- 支持 v4 任意值简写（如 `max-w-50`）。
- 暗色/亮色主题通过 `next-themes` 管理。

## 测试

```bash
pnpm test
```

- 测试文件：`src/**/*.test.{ts,tsx}`
- 环境：jsdom
- setup：`src/test/setup.ts`
- 主题浏览器契约（Playwright，需先 `pnpm build`）：`pnpm test:contract`，或仓库根 `make web-contract`

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
