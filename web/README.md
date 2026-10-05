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

`web/packages/ui/` 是通用 UI workspace 包。所有单元放在 `src/components/<name>/`，结构、recipe、CSS、导出与测试共置；`component-manifest.json` 管理公开入口与 foundation / legacy 状态。成熟度以清单的 foundation / legacy 标记为准，legacy 保留兼容 API 并逐个重建。

`@violet/ui/styles.css` 在 Tailwind v4 后导入；React 基础单元和 HTML 共用 BEM CSS，纯 CSS 可选择 `tokens.css` 与组件叶子入口。Maple 字体、签名和装饰动画归站点 `src/styles/site-theme.css`。包可输出 preserveModules ESM、类型声明与 CSS，`pnpm --filter @violet/ui consumer` 在工作区外安装真实 tarball 验收；npm 发布尚未执行。架构与操作流程以包内 [architecture.md](packages/ui/docs/architecture.md) 和 [component-design.md](packages/ui/docs/component-design.md) 为权威。`src/features/ui-docs/` 负责 `/ui` 组件库文档，架构与设计规范直接读取包内正文，组件预览与复制源码共用同一份示例文件。

后台 `DataTable` 默认让未调整的列随容器伸缩；右固定列按行内容撑开，操作按钮增减无需维护 `width`。时间等需完整展示的非固定列可设置 `fitContent: true`；拖拽列宽后记录当时的列布局，重置列设置可恢复自适应。

## 推文组件包

`packages/react-tweet/` 提供独立的 `@violet/react-tweet`，不依赖本站别名、路由、状态管理或 Tailwind。

```tsx
import { fetchTweetReference } from "@shared/server/tweet-reference";
import { EmbeddedTweet, Tweet, type TweetData } from "@violet/react-tweet";

// 本站通过同源 server function 取数；其他宿主提供自己的 fetcher。
// 默认入口自动加载样式，无需再导入 styles.css。
<Tweet id="1728987032779694397" fetcher={fetchTweetReference} locale="zh-CN" timeZone="Asia/Shanghai" />;

const saved: TweetData = {
  url: "https://x.com/thsottiaux/status/2062329981548802523",
  availability: "available",
  snapshot: {
    author: { name: "Tibo", handle: "thsottiaux" },
    text: "Hi. Over the last 24 hours we had three separate small incidents that affected Codex reliability. Those are three too many and we are taking active steps for them to not reproduce.\n\nI have reset usage limits for Codex across all paid plans. May the tokens flow again.",
  },
};
<EmbeddedTweet tweet={saved} locale="zh-CN" timeZone="Asia/Shanghai" />;
```

### 入口与运行环境

| 入口 | 契约 |
|------|------|
| `@violet/react-tweet` | 组件与公开类型，自动导入 CSS；由支持 CSS 的浏览器构建工具消费 |
| `@violet/react-tweet/unstyled` | 同一组件和类型，无 CSS 副作用；可直接用于 Node.js SSR 或自定义样式 |
| `@violet/react-tweet/api` | `getTweet`、`parseTweetId`、`GetTweetOptions`；不依赖 React 或 CSS |
| `@violet/react-tweet/styles.css` | 无样式入口需要默认外观时手动加载 |

包使用 React 19、原生 ESM、现代浏览器 CSS 和标准 Fetch API。`Tweet` 在客户端挂载后调用宿主提供的 `fetcher`；需要 SSR 正文时，服务端调用 `getTweet` 后将结果交给 `EmbeddedTweet`。官方作者元数据不开放浏览器跨域访问，不能直接在浏览器中使用 `getTweet`；本站同源边界位于 `src/shared/server/tweet-reference.ts`。组件不加载第三方脚本或 iframe，但图片、视频仍会请求各自的资源地址。当前仅在 workspace 使用，尚未发布 npm。

源码内部的 `.js` 相对导入由 TypeScript `NodeNext` 解析到对应 `.ts` / `.tsx` 文件，构建后保留为可直接执行的 ESM 路径。根入口与 `/unstyled` 共用无 CSS 的类型入口，调用方不需要为读取类型添加 CSS 模块声明。

### 数据、扩展与本地化

- `TweetData` 按 `availability` 判别：`available` 必须包含快照；`private`、`deleted`、`unavailable` 禁止携带正文与引用。本站服务端标记不可用的内容只展示来源入口，不向外站重新抓取。
- 照片必须有原图地址；视频区分真实播放源与仅封面状态，不将图片 URL 当作视频。连续照片组成网格，照片与视频之间保持来源顺序；引用最多展开一层，更深层保留原文链接。
- `Tweet.fetcher` 必填，可接入自建代理或缓存。加载时显示头像、作者、正文和底栏骨架，`messages.loading` 仅向屏幕阅读器报告状态；减少动态效果时骨架不播放动画。加载器接收 `AbortSignal`；ID、加载器变化或卸载时取消旧请求并丢弃迟到结果。暂时失败提供原文入口和手动重试，不自动重抓明确不可用内容。
- `renderPhotos` 接收净化后的连续照片组；`renderVideo` 接收一项可播放或仅封面的媒体。可通过照片插槽接入图片灯箱，portal 键盘事件仍可到达宿主。
- 组件保留原生 `article` 的 `ref`、`className`、`style`、ARIA、`data-*` 和事件；正文仍冒泡，链接与媒体独立交互。`children` 和 `dangerouslySetInnerHTML` 不开放；异步组件的 `id` 专用于来源标识。
- `locale` 默认 `en-US`，`timeZone` 默认 `UTC`；不读取浏览器语言或服务器本地时区。内置英文、简体中文，`messages` 可覆盖所有界面文案与无障碍标签；其他语言可传入完整词典。原作者正文和宿主自由文本提示不翻译。
- 外观可覆盖 `--tweet-background`、`--tweet-foreground`、`--tweet-muted`、`--tweet-border`、`--tweet-accent`、`--tweet-accent-hover`、`--tweet-like-hover`、`--tweet-reply-hover`、`--tweet-repost-hover`、`--tweet-verified`、`--tweet-surface`、`--tweet-focus`、`--tweet-font-family`、`--tweet-max-width` 和 `--tweet-radius`，功能圆角上限为 16px。支持 `.dark` / `.light`、`data-theme` 与系统色彩偏好。
- 推文沿正文起点对齐，统计与发布时间共用紧凑底栏；窄屏按可用宽度换行。操作图标采用 X 同款轮廓，按点赞、回复、转发排列，悬停分别使用玫红、蓝色、绿色；暗色主题使用对应的亮色。点赞为未选中的空心状态。点赞与回复在新标签页打开 X 的真实操作入口，不在本站伪造计数变化；转发数仍是只读快照。右上角 X 标记与时间链接打开原文。
- 普通链接悬停时提亮链接色，不切换为正文色。作者姓名、账号、头像与组织关联各自导航，不共用整行 hover。姓名悬停只显示下划线并保留原文字颜色，`@账号` 与操作入口仅改变颜色，不联动另一行。`author.verification` 区分 `individual` / `business` / `government`，显示对应的蓝色、金色、灰色认证徽章；`author.affiliation` 只显示来源明确提供的组织图片与链接，不根据账号猜测关系。
- `maxTextLines={6}` 可选开启正文折叠：只在实际超过 6 行时显示「展示更多／收起」，不截断原始文字、链接或 emoji，不影响图片、视频、引用卡与底部操作。不传则完整展示；非正整数不启用折叠。`Tweet` 与 `EmbeddedTweet` 均支持，文案可通过 `messages.showMore` / `messages.showLess` 覆盖。SSR 保留全文，浏览器完成布局测量后折叠；宽度或字体改变会重新判断溢出。

`getTweet` 在服务端读取 [FxTwitter Status Fetch API](https://github.com/FxEmbed/FxEmbed/wiki/Status-Fetch-API) 的完整正文与媒体，再由 X 官方 syndication 补充作者认证和组织关联，不用官方可能截断的正文覆盖长文。官方作者 ID、账号和推文 ID 必须与正文来源匹配；私密或墓碑状态不展示旧正文。外部服务可能限流或不可用，网络与协议错误交给宿主处理；请求固定来源、不携带凭证、不跟随重定向。普通推文与长推文的索引口径不同，适配器统一后再切片，避免中文与 emoji 截断。

服务端运行环境必须能访问两处外部来源。若通过 `HTTP_PROXY` / `HTTPS_PROXY` 出网，使用支持内置代理的 Node.js 版本并启用 `NODE_USE_ENV_PROXY=1`，同时通过 `NO_PROXY` 排除本站 API；旧版 Node.js 的原生 `fetch` 不会仅因设置这些代理变量就自动使用代理。代理属于宿主运行环境配置，不进入浏览器组件。

### 包内边界与验证

- `src/data/`：数据、媒体、异步加载契约与 URL 校验，不依赖 React。
- `src/fxtwitter/`：完整正文与媒体请求、规范化，以及作者元数据的合并。
- `src/syndication/`：官方作者认证、组织关联和可见性校验。
- `src/tweet/`：展示组件、私有加载 hook、本地化、媒体渲染接口与共置的主体/媒体 CSS。
- `src/index.ts`、`src/unstyled.ts`、`src/api.ts`、`src/styles.css`：公开入口；内部模块直接引用具体文件，不反向依赖入口 barrel。测试与被测模块共置。

```bash
pnpm --filter @violet/react-tweet typecheck
pnpm --filter @violet/react-tweet test
pnpm --filter @violet/react-tweet build
pnpm --dir packages/react-tweet pack --pack-destination /tmp
```

发布前还需在 workspace 外安装真实 tarball，验证 Node.js SSR、浏览器默认 CSS、纯 API 依赖边界与跨运行时水合，而非只检查源码路径。

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
