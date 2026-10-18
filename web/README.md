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

`web/packages/ui/` 是通用 UI workspace 包。所有单元放在 `src/components/<name>/`，结构、recipe、CSS、导出与测试共置；`component-manifest.json` 管理公开入口与 foundation / legacy 状态。当前 10 个 foundation 单元为 Button、Checkbox、Dropdown、ImagePixelReveal、Input、Label、SearchInput、Segmented、Textarea、UploadTile，其余 34 个 legacy 单元保留兼容 API 并逐个重建；成熟度以清单为准。Input 提供四种外观、三种尺寸、清除与密码显隐，以及可选标签、说明和错误；正式 `/ui/components/input` 的预览与复制源码同源，包含原生表单 reset 示例。SearchInput 独立组合 Input，复用变体、尺寸和样式槽，防抖与回车搜索契约及示例见 `/ui/components/search-input`。

后台搜索统一使用 `controlSize="sm"`，列表筛选、选择弹窗与账户合并搜索保持相同的控件密度；宽度由工具栏或弹窗容器决定。普通表单字段不受搜索密度约束。

`@violet/ui/styles.css` 在 Tailwind v4 后导入；React 基础单元和 HTML 共用 BEM CSS，纯 CSS 可选择 `tokens.css` 与组件叶子入口。Maple 字体、签名和装饰动画归站点 `src/styles/site-theme.css`。Maple Mono 与 Alex Brush 使用 Fontsource 5.3.0 的 jsDelivr CDN，`@font-face` 在该文件声明，由 `src/styles.css` 引入，不再打包本地字体。包可输出 preserveModules ESM、类型声明与 CSS，`pnpm --filter @violet/ui consumer` 在工作区外安装真实 tarball 验收；npm 发布尚未执行。架构与操作流程以包内 [architecture.md](packages/ui/docs/architecture.md) 和 [component-design.md](packages/ui/docs/component-design.md) 为权威。`src/features/ui-docs/` 负责 `/ui` 组件库文档，架构与设计规范直接读取包内正文，组件预览与复制源码共用同一份示例文件。

站点 `Signature` 内置 Mizuki Miru、水月みる、水月见三款笔迹，按名字、月牙、下划线顺序书写；`Mizuki_Miru` 账号名与 `Mizuki Miru` 共用同一款，笔画 JSON 与组件共置。

ImagePixelReveal 已归入 `@violet/ui`，通过瓦片裁剪展开拼合始终静止的原图或自定义内容；默认随机顺序每轮重新洗牌，悬停可完整重播，减弱动态直接显示。`/ui/components/image-pixel-reveal` 提供四种顺序、完整重播、切换图片和 children 的同源示例，资源使用内嵌 SVG，不依赖站点头像配置。

UploadTile 提供与图片网格等大的加号入口，支持原生键盘激活、禁用和忙碌状态；文件选择与网络上传由消费方负责。`/ui/components/upload-tile` 的演示与复制源码同源，使用包内 Checkbox 控制状态，外部 tarball 消费验收覆盖根入口、叶子入口和普通 CSS。

Segmented 是横纵两个方向、soft / ink / line 三种变体的分段控制，指示器位移走 transform；`itemSize` 进入不做 JS 测量的等尺寸布局，`expandSelected` 让选中项占满剩余长度。`/ui/components/segmented` 的演示与复制源码同源，外部 tarball 消费验收覆盖根入口、叶子入口、SSR 与普通 CSS。

后台 `DataTable` 默认让未调整的列随容器伸缩；右固定列按行内容撑开，操作按钮增减无需维护 `width`。时间等需完整展示的非固定列可设置 `fitContent: true`；拖拽列宽后记录当时的列布局，重置列设置可恢复自适应。

文件选择与拖放共用 `features/upload/hooks/use-file-selection` 的类型、大小和数量校验；取消后可重新选择同一个文件。`Uploader` 保留默认分片上传和自定义上传策略，表情继续使用公共 `useUploadEmoji` 的专用端点，避免改变 GIF 文件与表情 URL 的契约。

`CropUploadDialog` 的确认回调支持异步保存；上传或保存期间保持当前会话，失败时保留图片与选区供重试。本地预览 URL 与当前文件绑定，在更换或关闭时释放，避免开发模式重复挂载导致预览失效。

评论、推文与聊天共用表情选择器：爱心收藏入口排第一项并随分组滚动，上传与收藏合并在同一网格，加号占第一格；左右箭头直接切换相邻分组，关闭重开保留浏览位置。图片在网格与悬停、键盘聚焦的大图预览中均优先使用 GIF，个人条目保留右键删除与移出收藏的权限标识。`disabled` 同时停用入口并关闭已打开的选择器，恢复可用后不自动重开旧浮层。

共享评论区通过 `renderAuthorName` 与 `renderAvatar` 插槽扩展作者展示；插槽返回 `undefined` 时保留默认头像、作者名称与原有个人链接，公共层不依赖具体评论者类型。回复对象按实际 `parent_id` 判断：直接回复楼主时省略目标标注，回复二级评论时即使与楼主同名也保留「回复 @昵称」；预览与展开列表使用相同规则。

`CartoonPopover` 默认提供非模态对话框语义，也可作为其他对话框的手绘视觉容器；覆盖 `role` 时只输出适用的 ARIA 属性。切换触发方式会取消尚未执行的悬停计划，避免入口停用后恢复旧浮层。

`entities/comment` 统一解析 AI 自署名、头像与角色简介；GPT、Claude、GLM、Grok、DeepSeek、Kimi、Gemini 各自独立，DeepSeek 昵称为「大肥鱼」，版本与未知署名保留原文，不映射到授权用户的个人页。名称与头像复用站点 `CartoonPopover` 展示完整比例封面和简介，支持悬停、键盘聚焦与触屏点击。简介加入嵌套关闭栈，Escape 先关闭当前简介；外层停用时取消待触发悬停并关闭简介，恢复可用不自动重开。`ui/ai-personas.css` 集中维护各角色明暗展示色；角色色用于名称、AI 标识、淡底与划线，不额外添加卡片描边。

角色图片来自用户提供的 `AI-Chibi-Complete-8-Web.zip`，八张 512×512 头像和八张约 16∶9 封面以原始 WebP 字节保存在 `public/ai-personas/`，未导入商标 logo。均为非官方拟人形象；其中 GLM 黑白狐娘参考 [ZipZipPipe 社区设定](https://www.bilibili.com/opus/1238267551429951496)，简介为本站创作，不作模型厂商或真实性声明。

文章批注、普通评论、首页近评与后台评论共用上述角色身份展示；真人头像、作者标识与个人链接保留原行为。宽屏只收窄正文阅读区并独立居中，标题、封面、目录和底部评论区维持原宽；正文右侧头像默认堆叠，悬停或键盘聚焦时平滑展开，固定侧轨不推动周围布局。移动端正文保持正常宽度，批注头像与计数移到段落下方，入口不参与正文纯文本或锚点偏移。浮层保留原有玻璃材质、软影与透明度／模糊过渡；AI 卡片仅使用角色淡底，不叠加新描边。

批注阅读面板保留有界列表与固定外框，侧栏和面板的作者筛选双向同步；头部数量、可选 AI 标识与头像自然接排，不为缺少的标识预留空位。底部常驻紧凑段评输入区，已有讨论时仍可直接发表自己的整段批注，不转为回复、也不携带 `parent_id`。

阅读、划线与新段评浮层通过同一个 `AnnotationPortal` 越过页面隔离层，并保留公开内容方言的 `primary`、选区与焦点色，避免被底部导航遮挡。锚点滚出视口时只隐藏并停用当前会话，表情与 AI 简介一并关闭；滚回后恢复原筛选、选区和草稿。真正关闭后重新打开属于新会话，不复活旧草稿。

聊天消息按正文与状态两行布局，连续消息共用粘性头像，头像对齐组尾正文。新消息仅淡入；发送中与已读回执共用至少 16px 高的状态槽，发送确认后回执尚未到达时保留空槽，避免切换状态改变布局。

用户资料 DTO 定义在 `entities/user/model/types.ts`；`entities/user/api/keys.ts` 提供按用户名区分的公开资料查询键 `userKeys.profile(username)`。

移动端导航展开时是居中的短胶囊，只有当前入口显示文字；透镜边界与图标连续过渡，旧标签先退出，新标签随后出现，鼠标靠近相邻项时有轻微吸附。动画交给浏览器原生执行，不由 JS 逐帧更新。向下滚动收成右侧圆钮，向上滚动或点击恢复居中。访问快捷入口以外的页面时，最后一项和收起圆钮使用当前菜单的图标，最后一项同时显示菜单名称，点击仍展开全部导航。「更多」保留原有面板形变、模糊渐显与逐项展开动画。首页、博客、系列、图集四个快捷入口不启动整页截图转场；其余链接沿用原转场。减弱动态时直接切换，聊天页隐藏以避开输入栏。

滑块在明暗主题下均使用白色表面与深色文字，轻微软影随透镜轮廓移动。阴影绘制在裁剪层外，展开轨道不裁剪阴影与焦点环；「更多」面板维持原有裁剪和动效。

桌面 Header 的二级菜单由 Dropdown 的共享底色反馈 hover；hover 与当前路由统一使用主色提亮图标，文字保持正常颜色，图标底板不做黑白反色。当前路由保留 `aria-current="page"`，不附加「当前」文字。经过项间空隙或返回触发器时，底色与 hover 图标高亮一起保留，重新移入后平滑跟随。

二级导航沿用各目标的 `exact` 匹配配置；「全部文章」只在 `/blog` 标记为当前项，归档页只标记「归档」。

左上角品牌入口使用 `Dropdown` 展开站点档案；hover 与键盘聚焦展开，点击不切换面板，Escape 收起。面板使用公开内容方言，把贡献热力图、年度进度条、身份图标与入口反馈的 `primary` 映射到项目色板，随明暗主题与色板切换；内容保留贡献数据、倒计时、人设与项目入口。

## 首页时间轴

`widgets/HomeExperience` 的发布积累区在宽屏显示连续单轴，窄屏按季节分行。今日刻度使用完整的「今天」标注，与紫色发布节点区分；当天有发布时节点与今日位置对齐。没有当天发布且聚合窗口尚未结束时，节点按已过去的窗口部分定位，不借用未来空白日期计算中点；桌面与分季视图共用这一时间定位规则。

## 文章编辑与阅读

源码模式与富文本维护同一份文档，保存和 `.md` 导出无需先退出源码。编辑器支持脚注的新建、正文编辑与重复引用；普通表格保留转义和列对齐，合并单元格以 HTML 表格载体往返。阅读端保留安全的链接锚点、列表编号、文本样式与脚注回链，HTML 和 Markdown 的 Mermaid、可运行代码、任务列表及高亮共用阅读组件。语法和格式边界见[编辑器手册](../docs/editor-syntax.md)。

正文上下标使用 `<sub>/<sup>`，工具栏可互相切换；GitHub 五类提示块和原生折叠块支持 Slash 插入、正文编辑与源码往返。折叠内容保存默认展开状态，阅读端保留原生键盘交互。HTML 载体内部包含脚注时，导出整篇 HTML 保留统一引用与回链；其他文档继续使用 Markdown。已知 Markdown 来源显式选择解析链路，版本预览和文章目录支持混合 HTML，不再由正文里任意一个标签决定整篇格式。

Mermaid 图块统一使用手写字体与 `@violetjs/inkline` 笔触（G 笔、草稿手法），编辑器预览与阅读端同源，覆盖手册第 9 节的全部 13 种示例图型。Excalifont 使用 Excalidraw 0.18.1 发布的 jsDelivr CDN 分片，中文小赖体使用[中文网字计划 CDN](https://chinese-font.netlify.app/zh-cn/cdn/)，仅在图块出现时加载。SVG 导出内嵌所需字体与 OFL 通知，PNG 从同一 SVG 生成；字体版权通知保存在 `src/assets/fonts/diagram/` 并由导出模块引用。宽图保持自然字号，通过图内横向滚动阅读；存量文章无需重新保存。

## 手绘绘图库

[`@violetjs/inkline`](packages/inkline/README.md) 位于 `packages/inkline/`，不依赖 React、Mermaid 或 Rough.js。文章 Mermaid 图块经 `shared/ui/diagram` 用它渲染；Rough.js 只留给实验室对照页与基准脚本。

`/lab/sketch` 并排对照 Rough.js 与本库：同一几何、线宽与 seed，可切换咖啡少女插画、人像、基础图元、填充、孔洞规则与真实 Mermaid 布局，并调节笔、压感、手法、1×/3× 缩放和 SVG/Canvas 后端。插画保留 1088×1445 的比例、微笑、眼镜、白花发饰、猫咪杯与手写 “Good morning”；采用少量角色色面、连续中心线与分级线宽，短唇线及瞳孔等点状细节使用独立实墨区域，不以逐色像素碎片叠加还原。插画播放先完成轮廓与细节，再上色；顺序、并行、交错均在阶段内编排，色面在渲染时始终位于线稿下方。人像去掉截图工具栏与边框，以较细的明暗色面保留五官、眼镜、手势与衣褶，沿用原有播放顺序。两种画稿默认 G 笔勾线与实色填充，可切换淡彩；均为矢量，不嵌入位图。控制条提供整图时间轴：播放、暂停、重播、拖动进度、顺序/并行/交错编排与变速。

## 推文组件包

[`@violetjs/react-tweet`](packages/react-tweet/README.md) 是独立推文组件包；安装、API、主题与构建说明统一维护在包内 README。

本站的文章嵌入、已保存 X 快照、`/tweets` 时间线和详情共用该包；多张竖图按 X 原帖的方式横向滚动展示，点击仍打开本站灯箱；站内互动与权限由 `features/tweets` 管理，同源取数边界位于 `src/shared/server/tweet-reference.ts`。

`/tweets` 使用单列独立卡片，时间线与详情的宽度上限统一为 768px；引用以底色和留白区分，不逐层叠加边框。发布区让头像与正文并排，正文和底部工具栏在添加 X 原文时保持常驻；工具栏集中图片、X 转发、表情和剩余字数，发布按钮保留小色块与纸飞机，不单独显示作者栏或顶部模式按钮。X 转发通过链接图标打开 `@violet/ui` 的 Popover，浮层仅有链接输入与预览；`Enter` 获取原文，成功后自动收起并在正文下方显示原文。`Esc` 或点击外部取消链接输入，添加或移除原文不清空正文与附图。控件保留触控目标与键盘焦点，移动端工具栏占满一行，链接浮层与视口边缘至少间隔 16px。图片上传完成后再发布，正文内支持 `Ctrl/Cmd+Enter`。评论、引用、点赞与聊天分享位于卡片底部，详情的完整发布时间位于作者行，不单独添加分隔栏；刷新共享原文、下架和删除收在更多菜单，下架与删除仍需确认。X 正文默认折叠为六行，嵌套引用独立展开；文章嵌入可用 `maxTextLines: 0` 展示全文。

## 看板组件包

[`@violetjs/kanban`](packages/kanban/README.md) 是独立的受控看板组件包（尚未发布 npm），不依赖 `@violet/ui` 与站点模块。目前提供受控看板（只读，或用鼠标、笔、触屏拖动卡片）与不依赖 React 的 `/core`，站点内暂无使用方。

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
| `/profile`、`/profile/security` | 本人资料、主页封面与账户安全设置 |
| `/users/:username` | 公开主页（个人资料、主页封面与推文） |
| `/login`, `/register`, `/forgot-password` | 认证 |
| `/changelog` | 更新日志 |
| `/ui`、`/ui/guides/:slug`、`/ui/components/:name` | violet/ui 组件库文档、接入指南与组件 API 示例 |
| `/chat` | 登录用户的私聊与私有房间工作区（消息、消息表情反应、图片、Bot 斜杠命令补全、未读、Web Push 设置、账号级聊天外观）；评论、推文与聊天输入共用 `features/customemoji` 自定义表情能力 |
| `/galleries`, `/galleries/:slug` | 公开图集浏览流与稳定地址详情 |
| `/notes`, `/notes/:id` | 公开笔记流（游标分页 + 标签筛选）与详情，复用文章渲染管线 |
| `/pet` | 独立电子宠物演示（规则核心以 WebAssembly 在浏览器内运行，不联网；含像素画风图鉴）。需把 [kodama](https://github.com/VOD-Studio/kodama) 与本仓库并排检出，再在 `web/` 执行 `pnpm pet:sync` 构建并同步 SDK（`PET_REPO` 可指向其他位置），产物不入库 |
| `/persona` | 当前人设的多语言公开档案、完整设定正文与有序设定图 |
| `/admin/personas` | 多份人设档案及语言版本管理、完整文档编辑与当前人设切换 |
| `/admin/galleries` | 图集管理（作者与状态筛选、自动保存、更新发布、撤回与永久删除、他人作品审核处置） |
| `/admin/chat-bots` | 聊天 Bot 凭据管理（注册虚拟用户可带头像、启停、重置一次性 token、吊销） |
| `/admin/*` | 后台管理（文章/评论/媒体/用户/角色权限/友链/审计日志/MCP/订阅/设置等） |

路由配置入口：`src/router.tsx`。根布局：`src/routes/__root.tsx`。

个人设置与公开主页共用 `max-w-7xl` 版心，公开页保留资料、推文与概览的原有布局。封面管理复用文件选择、UploadTile 与 CropUploadDialog，接受任意原图比例和自由选区，GIF 保留动画；更换与移除使用封面角落的小图标。未设置或移除封面时，公开页保留原头像模糊背景。资料保存只刷新对应用户的公开资料缓存，改名后清除旧用户名缓存。

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
- 根布局挂载 `@violet/ui` 的 `DocumentScrollbar`，文档滚动条覆盖内容、不占版心宽度；仍使用 `window` 滚动，SSR 首帧通过 `html[data-scrollbar="none"]` 取消原生占位。限高区域继续使用 `OverlayScroll`，不把整页改为内部滚动容器。

## 测试

```bash
pnpm test
```

- 测试文件：`src/**/*.test.{ts,tsx}`
- 环境：jsdom
- setup：`src/test/setup.ts`
- 主题浏览器契约（Playwright，需先 `pnpm build`）：`pnpm test:contract`，或仓库根 `make web-contract`
- 组件库文档契约检查实际导航、按钮响应、复选框键盘操作与代码展开/收起，不固定组件目录数量、链接清单或示例源码文本。

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
