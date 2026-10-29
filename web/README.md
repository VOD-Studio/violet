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
| `pnpm check:colors` | 检查新增颜色违规与白名单增长 |
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
| `/users/:username`、`/profile` | 公开主页与个人中心（资料、安全、用量） |
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

### 个人中心

个人中心在桌面使用纵向页签，窄屏切换为横向页签。资料卡中的姓名链接进入公开主页，旁边的外跳图标与悬停、键盘聚焦提示标识这一入口。

`/profile` 的「用量」页签展示当前账号的 OMP 请求数、token、缓存率、生成速度、错误率和 API 等价成本，并提供 7 / 30 / 90 天窗口、UTC 每日请求趋势与模型分布。成本以 USD 估算，不代表订阅实际账单；总 token 不重复计入推理 token。

页面沿用个人中心的客户端渲染，选中页签后通过 Session 请求 `/omp-usage/summary`、`/omp-usage/models`、`/omp-usage/timeseries`。查询按账号、会话版本和窗口隔离，统一标记 `meta.sessionScoped: true`；登出或会话失效时取消请求并清除缓存，不发送可选用户 ID，也不通过 SSR 预取私人用量。

空记录的「接入 OMP」面板直接提供原生 Marketplace 安装命令与本站配置模板，无需跳转文档；令牌不在面板中填写或保存。访问令牌表单的「用量上报」分组可单独选择 `usage:write`；该权限仅用于客户端上报，不授予读取其他用户统计的能力。[扩展指南](../docs/guides/omp-usage.md)补充升级、卸载与环境变量配置。

## 模块定位

开发时先区分页面装配、业务功能和共享能力，再找对应目录。下表是常用入口，不是逐控件行为清单。

| 改动范围 | 主要位置（`src/` 下） |
| --- | --- |
| 文章列表、阅读、归档、系列 | `features/posts`、`archive`、`series` |
| 富文本、内容块、手册 | `features/editor`、`article-rich-content`、`editor-docs` |
| 笔记、图集、人设 | `features/note-browse`、`gallery-browse` / `gallery-editor`、`persona-browse` / `persona-editor` |
| 批注、推文、聊天、通知 | `features/comments`、`tweets`、`chat`、`notifications` |
| 登录、个人资料与本人用量 | `features/auth`、`profile`，共享用户模型在 `entities/user` |
| 项目与路线图 | `features/projects`、`admin-projects` |
| 上传、媒体与表情 | `features/upload`、`media`、`emojis`、`customemoji` |
| 站点音乐 | `features/admin-music`、`music-player`，共享模型在 `entities/music` |
| 实时状态（Nowbeam） | `features/presence`、`admin-presence`，顶栏 Logo 胶囊与移动端底部岛在 `widgets/Header` 接入 |
| 网页链接预览 | `entities/link-preview` 管请求与回填，`shared/lib/linkify` 识别正文 URL，`@violet/ui` 提供展示组件 |
| 明暗外观切换 | `features/appearance`，SSR 与 cookie 桥接在 `shared/` |
| 主题切换 | `features/theme-switcher`，预设、偏好解析与 SSR 在 `shared/` |
| 四季装饰与图层控制 | `features/seasonal-decor`，入口在 `theme-switcher` 与命令面板 |
| 管理后台 | `features/admin-*`，公共后台布局与表格在 `admin-layout` / `admin-shared` |
| 运行策略与代码执行 | `entities/runtime-policy`、`entities/code-runner`、`features/admin-settings` |
| 首页与阅读页组合、导航 | `widgets/` 与 `shared/config/nav.ts` |

只在一个 feature 内使用的实现留在 feature。第二个 feature 需要同一业务能力时，提到 `entities/`；站点专用基础能力放 `shared/`，通用 React 组件放 `packages/ui/`。不要让 `shared` 反向导入业务 feature。

链接预览先显示 SSR 快照；客户端按规范 URL 共用缓存，只轮询服务端明确标记为 pending 的链接，完成、失败或离开页面后停止。首个消费方是推文；其他 feature 复用 `entities/link-preview`，不要在 `shared` 里导入推文 DTO。

### 音乐播放器接入

站点使用 `@violetjs/kite-player` 的自定义 `DataSource`，对接本站 `/api/v1/music/**`，不改用包内直连外站的数据源。公开歌单按页载入；凭据模式变化时重建队列，刷新恢复队列与进度但不自动播放。

播放器通过公开 `position` 属性默认靠左，并以 `initial="orb"` 首次载入即收成圆盘，点击后展开；该属性只在挂载时读取一次，页面向下滚动时仍按 `collapse` 默认值自动收起。宿主只设置 `--kite-blob`、`--kite-blob-icon` 按钮颜色和层级、边距、移动端导航避让，保留播放器原生外观与开合动效；不要通过部件 CSS 重写圆角、阴影或动画。

升级播放器依赖时同步 `pnpm-workspace.yaml` 中 `minimumReleaseAgeExclude` 的精确版本，并验证生产 Docker 构建；其余依赖保留默认的 24 小时发布冷却期。

### 编辑器与正文渲染

编辑器和阅读端共用内容格式契约，源码模式与富文本维护同一份文档。内容块、Markdown / HTML 往返、脚注、图表导出等细节维护在[编辑器手册](src/features/editor/docs/README.md)，不在本 README 复制功能规格。

修改内容块时同时检查编辑预览与阅读渲染。可运行代码依赖服务端有效策略；项目卡片与路线图读取当前项目数据，而非在文章里保存一份静态副本。

#### 阅读端加载边界

文章详情的路由参数、SSR loader 与 SEO 留在 `routes/blog/$slug.tsx`，阅读界面经 `widgets/BlogDetailPage` 的公开入口组合各 feature。浏览量登记复用 `features/posts/api/mutations` 的 `useIncrementView`，不在组合层拼接业务接口；mutation 状态变化和评论开关不重复提交统计，统计失败不影响正文，HTTP 客户端既有重试策略保持不变。

正文与标题始终由 SSR 输出，不做整篇虚拟化。`useViewportPreparation` 共用视口观察器，按约一个视口的提前量启动代码、图表、大公式和所属手绘外框；准备后保持挂载，滚出再返回不会重建已完成结果。行内公式保留稳定的 LaTeX 语义载体，不逐个设置观察器。`scheduleEnhancement` 分批执行重计算，可见内容优先；外框只在尺寸、圆角或 seed 改变后重画，换色沿用 `currentColor`。

Shiki 初始化、语言准备与分词在按需创建的 Web Worker 中执行，取消的调用丢弃晚回结果。Mermaid 使用独立串行队列，模块与字体下载不阻塞其他增强；图表测量与 SVG 处理仍在主线程，字体与 Inkline 准备完整后再展示。

`createAsyncLoader` 统一模块与初始化任务的并发复用、成功缓存和失败清理，不自动重试、不用于参数化业务查询。富内容失败只显示局部反馈，源码与正文继续可读。同 URL 的模块下载失败可能被浏览器缓存，此时提供重新载入页面；样式下载与渲染失败支持局部重试，样式恢复以新 `<link>` 的 `load` 事件确认。

展示图片由 `shared/lib/image-url` 按视口与 DPR 生成 `picture` 候选，不声明未经素材元数据证实的像素描述符。仅处理本站 `/uploads/` 地址，外链与动图保持原有语义。`CroppedImage` 按容器、DPR 与作者选区计算需求，不叠加服务端居中 `thumb`；同一源图固定首次几何基准，充足候选不降档重下。`ArticleImage` 保留作者尺寸、原生懒加载与异步解码；未知固有尺寸时只提供最小占位，不保证零布局偏移。灯箱占位复用已选候选，预览与下载仍用原图。

`formatDate` 支持显式 IANA 时区；文章发布时间与修订日期使用 `Asia/Shanghai`，SSR 与浏览器使用同一输入与时区。纯 `YYYY-MM-DD` 按日历日期保留，不套用时区偏移；未指定时区的既有调用行为不变。

文章目录将跟随目标限制在真实滚动范围内；进度、轨迹弹簧与展开状态收敛后停止排帧，滚动或尺寸变化再唤醒。正文尺寸读取与 SVG 写入分开，已完成几何不重复写入；目录滚动层为聚焦环保留空间。

评论区接近时加载，抽屉首次打开时加载并保留实例；划线工具加载期间保留原生选区，绘制完成后再接管高亮。段评加载或失败时仍可关闭，失败不替换正文。Google SDK 随登录入口准备，就绪前禁用对应按钮，失败保留表单与其他登录方式。文章方向键不接管灯箱等模态对话框内的交互。

## 样式与组件

全局入口是 [src/styles.css](src/styles.css)：Tailwind v4 后导入 `@violet/ui/styles.css`，再加载站点主题、方言和转场。

| 样式内容 | 归属 |
| --- | --- |
| 生成色阶、基础语义 token 与通用组件 CSS | `packages/theme/` 生成算法，`packages/ui/` 构建期接入 |
| 站点字体、装饰与主题适配 | `src/styles/` |
| 公开内容、工具界面、沉浸舞台的方言 | `src/styles/dialects/` |
| feature 私有样式 | 所属组件旁的样式文件 |

页面分别使用 `.dialect-public`、`.dialect-tool`、`.dialect-immersive`，只描述语义到色阶的映射：公开主要动作为品牌色，工具主要动作为高对比中性色，沉浸舞台使用固定深色灰阶；状态色不被方言改写。Button 悬停使用 `primary-hover`，链接、选中、焦点、进度、装饰和分类各有独立语义。通用组件从 `@violet/ui` 使用；组件的公开入口与成熟度以 [component-manifest.json](packages/ui/component-manifest.json) 为准。

包颜色由 `pnpm --filter @violet/ui sync` 生成、`check` 校验。人设身份色只在 `.identity-theme` 内生效，修改种子后运行 `pnpm colors:persona`，`pnpm check:persona-colors` 校验提交的静态 CSS。四季预设主题的种子色与旋钮在 `src/shared/lib/theme-presets.ts`，修改后运行 `pnpm colors:themes` 重新生成 `src/styles/theme-presets.generated.css`，`pnpm check:theme-colors` 校验；每季一个 `[data-theme]` 规则，只含品牌与中性色阶，状态色与分类色沿用默认色板。

站点公共层提供 `shared/ui/announcement-severity` 状态色和 `shared/hooks/use-banner-ticker` 轮播节拍。终端、阅读进度等公共界面只消费用途语义色。

公告横幅与卡片共享公共状态色，不依赖实验页面。lab 的固定实验色与旧 utility 仅限 `.lab-scope`，包括其 portal 内容；离开实验路由后不改变正式页面。

### 颜色守门

`make web-lint` 依次执行 Biome、颜色守门，以及人设颜色与四季预设主题的生成一致性检查。检查范围是 `src/`、`packages/` 内的 TSX 与 CSS，包括未加入 Git 的文件；新增裸色值、Tailwind 原生色板类或旧颜色类会失败，输出文件、行号和规则。`hover:bg-primary/90` 等透明主色悬停、CSS hover 中相同的透明混色也会失败；主要动作用 `primary-hover`，浅选中反馈用 `selected-hover`。带 `-text` 后缀的角色颜色类（如 `text-destructive-text`）会失败，文字直接写 `text-destructive`；CSS 的 `color`、`caret-color`、TSX 行内样式的 `color`，以及 `text-[var(--primary)]` 这类任意值类读取 `--primary`、`--destructive` 等实色角色也会失败，应读 `--primary-text` 等文字档。非 hover 的合法透明语义颜色、注释、链接锚点和 CSS ID 不误报。

[color-guard.config.json](color-guard.config.json) 维护扫描根目录与带理由的豁免：颜色算法包、vendor、lab、构建产物、`*.generated.css` 和组件清单生成的 CSS 入口。手写的主题 CSS 与色板不豁免。

[color-guard-baseline.json](color-guard-baseline.json) 记录现有违规的文件、规则、值和次数，不绑定行号。白名单只能删减，不能新增记录、增加次数或将额度移到其他文件；删除违规时须同步减少次数，归零则删除记录，不保留空闲额度。新增违规应改用语义 token，不重新生成或扩充白名单。

本地默认对照 `HEAD` 检查未提交改动；检查已提交的整条分支时，执行 `pnpm check:colors --base origin/release/2.0`。CI 的 PR 对照目标分支提交，push 对照推送前提交，精确提交验收对照其父提交。基准尚无白名单时，仅接纳配置中固定 `initialRevision` 已有的违规；不会将新代码自动计入存量。基准不可读会失败，需要先获取对应 Git 历史。

CLI fixture 使用临时 Git 仓库，可通过 `pnpm test scripts/check-colors.test.ts` 单独运行。

### 外观偏好

`shared/lib/appearance-cookie.ts` 提供 SSR 与客户端共用的外观解析规则：`appearance` cookie 保存已解析的 `light` / `dark`，有效期一年。只有缺少新 cookie 时才读取旧 `theme` 值；SSR 通过 `getSSRAppearance` 的响应头补写，客户端路由读取时也会补写。新 cookie 存在但值非法时按浅色解析，不回退旧值。

`next-themes` 的 `useTheme`、`setTheme` 等 API 与默认 localStorage 键保持不变，已保存的 `light` / `dark` / `system` 选择继续生效。

站点切换器与 hook 从 `@features/appearance` 引入 `AppearanceToggle`、`useAppearanceSwitcher`。Header、后台顶栏、命令面板和 `/lab/theme` 演示共用这一入口，正式页面不依赖 lab 实现。

### 主题偏好

主题偏好由 `shared/lib/theme-preference.ts` 解析，SSR 通过 `getSSRThemeState` 在 `<html>` 上输出 `data-theme`，首帧即为访客的预设主题；自定义主题按规范化后的种子色在 SSR 现算，内联进 `<head>` 的 `#theme-custom` 样式，`data-theme` 为 `custom`，`data-season` 仍给出偏好对应的季节；规则与术语见 CONTEXT「主题与色彩」。主题契约（`e2e/theme-contract.spec.ts`）覆盖「主题 × 外观 × 视口」的首帧与水合一致性，并在浏览器中实测关键文字组合的对比度。

切换入口是 `@features/theme-switcher` 的 `ThemeMenu`，挂在顶栏工具区外观开关旁；移动端底部导航的「更多」面板用 `ThemePicker` 提供同样的选择。两处都有「自定义」，在 `CustomThemeDialog` 里取色或输入十六进制种子色，实时预览浅深两种外观下的按钮、链接、选中态与主色文字后应用。选中后即时改写 `data-theme`、写入偏好 cookie，渲染的主题变化时复用外观切换的圆形扩散，`e2e/theme-switcher.spec.ts` 覆盖切换、刷新保持、键盘操作与自定义流程。

### 装饰偏好

装饰偏好由 `shared/lib/decoration-preference.ts` 解析，单独保存在 `decoration-preference` cookie：跟随主题、无或指定某一季。`resolveDecoration` 给出实际投放的季节，跟随主题时取预设主题的季节，自定义主题下为无。SSR 通过 `getSSRDecoration` 在 `<html>` 上输出 `data-decoration`（季节或 `none`），首帧即为访客的装饰。

插画、飘落与挂件的开关保存在独立的 `decoration-layers` cookie，SSR 输出 `data-decoration-layers`。关闭的图层卸载对应内容；插画与飘落同时关闭时，不保留空背景插槽。

装饰内容统一由 `@features/seasonal-decor` 投放：背景层是视口角落插画与飘落画布，点缀位是首页收尾寄语上方的小幅插画，组件挂件保留在顶栏三个胶囊与页脚。背景避开正文与首页内容栏，点缀位采用绝对定位，不参与布局。插画用主题 token 混色、固定随机种子保证 SSR 与客户端一致；粒子先画进离屏精灵再贴图。背景仅在桌面公开页显示；隐藏、零尺寸、窄屏或离屏时停止逐帧绘制，减弱动态时仅显示静态画面。工具与沉浸方言不显示装饰，`@violet/ui` 不依赖装饰实现。

桌面在 ThemeMenu 的「季节装饰」子菜单选择季节及图层，连续配置时菜单保持打开；移动端「更多」面板提供相同选择，命令面板支持选择装饰季节或关闭装饰。三个入口共用现有 `useDecorationSwitcher`，装饰变化不改主题。`e2e/decoration.spec.ts` 覆盖首帧与水合一致性、图层持久化、连续配置、布局不变与减弱动态静止。

### 独立包与文档站

| 包 | 文档站 / 站内用途 | 开发依据 |
| --- | --- | --- |
| `@violet/ui` | `/ui`，通用 UI 与主题 | [架构](packages/ui/docs/architecture.md)、[组件设计](packages/ui/docs/component-design.md) |
| `@violetjs/kanban` | `/kanban`，项目路线图看板与画布 | [使用说明](packages/kanban/README.zh-CN.md)、[维护指南](packages/kanban/DEVELOPMENT.md) |
| `@violetjs/inkline` | `/inkline`，手绘工作台与文章图表 | [使用说明](packages/inkline/README.zh-CN.md)、[维护指南](packages/inkline/DEVELOPMENT.md) |
| `@violetjs/react-tweet` | 文章引用与推文页面 | [使用说明](packages/react-tweet/README.zh-CN.md)、[维护指南](packages/react-tweet/DEVELOPMENT.md) |
| `@violetjs/theme` | 构建期生成组件色阶与站点局部身份色 | [使用说明](packages/theme/README.zh-CN.md)、[维护指南](packages/theme/DEVELOPMENT.md) |

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
