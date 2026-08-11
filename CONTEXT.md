# violet

全栈博客平台：Go (Chi) 后端 + React (Vite) 前端，PostgreSQL + Redis。本文档是项目领域语言的术语表，仅定义概念，不含实现细节。

## 认证（Authentication）

> 登录态采用 **opaque session cookie** 模型（对标 bilibili SESSDATA），取代历史的 access/refresh JWT。决策与命门不变量见 `docs/adr/0003-login-opaque-session.md`（ADR-0001、ADR-0002 均 superseded）。

**Session ID**:
opaque（不透明）随机串（≥256-bit），作为登录态凭证存于 HttpOnly Cookie `violet_session`。本身不含任何用户信息，后端必须查 Redis（`session:<id>`）才能换出用户身份。安全性靠 cookie 的 HttpOnly + SameSite + Secure，以及后端可即时删除。
_Avoid_: access token、login token（这些是已废弃 JWT 时代的词）

**Session Envelope（信封）**:
承载 Session ID 的 Cookie 与 Redis key。opaque 模型下过期权威统一在 Redis TTL + 滑动续期 + 可选绝对寿命，不再有「JWT exp vs cookie MaxAge」双过期混淆。
_Avoid_: cookie lifetime（混淆了信封与信件）

**滑动续期（Idle Timeout）**:
后端中间件对每个带有效 session 的真实请求，用 Redis `EXPIRE` 重置 session 剩余寿命。**不轮换 session id、不产生 Set-Cookie**——这是 opaque 方案绕开 TanStack Start SSR 透传卡点的命门。活跃用户因此不会因空闲超时下线。

**绝对寿命（Absolute Timeout / max）**:
可选配置项，从登录起算的 session 最长存活上限。`max <= 0`（0 或 -1）表示无上限（默认）；`max > 0` 时，无论用户多活跃，到点强制重登。session 实际过期 = min(滑动到期, 绝对到期[若启用])。

**CSRF Token**:
随机不可预测串，double-submit 模式：非 HttpOnly Cookie `violet_csrf`（前端可读）+ `X-CSRF-Token` header 回传比对。token 值同时存于后端 session 记录中，与 session 同生命周期。保护 session 探活端点之外的写操作。对标 bilibili `bili_jct`。
_Avoid_: anti-forgery token（笼统）

**Session 吊销（Revocation）**:
使一个仍有效的 session 失效。触发场景：登出、改密码、重置密码、检测到异常。通过删除 Redis `session:<id>` 实现，即时生效——opaque 模型的核心优势：可即时吊销，不像 JWT 需黑名单。
_Avoid_: logout（吊销是机制，登出是触发场景之一）

**SSR 会话探活**:
SSR（TanStack Start）判断当前请求是否登录的方式：调后端**只读**端点 `/auth/session`，由其读 `violet_session` cookie 查 Redis 返回 user claims。完整 UserDTO 仍由客户端 useMe 按需拉。
_Avoid_: SSR 鉴权（混淆「探活」与「取完整用户信息」）

**命门不变量（opaque session 成立前提）**:
两条，缺一则重蹈 SSR 掉登录覆辙：(1) SSR 只读 session、不续期、不 Set-Cookie；(2) 续期只由后端中间件对真实请求做，写 Redis、不轮换 id、不 Set-Cookie。详见 ADR-0003。

## 文章导航（Article Navigation）

**TOC（Table of Contents）**:
文章目录，从正文 H2/H3/H4 提取的层级导航列表。在桌面端固定于文章左侧，在移动端通过浮动按钮呼出底部 Sheet。
_Avoid_: 目录树（在本文档域内与文件树、分类树混淆）

**Focus TOC**:
长目录下的 TOC 交互模式。目录面板始终围绕当前阅读位置展开一个"上下文窗口"：显示当前项的父级链、前后兄弟项、直接子项，其余节点折叠或隐藏。解决长目录中当前高亮项滚出可视区、用户失去方位感的问题。
_Avoid_: 智能目录、动态目录（过于笼统）

**上下文窗口（Context Window）**:
Focus TOC 中当前阅读位置周围被渲染出来的节点集合。由父级链、当前项、前后兄弟项、直接子项组成，并通过"智能截断"控制总长度。

**智能截断（Smart Truncation）**:
Focus TOC 控制上下文窗口长度的策略。当当前项前后存在大量兄弟项时，只渲染前后各 N 个兄弟，并用省略号 + 首尾锚点代替被隐藏的远处兄弟。

**阅读罗盘（Reading Compass）**:
Focus TOC 的隐喻：目录不是静态列表，而是随阅读滚动动态重新定位的导航仪器，始终指向"当前在哪"。

**已读指示（Read Indicator）**:
Focus TOC 中当前项之前的节点所呈现的"已完成"视觉状态，帮助用户快速感知阅读进度。
_Avoid_: 进度点、完成标记（未说明与 TOC 的关联）

## 文章作者与编辑（Article Authorship & Editing）

**Owner（所有者）**:
文章的创建者与唯一所有者，由 `posts.author_id` 指向。创建时固定，**不可变**（无 setter，UpdateInput 不含该字段）。在前台头像组中始终排第一位。
_Avoid_: 作者（在本文档域内歧义，可能指 Editor）

**Editor（编辑者）**:
对某篇文章执行过保存/更新/回滚操作的人，记录在 `post_versions.editor_id`。Owner 自己也可能成为 Editor（编辑了自己写的文章）。一个 Editor 可能编辑过同一篇文章的多个版本。
_Avoid_: 版本作者（混淆了所有者与编辑者）

**Collaborator（协同者）**:
编辑过某篇文章、但**不是 Owner** 的 Editor 集合。从 `post_versions` 按 `editor_id` 去重衍生（排除 owner），按首次编辑时间升序排列。**无需独立关联表**——版本历史是唯一数据源。在头像组中跟在 Owner 之后。
_Avoid_: 合作者（笼统，未说明与版本历史的关系）

## 文章内容元素（Article Content Elements）

**数学公式（Math Formula）**:
正文中的 LaTeX 公式，两种形态：**行内公式（Inline Math）** 嵌在段落文字流中，Markdown 源 `$...$`，HTML 载体 `<span data-type="inline-math" data-latex="...">`；**公式块（Block Math）** 独立成段，Markdown 源 `$$...$$`，HTML 载体 `<div data-type="block-math" data-latex="...">`。化学式与物理单位经 mhchem（`\ce{}` / `\pu{}`），物理宏包命令（`\dv` `\ket` 等）经共享宏表支持。
_Avoid_: 算式（口语，未区分两种形态）

**浏览时渲染（View-time Rendering）**:
content_html 对公式（及未来图块）只存**语义化标记**（data-type + data-latex），最终形态（KaTeX HTML / SVG）在读者浏览器渲染，保存时不烘焙。收益：content_html 体积、主题跟随、源文本可搜索可复制、升级渲染器不动存量数据。编辑端与阅读端共用同一渲染核心。渲染输出经 **hast 白名单管线**（解析 → sanitize 白名单 → React 元素）注入，不使用 dangerouslySetInnerHTML（见 ADR-0005）。
_Avoid_: 烘焙渲染（已否决的保存时渲染路线，见 ADR-0004）

**物理宏表（Physics Macros）**:
共享 KaTeX 宏定义集合，编辑器与阅读端同源，模拟 LaTeX physics 宏包常用命令（`\dv` `\pdv` `\bra` `\ket` `\abs` `\norm` 等）。注意 `\div` 刻意不覆写（与除号冲突），散度用 `\divg`。
_Avoid_: 自定义命令（未说明与 physics 宏包的对应关系）

**弹层编辑（Popover Editing）**:
公式节点的编辑交互：文档内永远只显示渲染结果，点击选中弹出跟随定位的浮层（源码输入 + 实时预览 + LaTeX 自动补全），Esc/点击外部关闭；行内与块级同一交互。图块未来沿用同一交互模型。
_Avoid_: 双态编辑（已否决的内联源码切换，见 ADR-0005）、弹窗编辑（模态对话框）

**图块（Diagram Block）—— 候选，下期实现**:
预留领域概念：带 `format` 属性的通用图块节点（mermaid 等「文本→图」格式），Markdown 载体为对应语言围栏块（```mermaid），渲染走浏览时渲染 + 渲染器注册表（format → 渲染器），编辑交互沿用弹层编辑。本期仅记录决策，未实现。
_Avoid_: MermaidNode（写死单一格式的命名，丧失多格式扩展性）

## 代码执行（Code Execution）

**可运行代码块（Runnable Code Block）**:
文章中可在读者浏览器就地执行的源码块。Markdown 载体为带 `runnable` 标记的围栏块，info string 格式 `<lang> runnable {<ResourceLimits JSON>}`（如 `python runnable {"timeout_secs":10}`）。HTML 载体为带属性的 `<pre data-runnable="true" data-lang="python" data-overrides="{...}" data-source="原始源码">`，data-source 携带 HTML 转义后的原始源码供阅读器无损提取（避免反解高亮 HTML）。
_Avoid_: 可执行代码块（口语未区分「可运行」标记与执行能力）

**代码执行（Code Execution）**:
把可运行代码块的源码提交到后端沙箱容器执行、回流结果的核心能力。后端用 Docker Go SDK 调 unix socket（兼容 docker 与 podman），在隔离容器内执行，stdout/stderr 经 SSE 流式回传到阅读页 xterm.js 终端。支持 python/node/go/rust/bun 五种语言。见 ADR-0006。
_Avoid_: 代码运行（未体现沙箱隔离语义）

**沙箱（Sandbox）**:
执行用户代码的隔离容器。安全约束：cap_drop ALL、no-new-privileges、readonly rootfs、tmpfs（/code 1777、/tmp exec、/run）、network=none（除非显式 allow_network）、memory=swap、pids_limit=64、nofile=64。不设 nproc（non-root 下按 UID 计数会导致初始 exec EAGAIN）。
_Avoid_: 运行环境（未强调隔离）

**资源钳制（Resource Clamping）**:
作者在围栏 info string 里声明的 ResourceLimits 覆盖（timeout/memory/cpu/network/output），在执行前被 `clampLimits` 钳制到全局 `CODE_RUNNER_MAX_*` 上限内，防止滥用。allow_network 需作者声明、语言允许、全局开关三者同时为真。
_Avoid_: 资源限制（未区分作者声明与全局钳制两层）

**Runner 镜像（Runner Image）**:
每种语言对应的执行容器镜像，命名 `yggdrasil-runner-<lang>:latest`（跨项目字面复用 ygggrasil 已构建产物）。镜像内置语言运行时 + 必要的编译缓存重定向（go/rust 把 GOCACHE/CARGO_HOME 指向可写 tmpfs）。
_Avoid_: 语言镜像（未体现 runner 语义）

**两条执行路径（Two Execution Paths）**:
编辑器内点击运行走轮询（提交拿 task_id，轮询 `GetExecResult`）；阅读页运行走 SSE 流式（`StartExecStream` 创建 channel，前端 EventSource 连 `/api/v1/code-runner/run/stream` 实时收 stdout/stderr）。两条路径共用同一套校验链与沙箱。
_Avoid_: 同步/异步执行（未体现回流方式差异）

## 公告展示（Announcement Presentation）

**公告（Announcement）**:
站点向访客推送的内容块，由后端 `announcement` 聚合根承载。可启用/停用、可设生效起止时间。其**展示形态**和**严重程度**是两个独立维度，分别决定"渲染成什么布局"和"用什么颜色/图标"。

**严重程度（Severity）**:
公告的**视觉语义**维度，与布局正交。取值 `info / warning / success / error`，对应配色（蓝/橙/绿/红）与图标。只影响外观，不影响内容深度或布局。
_Avoid_: 公告类型（历史上叫 `type`，既管颜色又被期待管布局，职责过载）

**展示形态（Display）**:
公告的**布局与内容深度**维度，与颜色正交。决定该条公告渲染成哪种布局、需要哪些内容载体字段。固定三态：

- `banner`：顶部横幅条，单行纯文本，复用 `content` 字段。
- `card`：事件票据（详见「事件票据」词条），无封面图，新增 `excerpt` 字段。
- `article`：事件简报（详见「事件简报」词条），新增 `content_md` + `content_html` + `cover_image` + `excerpt` 字段。

同一 `severity` 可搭配不同 `display`；三者字段并存在同一张表，按 `display` 决定哪些可空。

**展示位置（Placement）**:
`display` 的衍生语义，非独立字段。每条公告出现的页面区域由其 `display` **唯一决定**：`banner` 出现在全局顶部横幅（所有非 admin 页面），`card` 和 `article` 出现在首页展示网格。**不存在**"banner 想放首页""card 想放顶部"这种跨区配置——如将来确有需求，再引入独立 `placement` 字段（当前属 YAGNI）。
_Avoid_: 公告类型（同上，混淆了视觉与布局两个正交关注点）

**翻牌横幅（banner 的渲染约定）—— 候选，待实验室验证**:
`banner` 形态的最终生产规格**尚未定论**。当前候选形态（3D rotateX 翻转、CubeToggle 式 Y 轴翻立方等）需先在 `announcement-lab` 实验页里并排对比、选定后才成为正式渲染约定。下述三条为**所有候选共享的不变约束**（无论最终选哪个原型都必须满足）：(1) **排序权威是后端返回顺序**，前端不重排，`severity` 仅为纯视觉维度（配色 + 标签）；(2) **关闭即标记当前可见全部已读**（localStorage），新 id 出现才重现，状态不跨设备同步；(3) **WCAG 2.2.2 底线**——自动动画必须可暂停/停止，`prefers-reduced-motion` 下降级为静态可翻阅。
_Avoid_: 通知条、横幅（未体现创意候选与 severity→标签映射）

**announcement-lab（公告原型实验室）**:
仿照 `theme-lab` 的工作流：做一个 `/announcement-lab` 路由页，把 banner 创意原型（3D 翻转、CubeToggle 式翻立方等）做成**可独立交互的并排原型**，用**静态 mock 数据**（3-4 条不同 severity 的假公告），不接 API。目的：在写生产 `AnnouncementBar` 之前，先在实验室里把玩、对比、选定最终形态，避免在真实页面上反复试错。原型用 `motion/react`（Framer Motion）驱动动画，复用 `theme-lab` 已验证的卡片网格骨架。

**通知卡片（card 形态的渲染约定）**:
`card` 形态渲染为**自包含的通知卡片**，不是文章卡片。核心约束：**无封面图、无作者、无阅读时长、不可点击、无详情页**——卡片本身就是全部内容，`content`/`excerpt` 读完即止。视觉用 `BorderGlow` 柔色发光描边外壳（severity 决定色相）+ severity 药丸徽章 + 标题 `BlurText` 按词渐显 + ID `Counter` 数字滚动。底部显示「通知」标记，明确暗示「这就是全部，没有更多」。severity 配色走 `shared/announcement-severity`（shadcn 色阶）。
_Avoid_: 文章卡片、PostCard（混淆了通知与作品）

**简报（article 形态的渲染约定）**:
`article` 形态渲染为**简报入口 + 详情页**两层。首页卡片是入口：顶部 `cover_image` 封面图（card 形态没有）+ excerpt 摘要 + 底部「阅读 →」引导，**整卡可点击**，跳转 `/announcements/:id` 详情页。详情页是简报，不是文章详情页：无 TOC、无作者头像组、无浏览量。详情页结构：severity 徽章 + `BlurText` 标题 + `AnimatedList` 时间轴（可点击/键盘导航，覆盖默认深色背景为透明）+ affects chip 标签 + `ArticleContent` 渲染 `content_html ?? content_md` 正文 + footer（确认已读用 `Magnet` 磁吸 / 复制 ID / 返回）。severity 配色同样走 `shared/announcement-severity`。
_Avoid_: 文章详情页、blog/$slug（混淆了简报与文章阅读）

**影响范围（Affects）**:
公告影响的**功能模块**字段，DB 列 `affects`（JSON 数组），Go `Affects`，前端 `affects`。**预定义枚举多选**（硬编码，不 DB 驱动），初值基于代码扫描的功能模块边界：`posts / comments / auth / media / search / projects / profile / site`。`site` 为全站兜底值。多选，可空（非必填）。管理员在后台用多选框选择，无法自由输入——保证术语统一、可筛选、可统计。加新功能模块时需同步更新枚举常量 + DB CHECK 约束 + 前端类型（三处同步）。主要消费场景：article 简报的 timeline 区展示、将来可按模块筛选历史公告或受影响模块页面自动弹出对应公告。
_Avoid_: 自由字符串数组（伪结构化，术语会腐烂）、单字符串文本（无法消费）

## MCP 通道（MCP Channels）

博客通过 MCP（Model Context Protocol）向 AI agent 暴露能力，经 PRD-0005/0006/0007 演进形成**三 server 两通道**格局（ADR-0007 + ADR-0008）。

**MCP 三原语（Three Primitives）**:
MCP 暴露能力的三种语义通道，分工正交：**Tools = 动作**（model-controlled，模型自主调用，有副作用）；**Resources = 只读数据**（application-controlled，宿主/用户决定拉取）；**Prompts = 可复用指令**（user-controlled，用户显式选择，如斜杠命令）。本博客的私有/公开分工依据此：私有动作走 Tools，公开只读数据走 Resources，写作模板走 Prompts。
_Avoid_: MCP API（混淆了 MCP 通道与 HTTP REST API 语境）

**私有通道（Private Channel）**:
MCP 体系中需 **PAT 鉴权**的 server，暴露 PAT 持有人的私有视角（含草稿）。含两个 server：`violet`（`/api/v1/mcp`，文章 CRUD + 检索 tool + `polish_draft` prompt，scope `posts:read/write/publish`）与 `violet-scraper`（`/api/v1/mcp/scraper`，抓取 + 订阅 tool，scope `posts:scrape + subscriptions:read/write`）。检索范围 = PAT 持有人的全部文章。

**公开通道（Public Channel）**:
MCP 体系中**匿名可读**的 server（`violet-reader`，`/api/v1/mcp/reader`），仅暴露已发布文章（Resources）与写作风格指南（Prompts），不暴露草稿/公告/评论。与私有通道互补。匿名端点不套 `RequireBearerToken`，独立限流维度 `mcp-reader`。
_Avoid_: 公开 server（未区分通道语义）、reader API（HTTP REST 语境混淆）

**已发布双通道（有意冗余）**:
已发布文章**两通道均可读**：私有 `get_post`（PAT，按 ID）与公开 `blog://posts/{slug}`（匿名，按 slug）。这是**有意为之的非待消除冗余**——匿名读者无 PAT，必须经公开通道触达已发布内容。两通道按"寻址方式（ID vs slug）+ 状态（草稿 vs 已发布）"两维度区分，primitive 描述给选型规则。维护者勿当冗余合并。

**blog:// URI 路径段（状态编码）**:
公开通道 Resources 用 `blog://` scheme（品牌解耦，非 `violet://`，因 scheme 是长期标识符）。路径段编码文章状态：`blog://posts/{slug}` = 已发布（reader 注册）；`blog://drafts/{slug}` = 草稿（仅 `polish_draft` prompt 内部 embed 用，reader 不注册，保持公开通道仅 published 边界）。区分原因是 `EmbeddedResource.URI` 是可寻址标识，agent 可能 `resources/read` 它，草稿必须用独立 URI 避免读到内容不符的已发布旧版。

**react-bits 组件依赖**:
公告 card/article 视觉依赖 react-bits（`https://reactbits.dev/`）的以下组件，项目已配置 `@react-bits` registry（shadcn），用 `pnpm dlx shadcn@latest add @react-bits/<Name>-TS-TW` 安装到 `web/src/shared/vendor/react-bits/`。**已安装**：`BorderGlow`（card 外壳，柔色发光描边）、`BlurText`（标题按词渐显）、`Counter`（ID 数字滚动）、`Magnet`（按钮磁吸）、`AnimatedList`（详情页时间轴）。仍在使用：`DecryptedText`（empty / 404 状态）、`SpotlightCard`（PostCard）。注意：`FluidGlass`（依赖 three.js）与 `SplitText`（依赖 GSAP 商用插件）曾试用后已移除；`ClickSpark`、`Aurora`、`GradientText`、`ParticleField`、`ShinyText`、`CountUp` 等历史原型组件也已移除，不要再装。banner 原型（FlipX / CubeFlipY）在 `announcement-lab` 实验页保留作参考。


## MCP 通道（MCP Channels）

博客通过 MCP（Model Context Protocol）向 AI agent 暴露能力，按**域（bounded context）**拆分独立 server（AWS DDD MCP 实践："Name your MCP servers after the domain they own" + "each server owns one domain"）。混域是 context boundary 设计失败。

**violet-posts（文章域 server）**:`/api/v1/mcp`，PAT `posts:read/write/publish`。文章 CRUD + 文章检索（S1：search_posts/formulas/code_blocks）。原用裸品牌名 `violet`，S3 正名为 `violet-posts`（按域命名）。
_Avoid_: 把评论检索塞进文章 server（评论是独立 bounded context）

**violet-scraper（抓取域 server）**:`/api/v1/mcp/scraper`，PAT `posts:scrape`+`subscriptions:read/write`。scrape_url + 7 个订阅 tool。高风险 SSRF 域，独立限流。

**violet-comments（评论检索 server）**:`/api/v1/mcp/comments`，PAT `comments:read`。检索读者评论/批注反馈（S3：search_comments / list_recent_comments / comment_stats）。评论与文章是独立 bounded context——有独立聚合根/仓储/审核流程/HTTP 权限，故评论检索独立 server，不挂文章 server。用于「读者批注→写作改进」闭环。
_Avoid_: 评论 server（未点明检索/反馈语义）

**写作改进闭环（S1+S2+S3 组合）**:读者批注/评论 → S3 检索反馈（含锚点选区原文 `anchor.selected_text`）→ agent 理解"读者对原文 X 的反馈是 Y"→ S1 get_post 读草稿 / S2 reader 读已发布全文 → agent 起草改进 → update_post 写回。S3 是闭环的"反馈数据接入"环，纯读不越界（评论写操作/审核归后台 UI）。

**MCP status 可见性分工**:approved 评论 ≈ published 文章（都是"已审阅有效内容"），MCP 检索仅消费 approved/published。pending 评论 ≈ draft 文章（未审阅），前者进后台审核 UI、后者进 PAT 私有检索——**pending 不进 MCP agent 上下文**（避免未审阅内容/垃圾污染写作建议）。

**评论锚点选区原文（anchor.selected_text）**:批注（anchor_block_id 非空的评论）携带读者划中的原文片段，是 S3 写作改进闭环的核心字段——它让 agent 精确定位"读者说这段有问题"的"这段"是哪段，构成"读者对原文 X 的反馈是 Y"的完整闭环。自由评论（anchor 为空）无此字段。

## 关于页（About Page）

> 关于页（`/about`）的重构见 PRD-0009。本节定义该域的术语，不含实现细节。

**关于区块（About Section）**:
关于页的可配置渲染单元，分三线：**A 线（关于博主）**含头像/标语、名片卡、技能标签云、社交矩阵；**B 线（关于博客项目）**含站点生命体征（Live Stats）、更新日志、项目时间轴、项目技术栈、"这座博客的数字"、开源致谢。每个区块有显隐开关、排序权重、独立参数（如头像 URL、社交平台列表）。前台按配置渲染、过滤、排序。
_Avoid_: 组件（混淆了渲染单元与 React 组件）、模块（与 FSD 模块混淆）

**区块版面配置（about_config）**:
承载整个关于页版面的**聚合 JSON 配置**，存于 `site_settings` 表单一键 `about_config`。结构为 `{ sections: [{ id, enabled, order, params }] }`——一个键统管所有区块的显隐 + 顺序 + 参数。选聚合 JSON 而非扁平多键，核心原因是**顺序**：区块要自由编排上下位置，扁平 key-value 无法表达顺序。前台拿到数组按 `order` 排序、按 `enabled` 过滤渲染。站长在后台「关于页配置」子页可视化编辑。
_Avoid_: About 设置（未点明聚合配置语义）、区块开关（仅显隐，漏了顺序与参数）

**更新日志（Changelog / Releases）**:
关于页 B 线区块，展示博客项目的版本演进。**数据源是 GitHub Releases API（后端代理 + Redis 缓存）**——GitHub Releases 是 release-please 发版的天然副产物，发版即更新、零手工维护。后端复用现有 `github_token` 提限流到 5000/小时，结果用 Redis 缓存（~1h）解决访客直连必爆限流。呈现对齐业界最佳实践（个人博客变体）：版本时间线卡片 + 日期戳 + **分类标签直接从 release body 的 emoji 行解析**（release-please 已把 commit 类型映射成 ✨新增/🐛修复/♻️重构等）+ Breaking change 醒目标记。**变通业界实践**：受众是技术读者，保留技术事实而非营销话术；舍弃截图/GIF（保证发版零维护）。该能力对齐并增强现有 `/api/v1/github/contributions` 代理模式（后者无缓存，releases 是加缓存层的演进版）。
_Avoid_: CHANGELOG（指仓库根的 release-please 维护文件，非应用能力）、版本日志（口语）

## 推文（Tweets）

> 多用户微博能力，见 PRD-0013。`tweet` 是与 post / comment 平级的独立 bounded context。

**推文（Tweet）**:
登录用户发布的短内容单元：纯文本（≤500 字）+ 最多 4 张图，文本与图片至少其一。三条领域规则：**即发即出**（无先审后发，管理员凭 `tweet:delete-any` 事后删除兜底）、**不可编辑**（聚合根无 Update 路径，反悔 = 删除重发）、**物理删除**（无软删，点赞/评论级联删除）。作者 `author_id` 创建时固定不可变。
_Avoid_: 动态、说说（口语，未对应 tweet 域）、微博（产品名，非领域术语）

**全局时间线（Global Timeline）**:
全站推文按时间倒序的公共信息流，挂在 `/tweets`，匿名可浏览。本功能是**唯一的信息流组织方式**——明确否决 follow 关系与关注首页流。分页用 **cursor**（`(created_at, id)` 复合游标），不用项目惯用的 page/limit：feed 顶部持续插入新数据，offset 分页会重复/漏数据。
_Avoid_: feed（与 RSS 订阅域的 feed 混淆）、关注流（已否决）

**用户主页（推文资料卡）**:
公开路由 `/users/$username`，展示用户头像、用户名、注册时间与其推文列表。**只聚合推文**，不展示其文章/评论等其他活动。是全站第一个公开用户页概念，与登录私域 `/profile` 区分。
_Avoid_: 个人空间（暗示含更多聚合内容）、profile（指登录私域路由）

**推文评论 —— 候选，P2 实现**:
挂推文下的独立评论实体，复用 comment 域楼中楼模式，只在推文详情页出现，**不进时间线**。刻意不采用推特原版「回复即推文」模型。
_Avoid_: 回复推文（混淆了已否决的 reply-as-tweet 模型）

**引用推文（Quote Tweet）—— 候选，P3 实现**:
转发的建模方式：转发本身是一条带 `quote_of` 引用的推文，可带自己的文字（纯转发 = 无文本的引用推文），出现在自己与全局时间线。
_Avoid_: retweet（未体现带引用的内容载体语义）
