# PRD-0009：About 页重设计 + 更新日志

> 状态：ready-for-agent
> 北极星：把 About 页从"四块静态字符串的薄页面"重构为"关于博主 + 关于博客项目"双线并行的丰富自述页，新增更新日志能力，且全部区块可由站长在后台可视化地控制显隐与排序。
> 范围：前端 About 页重写、后台设置 IA 重构（设置子菜单 + About 配置页）、后端新增 3 个公开只读接口（releases / stats / posts heatmap）+ 配置存储扩展。
> 适用项目领域词汇：见 `CONTEXT.md`；本文档新增「About 区块」「更新日志」域词汇，应回写 `CONTEXT.md`。

## Problem Statement

作为博客的访客，我打开 About 页（`/about`），看到的是一个**单调、信息稀薄**的页面：站名 + 描述（渐变光斑 Hero）、纯文本 bio、一坨字符串 split 出的技术栈标签、两个社交卡片。它既没说清"博主是谁"，也没说清"这个博客项目本身是什么、怎么演进过来的"。所有内容来自 `GET /api/v1/settings` 的几个标量字符串字段，没有任何动态数据、统计、版本或更新日志。

作为博客的站长，我想在 About 页展示更多内容（头像、名片、社交矩阵、站点统计、更新日志、项目时间轴等），但**后台无处可配**——且现有后台设置页（`admin.settings.tsx`）已经是一个 8-section 纵向堆叠的单页大表单，"东西越来越多"正在崩塌，About 配置硬塞进来会让它彻底不可用。

## Solution

三件事并行：

1. **重写 About 页**为"关于博主（A 线）+ 关于博客项目（B 线）+ 互动（C 线）"三线并行的丰富自述页，区块按 `about_config` 配置渲染（显隐 + 排序）。
2. **后台设置 IA 重构**：把扁平的单页设置拆成「设置」分组下的多个子页面，侧边栏支持可折叠子菜单；About 配置作为其中一个子页，承载 14 个区块的开关 + 拖拽排序 + 参数表单。
3. **后端新增 3 个公开只读接口**（releases / stats / posts heatmap）+ `about_config` 聚合配置存储，为 About 页提供"活数据"。

### 区块清单（14 个，A/B/C 三线）

**A 线 · 关于博主（人）**

| ID | 区块 | 数据来源 |
|---|---|---|
| A1 | 头像 + 一句话标语（tagline） | 新增设置项 `avatar_url` / `tagline` |
| A2 | 博主名片卡（role / location / available_for / email） | 新增设置项 |
| A3 | 技能/兴趣标签云（升级版，拆「擅长」「在学」「兴趣」三组） | 新设置项（替换 `tech_stack` 的单字符串） |
| A4 | 社交矩阵（扩展 GitHub/Twitter/Mastodon/Email/RSS/Bilibili 等） | 新增设置项 |

**B 线 · 关于博客项目（站）**

| ID | 区块 | 数据来源 |
|---|---|---|
| B2 | 站点生命体征（Live Stats：文章数/总字数/评论数/运行天数，跳动数字） | **新接口** `GET /api/v1/stats`（公开只读） |
| B3 | 更新日志（版本时间线卡片 + 分类标签） | **新接口** `GET /api/v1/releases`（后端代理 GitHub Releases + Redis 缓存） |
| B4 | 项目时间轴（建站→里程碑→版本发布，更新日志嵌入叙事） | releases 数据 + 可选手工里程碑设置项 |
| B5 | 技术栈展示（项目向：Go/React/PG/Redis + 用途 + 图标徽章） | 新增设置项 `project_stack` |
| B6 | "这座博客的数字"（代码行数 / commit 数 / 部署次数） | 聚合数据（接口复用 stats 或扩展） |
| B7 | 开源致谢（造这个博客用到的开源项目） | 新增设置项 `thanks` 或读 `package.json` 依赖 |

**C 线 · 互动 / 趣味** —— **移出本期，见 Out of Scope**

### 关键架构决策

- **更新日志数据源 = GitHub Releases API（后端代理 + Redis 缓存）**。GitHub Releases 是 release-please 发版的天然副产物（`deploy.yml:262-297` 已在抽取 CHANGELOG 段落生成 Release notes），发版即更新、零手工维护。后端复用现有 `github_token`（settings 里已有，admin-only）调 GitHub API 提限流到 5000/小时，结果用 Redis 缓存（如 1 小时）解决访客直连必爆限流的问题。**对齐并增强**现有 `/api/v1/github/contributions` 代理模式——该模式已存在但无缓存，releases 是它的演进版（加缓存层）。
- **About 配置存储 = `about_config` 聚合 JSON 键**（复用现有 `site_settings` key-value 表，不新建表）。一个键存整个 About 页版面：`{ sections: [{ id, enabled, order, params }] }`。前台拿到数组按 `order` 排序、按 `enabled` 过滤渲染。选聚合 JSON 而非扁平多键，核心原因是**顺序**：14 个区块要自由编排上下位置，扁平 key-value 无法表达顺序。
- **后台设置 IA = 分组子菜单**。侧边栏「站点设置」从叶子项升级为可折叠父项，子项是拆出的设置子页（基础 / 关于页配置 / 认证 / GitHub / LLM / 代码运行器）。`AdminNavItem` 加可选 `children?: AdminNavItem[]`，`AdminSidebar` / `AdminMobileNav` 渲染侧加折叠展开，权限沿用现有 `permissions`（父项任一子项可见则可见）。
- **更新日志呈现对齐业界最佳实践**（个人博客变体）：分类标签直接从 release body 的 emoji 行解析（release-please 已把 commit 类型映射成 ✨新增/🐛修复/♻️重构等），映射成带颜色的 Chip；Breaking change 醒目标记；时间线卡片 + 日期戳。**变通业界实践**：violet 受众是技术读者，保留技术事实而非营销话术；**舍弃**截图/GIF（保证发版即自动出现、零维护）、标签筛选器（发版量不大）、视频讲解。版本号（B3/B4 的锚点）需打通注入——运行时由 releases 接口顺带返回当前版本（从 GitHub Releases 最新一条或 manifest）。

## User Stories

### 访客（读者）

1. 作为访客，我打开 About 页，能立刻看到博主的长相（头像）和一句话定位（tagline），这样我能快速知道这是谁。
2. 作为访客，我能看到一张博主名片卡（身份/所在地/是否接活/联系邮箱），这样我能判断要不要联系博主。
3. 作为访客，我能看到博主分了组的技能/兴趣标签（擅长/在学/兴趣三组带配色），而不是一坨扁平字符串，这样信息更有层次。
4. 作为访客，我能看到博主的完整社交矩阵（GitHub/Twitter/Mastodon/Email/RSS/Bilibili），这样我能去关注/联系。
5. 作为访客，我能看到博客的"生命体征"——文章总数、总字数、评论数、运行天数，用跳动的大字呈现，这样我感到这个站是活的。
6. 作为访客，我能在 About 页看到博客的更新日志（版本时间线 + 分类标签），这样我知道这个项目怎么演进的、最近更新了什么。
7. 作为访客，我能看到一条项目时间轴（建站→里程碑→各版本），更新日志嵌在其中，这样我理解项目的历程叙事。
8. 作为访客，我能看到"这座博客的数字"（代码行数/commit 数/部署次数），这样我对项目规模有概念。
9. 作为访客，我能看到造这个博客用到的技术栈（项目向，带图标和用途说明），这样我能学习借鉴。
10. 作为访客，我能看到开源致谢墙（用到的开源项目列表），这样我了解项目的依赖谱系。
11. 作为访客，我看到"你是今天第 N 位访客"和地域分布，这样我有参与感。**（C 线，移出本期）**
12. 作为访客，我看到博主在线状态的绿点（"3 分钟前活跃"），这样我知道博主在不在。**（C 线，移出本期）**
13. 作为访客，我能点"随机看一篇"按钮跳到一篇随机文章，这样我不知道看什么时有入口。**（C 线，移出本期）**
14. 作为访客，我能在 About 页直接给博主留言/悄悄话，这样我有渠道反馈。**（C 线，移出本期）**

### 站长（后台）

15. 作为站长，我打开后台，看到「设置」是可折叠的子菜单（不再是单页大表单），这样我不被无关设置淹没。
16. 作为站长，我点开「关于页配置」子页，能看到 14 个区块的列表，每个有显隐开关，这样我能控制 About 页展示什么。
17. 作为站长，我能拖拽排序这 14 个区块，这样我自由编排 About 页的上下位置。
18. 作为站长，点开每个区块能编辑它的参数（如头像 URL、社交平台列表、名片字段），这样我填充内容。
19. 作为站长，保存后前台 About 页立即按新配置（显隐+顺序+参数）渲染，无需重新部署。
20. 作为站长，更新日志区块无需我手工维护——发版（release-please 合并 release PR）后 GitHub Releases 自动更新，About 页下次刷新即出现新版本。
21. 作为站长，各设置子页（基础/认证/GitHub/LLM/代码运行器）独立路由、独立保存，这样它们互不干扰、各司其职。

### 系统 / 非功能

22. 作为系统，后端代理 GitHub Releases 时用 Redis 缓存，这样即使大量访客访问也不撞 GitHub API 限流。
23. 作为系统，GitHub API 失败或限流时，About 页更新日志区块优雅降级（显示缓存或空），不导致整页 500。
24. 作为系统，公开只读的 stats / heatmap / releases 接口不泄露 admin-only 数据（如完整 settings、后台统计的敏感维度）。
25. 作为系统，About 页所有新增区块在 `about_config` 缺失或某区块 `enabled:false` 时不渲染、不报错。

## Implementation Decisions

### 模块与接口

**后端（DDD 四层，对齐现有 github/settings 模块结构）**

- 新增 `releases` 域模块（`domain/releases`、`application/releases`、`infrastructure/github` 扩展或新 adapter、`interfaces/http/handler/releases`、`app/releases_container.go`）：
  - `GitHubProvider` 端口扩展 `GetReleases(ctx, owner, repo, token)`（或独立 `ReleaseProvider` 端口，视解耦度——优先复用现有 `infrastructure/github/adapter.go`）。
  - application 层：调 provider 拉 releases → 解析 body 的 emoji 行成分类标签 → Redis 缓存（key 如 `releases:cache`，TTL ~1h，失败回退缓存）→ 返回 DTO（含 version/date/notes 分类/breaking 标记/当前版本）。
  - 公开路由 `GET /api/v1/releases`（无需鉴权，在 CSRF 中间件外或内均可，参照 contributions）。
- 新增 `stats` 公开端点：现有 `application/stats` 的 `GetDashboardStats` 是 admin-only。新增公开只读变体 `GetPublicStats`，只暴露安全字段（文章数/总字数/评论数/运行天数），**不暴露** admin 维度。handler 复用或新增 `GetPublicStats`。
- 新增 `posts/heatmap` 公开端点：聚合 `posts` 表按日发文数（复用 posts domain/application 或加只读查询）。路由 `GET /api/v1/posts/heatmap`。
- 扩展 `settings`：新增 `about_config` 键的读写（JSON 值编解码）+ `GetPublic` 白名单加入 `about_config`。其他新设置项（avatar_url/tagline/role/location/social 矩阵/project_stack/thanks 等）作为新 settings 键加入 `SiteSettings` 聚合与 `UpdateInput`

**前端（FSD 分层）**

- 重写 `web/src/routes/about/index.tsx`：消费 `about_config` + 各数据 hook，遍历区块数组渲染。区块组件放在 `web/src/features/about/ui/`（feature 私有，不进 `shared/`）。
- 新增 hooks：`useReleases`、`usePublicStats`、`usePostsHeatmap`。
- 后台设置 IA 重构：
  - `AdminNavConfig.ts`：`AdminNavItem` 加 `children?`，「站点设置」升级为父项，子项为各设置子页。
  - `AdminSidebar.tsx` / `AdminMobileNav.tsx`：渲染折叠子菜单。
  - 拆 `admin.settings.tsx` 为多个子路由（`admin.settings.general` / `admin.settings.about` / `admin.settings.auth` / …），各独立表单。
  - 新建 `admin.settings.about.tsx`：14 区块开关 + 拖拽排序 + 参数表单（提交 `about_config` 聚合 JSON）。

### API 契约（高层）

- `GET /api/v1/releases` → `{ current_version, releases: [{ tag, published_at, categories: [{emoji,label,items[]}], breaking: bool }] }`
- `GET /api/v1/stats`（公开）→ `{ posts_count, total_words, comments_count, uptime_days }`
- `GET /api/v1/posts/heatmap` → `[{ date, count }]`
- `GET /api/v1/settings` 的公开响应新增 `about_config`（聚合 JSON）+ 各 About 内容字段。

### Schema 变更

- 无新表（`about_config` 及新内容字段复用 `site_settings` key-value 表，直接插键）。

## Testing Decisions

**两条 seam（前后端各一，因属两个独立发布单元）：**

- **Seam 1（前端 · About 区块渲染行为）**：测"配置 → 渲染结果"外部行为。给定 `about_config`（含 enabled/order/params），断言渲染出的区块集合正确（disabled 不渲染、order 决定顺序、各区块消费正确数据）。优先复用现有组件测试 seam（vi + RTL，对齐 `web/src/features/posts/ui/ArticleToc.test.tsx`）。**不测**：内部状态机、拖拽手势细节。
- **Seam 2（后端 · 新接口 handler 行为）**：用 `httptest` + mock provider/store，测 handler 编排行为：releases 接口调通返回分类解析结果、GitHub 失败/限流时降级、token 缺失降级；stats 公开端点不泄露 admin 字段；heatmap 聚合正确。**新建 handler 测试 seam**（现有 github/settings/stats 模块零 handler 测试，这是补上的机会）。**只测外部行为**（HTTP 响应、降级、字段过滤），不测 provider 内部 HTTP 细节。

好测试的标准：只断言外部可观察行为（渲染输出 / HTTP 响应），不断言实现细节（内部调用次数、状态机中间态）。任何能通过好测试的实现重构都不应让测试变红。

### 实现期 seam 落地情况（实现后补记）

- **Seam 1（前端）已落地**：补了 `about-config` 解析的单测（8 例，容错/排序/可逆往返）与 `AdminSidebarBody` 子菜单渲染测试（4 例，折叠/展开/命中自动展开）。
- **Seam 2（后端）未落地——已知缺口**：code-review 发现**仓库后端从未有测试基建**（全 `api/` 零 `_test.go`、go.mod 无 testify/gomock、Makefile 无 `api-test` 目标）。PRD 原设想的 `make api-test` 与"补 handler 测试"在现实中是从零搭建整条后端测试 harness（mock 框架 + httptest + fake store），属独立基建工作，超出本 PRD 单功能范围，也违背仓库极简风格。**决策：不在本 PRD 强行引入后端测试基建**，记录为已知缺口；安全断言（公开 stats 不泄露 admin 字段、releases 降级链）改由代码审查 + 字段白名单硬编码保障。若将来要立后端测试，应作为独立的"后端测试基建"专项，而非绑在单个 feature 上。


## Out of Scope

- **C 线（C1–C4 互动/趣味）整体移出本期**（已确认）：C1 访客足迹 / C2 博主在线状态需新建访客追踪/在线状态基础设施（接口 + 存储 + 隐私考量），C3 随机文章 / C4 留言虽复用现有接口但仍需新 UI 与交互。本期核心是"About 重设计 + 更新日志 + 后台 IA"，C 线拆为后续 PRD（如 PRD-0010）独立推进。
- 不做更新日志的截图/GIF 能力（保证发版零维护；业界 Linear 式可视化留待将来）。
- 不做 changelog 标签筛选器、版本分页聚合（violet 发版量不大，时间线全量展示即可）。
- 不做 About 配置的实时多端协同编辑（后台单编辑者假设）。
- 不重构现有 `/github/contributions` 加缓存（仅 releases 加；contributions 加缓存是独立优化，另行处理）。

## Further Notes

- **业界最佳实践研究依据**：分类标注（New/Improved/Fixed/Removed + 颜色）、日期戳、时间线卡片、Breaking 醒目标记均直接适用；"以用户收益措辞""截图/GIF"是面向 SaaS 终端用户的营销实践，violet 作为技术博客受众要技术事实，故变通保留技术事实、舍弃截图。release-please 已把 commit 类型映射成 emoji，分类标签数据源天然自带。
- **数据源权威性**：GitHub Releases 与仓库 CHANGELOG.md 是 release-please 产出的两份等价数据，GitHub Releases 是权威源（deploy.yml 已从 CHANGELOG 抽段落生成它）。
- **本次新增域词汇**（应回写 `CONTEXT.md`）：About 区块（about section）、更新日志（changelog / releases）、about_config（区块版面配置聚合）。
- **后续**：PRD 定稿后用 `/to-issues` 拆分为独立可抓取的 issue（前后端分离、公共组件单独成 issue），每个 issue 起独立 session 用 `/implement` 推进。
