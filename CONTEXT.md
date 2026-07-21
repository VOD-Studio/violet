# mimo-blog

全栈博客平台：Go (Chi) 后端 + React (Vite) 前端，PostgreSQL + Redis。本文档是项目领域语言的术语表，仅定义概念，不含实现细节。

## 认证（Authentication）

> 登录态采用 **opaque session cookie** 模型（对标 bilibili SESSDATA），取代历史的 access/refresh JWT。决策与命门不变量见 `docs/adr/0003-login-opaque-session.md`（ADR-0001、ADR-0002 均 superseded）。

**Session ID**:
opaque（不透明）随机串（≥256-bit），作为登录态凭证存于 HttpOnly Cookie `mimo_session`。本身不含任何用户信息，后端必须查 Redis（`session:<id>`）才能换出用户身份。安全性靠 cookie 的 HttpOnly + SameSite + Secure，以及后端可即时删除。
_Avoid_: access token、login token（这些是已废弃 JWT 时代的词）

**Session Envelope（信封）**:
承载 Session ID 的 Cookie 与 Redis key。opaque 模型下过期权威统一在 Redis TTL + 滑动续期 + 可选绝对寿命，不再有「JWT exp vs cookie MaxAge」双过期混淆。
_Avoid_: cookie lifetime（混淆了信封与信件）

**滑动续期（Idle Timeout）**:
后端中间件对每个带有效 session 的真实请求，用 Redis `EXPIRE` 重置 session 剩余寿命。**不轮换 session id、不产生 Set-Cookie**——这是 opaque 方案绕开 TanStack Start SSR 透传卡点的命门。活跃用户因此不会因空闲超时下线。

**绝对寿命（Absolute Timeout / max）**:
可选配置项，从登录起算的 session 最长存活上限。`max <= 0`（0 或 -1）表示无上限（默认）；`max > 0` 时，无论用户多活跃，到点强制重登。session 实际过期 = min(滑动到期, 绝对到期[若启用])。

**CSRF Token**:
随机不可预测串，double-submit 模式：非 HttpOnly Cookie `mimo_csrf`（前端可读）+ `X-CSRF-Token` header 回传比对。token 值同时存于后端 session 记录中，与 session 同生命周期。保护 session 探活端点之外的写操作。对标 bilibili `bili_jct`。
_Avoid_: anti-forgery token（笼统）

**Session 吊销（Revocation）**:
使一个仍有效的 session 失效。触发场景：登出、改密码、重置密码、检测到异常。通过删除 Redis `session:<id>` 实现，即时生效——opaque 模型的核心优势：可即时吊销，不像 JWT 需黑名单。
_Avoid_: logout（吊销是机制，登出是触发场景之一）

**SSR 会话探活**:
SSR（TanStack Start）判断当前请求是否登录的方式：调后端**只读**端点 `/auth/session`，由其读 `mimo_session` cookie 查 Redis 返回 user claims。完整 UserDTO 仍由客户端 useMe 按需拉。
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
content_html 对公式（及未来图块）只存**语义化标记**（data-type + data-latex），最终形态（KaTeX HTML / SVG）在读者浏览器渲染，保存时不烘焙。收益：content_html 体积、主题跟随、源文本可搜索可复制、升级渲染器不动存量数据。编辑端与阅读端共用同一渲染核心。
_Avoid_: 烘焙渲染（已否决的保存时渲染路线，见 ADR-0004）

**物理宏表（Physics Macros）**:
共享 KaTeX 宏定义集合，编辑器与阅读端同源，模拟 LaTeX physics 宏包常用命令（`\dv` `\pdv` `\bra` `\ket` `\abs` `\norm` 等）。注意 `\div` 刻意不覆写（与除号冲突），散度用 `\divg`。
_Avoid_: 自定义命令（未说明与 physics 宏包的对应关系）

**双态编辑（Dual-state Editing）**:
公式节点的编辑交互：未选中显示渲染结果，点击选中切换为源码编辑态（源码输入 + 实时预览），Esc/失焦回渲染态。图块未来沿用同一交互模型。
_Avoid_: 弹窗编辑（已否决）

**图块（Diagram Block）—— 候选，下期实现**:
预留领域概念：带 `format` 属性的通用图块节点（mermaid 等「文本→图」格式），Markdown 载体为对应语言围栏块（```mermaid），渲染走浏览时渲染 + 渲染器注册表（format → 渲染器），编辑交互沿用双态编辑。本期仅记录决策，未实现。
_Avoid_: MermaidNode（写死单一格式的命名，丧失多格式扩展性）

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

**react-bits 组件依赖**:
公告 card/article 视觉依赖 react-bits（`https://reactbits.dev/`）的以下组件，项目已配置 `@react-bits` registry（shadcn），用 `pnpm dlx shadcn@latest add @react-bits/<Name>-TS-TW` 安装到 `web/src/shared/vendor/react-bits/`。**已安装**：`BorderGlow`（card 外壳，柔色发光描边）、`BlurText`（标题按词渐显）、`Counter`（ID 数字滚动）、`Magnet`（按钮磁吸）、`AnimatedList`（详情页时间轴）。仍在使用：`DecryptedText`（empty / 404 状态）、`SpotlightCard`（PostCard）。注意：`FluidGlass`（依赖 three.js）与 `SplitText`（依赖 GSAP 商用插件）曾试用后已移除；`ClickSpark`、`Aurora`、`GradientText`、`ParticleField`、`ShinyText`、`CountUp` 等历史原型组件也已移除，不要再装。banner 原型（FlipX / CubeFlipY）在 `announcement-lab` 实验页保留作参考。

## 网易云协议服务（mimo-music）

> mimo-music 是独立 Go module（`github.com/VOD-Studio/mimo-music`），全量实现网易云 357 接口。架构决策见 `docs/adr/mimo-music-architecture.md`。

**契约（Contract）**:
proto 文件是 mimo-music 对外契约的唯一真相。gRPC server 与 REST 端点都从同一份 proto 生成（grpc-gateway），不存在两套并行文档。Rust/Go/Python 等语言用 protoc 生成的强类型 client 接入。
_Avoid_: 接口定义（混淆了契约与其 gRPC/REST 两种暴露形态）、API 文档（手写的、与 proto 并行的旧概念）

**领域实体（Domain Entity）**:
网易云 357 种响应由收敛的实体组合而成——Song、Artist、Album、Playlist、User、Comment、MV、Video、DJRadio、Toplist、Event 等。每个实体定义一组「网易云原始 JSON 的 struct 镜像 + map 到 proto 的函数」，写一次后全局复用。例如 MapSong 被歌曲详情、每日推荐、歌单曲目、专辑曲目、搜索(单曲)等几十个接口复用。这是「该复用的复用」的落点，把看似 357 次的映射塌缩为约 30 次领域映射加接口级组装。
_Avoid_: DTO（旧统一 model 概念，已被 proto message 取代）、数据模型（混淆了实体与数据库表）

**共享执行引擎（Engine）**:
处理所有接口共享的脏活——加密（weapi/eapi）、HTTP transport、cookie 池选取、重试、熔断、指标、trace。写一次，357 接口复用。拆成 transport/crypto/retry/breaker/selector/metrics 等子包，不做成单文件。
_Avoid_: provider（旧多平台抽象层，已砍）

**接口声明（Endpoint Declaration）**:
每个网易云接口作为一等公民拥有的完整处理集合：强类型 proto 契约、登录态判定、网易云 endpoint 元数据、入参映射、响应组装、缓存策略、错误映射。元数据由 protoc-gen-netease 从 proto custom option 生成，消除样板；入参映射与响应组装是每个接口不可省的专属工作（响应组装调领域实体的 map 函数）。
_Avoid_: handler（旧手写 HTTP 概念，已被 gateway 生成取代）、endpoint（在不指明「声明」时易混淆）

**薄便利层（Convenience Layer）**:
`pkg/mimomusic/` 的定位。只做 gRPC 连接管理加配置 sugar，绝不镜像接口签名。契约全在 gen/go，调用方拿到的是生成的原生 client。边界立死，防止长回独立契约。
_Avoid_: SDK 库（旧概念，曾镜像全部接口签名，已被 proto 生成取代）

**Session 池（Session Pool）**:
网易云 cookie 的并发安全管理。SessionStore 是一等公民，接口含 GetAvailable（按 api 选取可用 session）、ReportSuccess、ReportFailure。后期支持权重、健康度、限流、风控。
_Avoid_: cookie 轮换（只描述了动作，未体现池化与上报机制）

## musicctl CLI（可发现性与补全）

> musicctl 是 mimo-music 的命令行入口，直连 engine + endpoint 声明，不经 gRPC/gateway。定位是「网易云接口调试与实用工具」（工具型），不是娱乐客户端。输出层（Phase A）已完成；播放/下载/歌词（Phase C）见 PRD-0013；可发现性与补全属双轨道 ADR 的第三类（纯 CLI 工程化，不消费 rpc），并入 [roadmap Phase E](../../mimo-music/docs/musicctl-roadmap.md)（工程化与可发现性见 PRD-0014）。

**工具型定位（Tool-first）**:
musicctl 的裸跑行为是「智能 onboarding」——检测登录态，未登录给登录引导，已登录推荐今日该跑的命令，输出走 stderr 不污染 stdout。**不**像 go-musicfox 那样裸跑直接进 TUI 主菜单。Phase D 的 TUI 作为独立增强，用 `musicctl tui` 显式进入，**不抢占裸跑默认行为**——即使 TUI 落地后，musicctl 仍是工具型 CLI，TUI 是可选形态而非默认形态。
_Avoid_: 客户端（混淆了工具型 CLI 与娱乐型客户端的定位）

**召回池（Recall Pool）**:
所有可被 Tab 补全召回的候选集合。三类来源汇入同一池子，各带来源标签与 TTL：(1) **主动**——用户显式跑过的 search 关键词与 detail 查询；(2) **隐式**——任何命令的 `--id` 被成功消费后自动埋点（play/download/like 等，**只记成功操作**，失败不进池）；(3) **远端**——红心列表、我的歌单、每日推荐的快照（24h TTL，超期强制重拉）。召回池是「补全只走缓存」路线的数据基础：补全绝不实时查网易云，候选全部来自召回池。隐式埋点是**透明基础设施**——由 kit 层在命令执行成功后统一记录，A 类 Context 接入新 rpc 时无需关心埋点（符合[双轨道 ADR](docs/adr/mimo-music-dual-track-orchestration.md)的「A 类只做 rpc→CLI 1:1 接入」原子性）。
_Avoid_: 历史（过于宽泛，未区分主动/隐式/远端三类信号）、收藏列表（只覆盖远端一类）

**召回池持久化（Recall Pool Persistence）**:
召回池的磁盘落地是 `~/.musicctl/history.jsonl`——**append-only JSONL**，不用 JSON。理由：追加一行不需重写整个文件；单行损坏只丢该行历史全留；可被 `grep`/`head`/`tail`/`wc -l` 直接处理；容量裁剪按行 drop oldest。三类来源用 `src` 字段（`search`/`play`/`remote` 等）区分，不拆三个文件。容量上限 1000 行（约 80KB），超限 drop oldest。与 session.json 同目录，权限 0600。
_Avoid_: history.json（单文件 JSON，追加要重写、损坏全丢、不可用 Unix 工具直读）、三文件分离（破坏 JSONL 单流追加与 grep 能力）

**补全只走缓存（Cache-only Completion）**:
musicctl 的参数补全（`--id <TAB>` 等）**绝不触发实时网络查询**，候选全部来自召回池（内存优先，磁盘兜底）。理由三条：网易云 ID 是纯数字无语义，用户不会「记得」ID 来输入，实时搜索的输入成本不低于直接跑 search；Tab 是同步阻塞，网络慢即卡顿；短时高频查询触发网易云风控。「发现」交给用户主动跑 search 命令，「复用」交给补全——这是 musicctl 的可发现性边界。
_Avoid_: 实时补全（gh CLI 的 PR 号实时查询路线，musicctl 明确不走）

**位置参数（Positional Argument）**:
所有单值 `--id` 命令与 `search --keyword` 支持 `<value>` 等价 `--flag <value>`，对齐 git/kubectl 约定（`git checkout branch` 不写 `--branch`）。规则：同时指定 `--id` 与位置参数报歧义错；位置参数不进补全（补全只在显式 `--flag <TAB>` 时触发）；别名命令（如 `pp`/`dl`）同样支持位置参数。`--uid`/`--tracks` 等多值/低频 flag 不纳入位置参数化。
_Avoid_: 简写（未说明等价语义与歧义规则）

**双字符别名（Two-letter Alias）**:
musicctl 的命令别名规范为**双字符**，不使用单字母。理由三条：(1) 音乐领域天然多 P/S 开头单词（song/search、playlist/play），单字母结构性撞前缀；(2) cobra 子命令前缀匹配 + 别名不进 tab 补全（issue #1852），单字母撞前缀时补全行为诡异；(3) Microsoft System.CommandLine 官方指引明确建议「尽量减少单字符别名」，git/kubectl 生态清一色双字符（gs/gp/kd/kg）。首发清单：`pp`=song play、`dl`=song download、`pll`=playlist download、`se`=search、`rd`=recommend daily-songs、`whoami`=login-status（不用 `ls`——会与 unix `ls` 列文件命令心智撞车，违反 clig.dev 最小惊讶原则）。别名**不进 tab 补全**，必须在 onboarding 与 `--help` 里显式列出，否则用户发现不了。
_Avoid_: 单字母别名（结构性撞前缀 + 误触风险）、短别名（未说明双字符的工程理由）、`ls` 别名（与 unix `ls` 列文件命令心智冲突）

**场景化 onboarding（Contextual Onboarding）**:
裸跑 `musicctl` 已登录时的推荐命令按**粗粒度时段切换**，不写死同一组：晨间(06-11)推 `recommend daily-songs`、午间(11-18)推 `recommend playlists`、晚间(18-23)推 `fm`、夜间(23-06)推 `song play --id <TAB>`（从召回池复听，不推新）；**周末优先级高于时段**（周六 10 点推周末推荐，不推日推），周末推 `recommend playlists` + `album shelf`。时段→命令映射硬编码，零新依赖（不读召回池），时区取系统本地（`time.Now().Local()`，不引入时区配置）。推荐中若出现可补全的命令，用 `<TAB>` 符号标注（如 `musicctl song play --id <TAB>`）——这是 Unix 文化约定，比自然语言「(按 Tab 选歌)」紧凑，且 onboarding 的核心目的就是教育可发现性。未登录场景固定给登录引导，不参与场景化。
_Avoid_: 个性化推荐（依赖召回池，过度工程）、静态推荐（所有人同一组，第三次就腻）、精确小时切换（10:59 与 11:01 推不同内容会造成边界抖动）

**预热与兜底（Warm-up & Fallback）**:
召回池的加载策略：启动时读磁盘（上次缓存，秒级，离线可用）→ 同时起后台 goroutine 异步拉红端快照（红心/歌单）→ 拉完更新内存并写回磁盘。Tab 时优先读内存，内存缺失（后台未拉完）则用磁盘兜底。**绝不阻塞主命令、绝不阻塞裸跑 onboarding**。goroutine 用 **fire-and-forget** 模式——musicctl 是一次性 run-and-exit CLI，命令返回时直接退出，不等待后台拉完；进程退出时未完成的写入直接丢弃，由 tmp+rename 原子写保证主文件不被半拉子数据污染（写 `history.jsonl.tmp` 再 rename）。主动/隐式部分即时写盘；远端快照 24h TTL，超期强制重拉。
_Avoid_: 启动拉取（暗示同步阻塞，与「后台异步」相悖）、signal.NotifyContext 长驻式优雅关闭（一次性 CLI 不适用，留给 Phase D TUI）

**召回池排序（Frecency 排序）**:
召回池候选的排序规则是 **frecency**（frequency + recency）：score = Σ（每次事件 × 时段桶权重 × src 类型权重），装载时对 JSONL 事件流聚合得出，**存储不变、无新字段**。时段桶沿 atuin-z 工程化分法：1 小时内 ×4、当天 ×2、本周 ×0.5、更早 ×0.25；src 类型权重沿 Mozilla frecency 的「访问类型加权」：`play`/`download`（主动消费，强意图）> `search`/`detail`（显式查询）> `remote`（被动快照）。直接服务夜间「复听」场景：常听的歌不被「最近碰巧听一次」顶掉。
_Avoid_: 纯时间倒序（shell history 式，高频老歌沉底）、SQLite 上下文排序（atuin/McFly 式，对单用户工具过度工程）

**别名展开（Alias Expansion）**:
跨级别名（`pp`=`song play` 等）用 **argv 重写**实现：执行路径把 `args[0]` 的别名替换为展开式，`__complete`/`__completeNoDesc` 补全请求路径同样重写 `args[1]`（透过别名补全可用）。别名不进命令树——tab 补全天然不含别名；`--help` 以静态别名节显式列出。机制与 git `run_argv()` 预分派展开、gh `expandedArgs` 预处理、cargo `[alias]` 展开同款。cobra 原生 `Aliases` 字段只对同级生效，不适用跨级。
_Avoid_: root 桩命令（命令树重复，「help 可见但补全不可见」需额外定制，hidden 会两者全藏）

**统一补全注册（Centralized Completion Mounting）**:
参数补全由 kit 层在 root 构造后**一次树遍历统一挂载**，表驱动（flag 名 → 数据源）：`--id` → 召回池候选，`--level`/`--area`/`--op` 等 → 固定枚举。个别命令的异构补全需求可就地 `RegisterFlagCompletionFunc` 覆盖。新命令（A 类 rpc 1:1 接入）零登记、零遗忘——与隐式埋点同属 kit 层透明基础设施。表驱动保证未来新 flag 类型只加一行表项。
_Avoid_: 每命令显式注册（同构规则 78 份复制，必然漂移，还需另立守护规则防忘）

**doctor（环境自检）**:
`musicctl doctor` 输出 ✓/✗/! 逐项清单 + 每项可操作的修复指引，走渲染层（`--json` 白拿，bug report 可直接粘贴）。检查项：版本/会话与网络（一次轻量 RPC 自检合一）/补全安装指引/音频后端。退出码：任一 **fail** 项 → exit 1（落入 PRD-0012 退出码体系，可脚本化）；**warn**（如 headless 环境无音频设备——合法场景，用 `song download`）不影响退出码。
_Avoid_: 纯咨询式恒 0（不可脚本化，与仓库退出码体系不咬合）

**文档双轨（Dual-track Docs）**:
musicctl 文档分两层：手写流程手册（`mimo-music/docs/musicctl.md`，只写安装/登录/常用流，命令细节一律指向 `--help`）+ cobra `GenMarkdownTree` **生成**的全命令参考（入库），freshness 守护测试重新生成并 diff 强制同步。依据 clig.dev 文档双轨：web 可搜索可链接 + 与安装版本同步；生成物非手写真相，天然不腐烂。
_Avoid_: 手写命令参考（两份真相必然腐烂）、只做生成参考（缺上手路径）
