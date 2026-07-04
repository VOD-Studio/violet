# mimo-blog

全栈博客平台：Go (Chi) 后端 + React (Vite) 前端，PostgreSQL + Redis。本文档是项目领域语言的术语表，仅定义概念，不含实现细节。

## 认证（Authentication）

**Access Token**:
短期 JWT（默认 15m），承载用户身份，用于访问受保护资源。其 `exp` claim 是过期**权威判据**。
_Avoid_: session token, login token

**Refresh Token**:
长期 JWT（默认 7d），仅用于在 Access Token 过期后换取新的 Access Token。存于 Path 限定为 `/api/v1/auth` 的 HttpOnly Cookie，每个用户同一时刻只有**一个**有效（单槽白名单）。
_Avoid_: session token, long-lived token

**Token Envelope（信封）**:
承载 JWT 的 Cookie。Cookie 的 `MaxAge` 只是信封寿命，与 JWT 的 `exp` 是**两套独立**的过期机制——信封可先于或后于信件失效。信封先失效会导致"JWT 仍有效但取不到"，对 Refresh Token 致命（需重新登录）。
_Avoid_: cookie lifetime（混淆了信封与信件）

**CSRF Token**:
随机不可预测串，采用 double-submit 模式：非 HttpOnly Cookie（前端可读）+ `X-CSRF-Token` header 回传比对。保护**除 `/auth/refresh` 外**的所有写操作；refresh 自身被显式豁免。
_Avoid_: anti-forgery token（笼统）

**Token Rotation（轮换）**:
每次刷新都签发全新的 Refresh Token 并废弃旧的。用于限制单个 refresh token 的暴露窗口，并为"重用检测"提供基础。
_Avoid_: refresh token reuse（这是要检测的攻击，不是机制）

**Token Family（家族）**:
由同一次登录派生、经多次轮换形成的一条 refresh token 链。家族中任何**已被轮换掉的旧 token 再次出现**，几乎必然意味着 token 被窃取——标准响应是吊销整个家族。

**Refresh Token Revocation（吊销）**:
使一个仍有效的 Refresh Token 失效。触发场景：登出、改密码、重置密码、检测到重用。通过删除 Redis 白名单单槽实现。
_Avoid_: logout（吊销是机制，登出是触发场景之一）

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
`banner` 形态的最终生产规格**尚未定论**。当前所有候选形态（3D rotateX 翻转、MOTD 终端、Scramble 解码、Boot Sequence、CubeToggle 式 Y 轴翻立方等）需先在 `announcement-lab` 实验页里并排对比、选定后才成为正式渲染约定。下述三条为**所有候选共享的不变约束**（无论最终选哪个原型都必须满足）：(1) **排序权威是后端返回顺序**，前端不重排，`severity` 仅为纯视觉维度（配色 + 标签）；(2) **关闭即标记当前可见全部已读**（localStorage），新 id 出现才重现，状态不跨设备同步；(3) **WCAG 2.2.2 底线**——自动动画必须可暂停/停止，`prefers-reduced-motion` 下降级为静态可翻阅。
_Avoid_: 通知条、横幅（未体现创意候选与 severity→标签映射）

**announcement-lab（公告原型实验室）**:
仿照 `theme-lab` 的工作流：做一个 `/announcement-lab` 路由页，把多种 banner 创意原型（3D 翻转、MOTD 终端、Scramble 解码、Boot Sequence、CubeToggle 式翻立方等）做成**可独立交互的并排原型**，用**静态 mock 数据**（3-4 条不同 severity 的假公告），不接 API。目的：在写生产 `AnnouncementBar` 之前，先在实验室里把玩、对比、选定最终形态，避免在真实页面上反复试错。原型用 `motion/react`（Framer Motion）驱动动画，复用 `theme-lab` 已验证的卡片网格骨架。

**事件票据（card 形态的渲染约定）**:
`card` 形态渲染为**事件票据（Event Ticket）**，不是文章卡片。核心约束：**无封面图、无作者、无标签、无阅读时长**——这些是「作品」属性，公告是「事件」没有。视觉由四部分组成：(1) 外壳用 `Pixel Card`（像素故障感，区别于文章的 `SpotlightCard` 干净聚光）；(2) `severity=error/warning` 时启用 `Electric Border`（边框电流流动，表达警报激活）；(3) 顶部 metadata bar `EVENT #003 · severity:warn · ACTIVE`，`font-mono` 小字，severity 标签用 `Shiny Text` 金属光泽；标题用 `DecryptedText animateOn="view"` 解码入场，`▸` 终端提示符前缀；(4) 底部票据区 `stamp + status + open manifest`，`font-mono`，事件 id 用 `Count Up` 数字滚动。点击整张卡片跳转 article 详情页。
_Avoid_: 文章卡片、PostCard（混淆了事件与作品）

**事件简报（article 形态的渲染约定）**:
`article` 形态渲染为**事件简报（Event Manifest）**，不是文章详情页。核心约束：**无封面大图、无 H1、无 TOC、无作者头像组、无浏览量统计**——这些是文章详情页专属耦合。视觉分层：(1) 整页底层 `Faulty Terminal` 背景（故障终端纹理，文章详情页绝不会用）；(2) manifest 容器外框 `Electric Border`；(3) 头部 `[WARN] #003` 用 `Shiny Text` + 标题用 `DecryptedText`；(4) timeline 元数据区用 `Animated List` 逐行滑入，只显示三项：`opened`（`created_at` + `created_by`）、`window`（`start_time` + `end_time`）、`status`（`is_active` + 当前时间计算）——全部复用现有字段；(5) 正文用 `ArticleContent`（纯渲染器，只接受 string 输出 DOM，无文章视觉）套在 mono 区块内，外层 `Scroll Reveal` 逐段渐显；(6) footer `acknowledge / copy event id / back`，acknowledge 按钮用 `Click Spark` 点击火花。
_Avoid_: 文章详情页、blog/$slug（混淆了事件简报与文章阅读）

**影响范围（Affects）**:
公告影响的**功能模块**字段，DB 列 `affects`（JSON 数组），Go `Affects`，前端 `affects`。**预定义枚举多选**（硬编码，不 DB 驱动），初值基于代码扫描的功能模块边界：`posts / comments / auth / media / search / projects / profile / site`。`site` 为全站兜底值。多选，可空（非必填）。管理员在后台用多选框选择，无法自由输入——保证术语统一、可筛选、可统计。加新功能模块时需同步更新枚举常量 + DB CHECK 约束 + 前端类型（三处同步）。主要消费场景：article 简报的 timeline 区展示、将来可按模块筛选历史公告或受影响模块页面自动弹出对应公告。
_Avoid_: 自由字符串数组（伪结构化，术语会腐烂）、单字符串文本（无法消费）

**react-bits 组件依赖**:
公告三态视觉依赖 react-bits（`https://reactbits.dev/`）的以下组件，项目已配置 `@react-bits` registry（shadcn），用 `npx shadcn@latest add @react-bits/<Name>-TS-TW` 安装到 `web/src/shared/vendor/react-bits/`。**已安装**：`Aurora`、`DecryptedText`、`GradientText`、`ParticleField`、`SpotlightCard`。**待安装**：`Electric Border`（三态通用 severity 边框）、`Pixel Card`（card 外壳）、`Shiny Text`（severity 标签）、`Count Up`（事件 id 数字）、`Animated List`（article timeline）、`Scroll Reveal`（article 正文）、`Click Spark`（article acknowledge 按钮）、`Faulty Terminal`（article 背景）。注意：react-bits 的 `Terminal` 组件是 PRO 付费，MOTD 终端风格需自行用 `font-mono` + 边框实现。
