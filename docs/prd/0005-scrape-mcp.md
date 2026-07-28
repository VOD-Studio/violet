# PRD: 抓取 MCP（同步抓取 + RSS 订阅 + 转载文章）

## Problem Statement

博客当前只能手动在编辑器里写文章，没有从外部抓取内容的能力。站长想转载其他博客的文章时，要手动复制粘贴正文、补 SEO 信息、记录源链接，且 Post 模型本身没有"转载"概念，无法区分原创与转载，搜索引擎也无法识别 canonical 归属。

同时，已接入的 MCP（5 个 post tool）只覆盖"写自己写的文章"这一条路径。LLM agent 想帮站长"抓取外站文章建草稿""定时订阅某博客的新文章自动进草稿箱"都做不到。

## Solution

扩展现有 MCP，新增两个能力：

1. **同步抓取**：`scrape_url` tool 输入 URL，复用现有 `ImportURL` 抓取管线（readability + meta/SEO 提取 + 数学公式保留 + 可选 AI 公式修复），返回结构化数据（标题、Markdown 正文、HTML 正文、excerpt、canonical_url、cover_image、SEO）。agent 审阅后调现有 `create_post` 建草稿。

2. **RSS 订阅 + 定时抓取**：用户/agent 注册 RSS feed 订阅（feed URL + 抓取频率 + 转载标记 + 默认标签），后端定时任务（复用 `job/cleanup_job.go` 的 ticker 模式，有界并行 worker pool）按频率拉 feed、解析新 entry、对未见过的 entry 去重、抓取正文建草稿。失败按业界标准（Miniflux 共识）自动暂停。

为承载转载语义，Post 实体新增 `canonical_url` 字段（业界 SEO 标准术语，Ghost/DEV.to/Bear Blog/FreshRSS 共识）：NULL = 原创，非空 = 转载，渲染层输出 `<link rel="canonical">` 给搜索引擎 + 标题下最小可见标记给读者。

## User Stories

### 同步抓取

1. 作为站长，我想给 MCP agent 一个 URL，让它抓取并返回结构化文章数据（标题、正文 Markdown、excerpt、canonical_url、SEO），这样我能快速把外站文章搬进草稿箱
2. 作为站长，我想让 agent 在抓取后先返回数据供我审阅，再决定建不建草稿、用什么标题、补什么 canonical，这样我对外站内容有最终编辑权
3. 作为站长，抓取数学博客时我想让公式被正确保留（LaTeX 行内/块级），这样转载后公式不丢
4. 作为站长，抓取失败时我想看到清晰的错误（网络失败 / readability 退化 / SSRF 命中），这样我能判断是该重试还是源站问题
5. 作为站长，我想抓取的 canonical_url 自动取源文章的 og:url / `<link rel=canonical>`，这样转载文章的 SEO 归属正确

### RSS 订阅

6. 作为站长，我想注册一个 RSS feed 作为订阅源（feed URL + 抓取频率），这样后端会自动定期拉取新文章进草稿箱
7. 作为站长，我想从 hourly / every-6h / daily / weekly 四档里选抓取频率，这样能按源博客更新节奏配置（高频博客每小时，周更博客每天/每周）
8. 作为站长，我想给订阅配置默认标签（如 `["转载", "技术"]`），这样该订阅抓来的文章自动打标签便于分类
9. 作为站长，我想给订阅配置"抓来是否自动发布"（auto_publish，默认否），这样默认走草稿审阅流程，确认安全后才直发
10. 作为站长，订阅源站临时挂掉时我希望下次调度自动补抓（不重试当前轮），这样源站恢复后漏掉的 entry 还在 feed 窗口里能补上
11. 作为站长，订阅源站持续不可达（连续 5 次失败）时我希望订阅自动暂停，避免无限重试浪费资源
12. 作为站长，订阅源返回永久错误（HTTP 4xx 或 malformed XML）时我希望立即暂停，不浪费 5 次重试
13. 作为站长，订阅源返回 429 + Retry-After 头时我希望后端尊重它推迟抓取，避免被源站封 IP
14. 作为站长，某条 entry 正文抓取失败时我希望最多补抓 3 次，超过后标记 dead 不再重试，这样瞬时网络问题能恢复、永久问题不堆积
15. 作为站长，我想在后台订阅管理页看到每个订阅的状态（active/paused）、最近抓取时间、失败计数、最近错误，这样订阅出问题我能发现
16. 作为站长，我想手动暂停/恢复某个订阅（恢复时清零失败计数），这样能临时停抓或恢复自动暂停的订阅
17. 作为站长，我想编辑订阅参数（改 URL、改频率、改标签），这样订阅配置可调整不必删除重建
18. 作为站长，我想删除订阅（连带删除其 entry 记录），这样不再需要的订阅能彻底清理
19. 作为站长，我想通过 MCP agent 管理订阅（建/列/改/暂停/恢复/删），这样我能在 Cursor/Claude Code 里用自然语言配订阅
20. 作为站长，同一篇文章被多个订阅源抓到时我希望各订阅独立处理（不做跨源去重），这样误判风险低、撞了删一个即可

### 转载语义与渲染

21. 作为站长，我想给文章标记转载源 URL（canonical_url），这样文章能区分原创与转载
22. 作为站长，转载文章详情页的 `<head>` 我希望输出 `<link rel="canonical" href="源URL">`，这样搜索引擎把权重归源站、不把我当抄袭降权
23. 作为站长，原创文章详情页的 `<head>` 我希望输出自指 canonical（`href="自己URL"`），这样保持默认 SEO 行为
24. 作为读者，转载文章标题下方我希望看到一行"转载自 · [源]"，这样我能知道文章来源
25. 作为站长，转载文章的完整视觉样式（角标/边框/文末版权块）我希望作为独立 UI feature 后续做，这样不阻塞当前 MCP 上线

### 安全

26. 作为站长，我希望抓取类能力（scrape_url、订阅抓取）挂独立 `posts:scrape` / `subscriptions:read` / `subscriptions:write` scope，这样 SSRF 风险可独立回收、不给不需要的 PAT 开
27. 作为运维，我希望抓取目标经过 SSRF 防护（私网过滤 + DNS 重绑定防护 + 协议白名单 + 超时 + 大小限制），这样 agent 不能借抓取能力探测内网
28. 作为站长，我希望抓取能力尊重源站的 robots.txt，这样不会被源站封 IP

## Implementation Decisions

### 领域模型

- **Post 实体新增 `canonical_url *string`**：NULL = 原创，非空 = 转载/分发。不加 `is_repost` 布尔（业界共识：canonical_url 非空本身就是 flag，加布尔引入冗余与不一致风险）。命名用 `canonical_url` 而非 `source_url`（对齐 Google `rel=canonical` 术语，Ghost/DEV.to/Bear Blog 共识）。
- **新增 subscription 领域聚合根**：承载 RSS feed 订阅，字段含 `feed_url`、`source_type`（'rss'，预留 'page' 为 Phase 2 单页监控铺路）、`interval`（hourly/every-6h/daily/weekly）、`auto_publish`、`canonical_override`、`tags`、`status`（active/paused）、`consecutive_failures`、`last_error`、`last_fetched_at`、`next_fetch_at`、`retry_after_until`。
- **新增 subscription_entries 领域**：承载去重锚点，`(subscription_id, guid)` 唯一键（guid 缺失时回退到 link）、`entry_url`、`status`（pending/imported/failed/dead）、`fail_count`、`post_id`（建草稿后回填）。

### Schema 变更（三张迁移）

- **migration 060**：`posts` 增 `canonical_url TEXT`（nullable）。
- **migration 061**：`subscriptions` 表，含 `next_fetch_at` 索引（`WHERE status='active'` 部分索引）、`user_id` 索引。
- **migration 062**：`subscription_entries` 表，含 `UNIQUE(subscription_id, guid)` 去重锚点、`ON DELETE CASCADE` 跟随订阅删除。

### MCP tool 清单（新增 8 个）

- **`scrape_url`**（scope `posts:scrape`）：输入 `url`，返回 `{title, content_md, content_html, excerpt, canonical_url, cover_image, seo_title, seo_description, warnings[]}`。复用 `ImportURL` 抓取管线 + SSRF 防护 + HTML→MD 转换。
- **`create_subscription`**（scope `subscriptions:write`）：输入 `feed_url, interval, auto_publish?, canonical_override?, tags?, title?`，返回 `{subscription_id}`。
- **`list_subscriptions`**（scope `subscriptions:read`）：输入 `status?, page?, limit?`，返回订阅列表含状态/失败计数/最近抓取/最近错误。
- **`get_subscription`**（scope `subscriptions:read`）：输入 `id`，返回订阅详情 + 最近 entries。
- **`update_subscription`**（scope `subscriptions:write`）：改 interval/auto_publish/canonical_override/tags/title。
- **`pause_subscription`**（scope `subscriptions:write`）：手动暂停。
- **`resume_subscription`**（scope `subscriptions:write`）：手动恢复（清零 consecutive_failures）。
- **`delete_subscription`**（scope `subscriptions:write`）：删除（CASCADE 删 entries）。
- 现有 `create_post` / `update_post` tool 新增 `canonical_url` 与 `content_html` 参数（承载转载语义 + HTML 直存路径）。

### PAT scope 扩展（从 3 个变 6 个）

- 新增 `posts:scrape`：scrape_url 专属，SSRF 风险可独立回收。
- 新增 `subscriptions:read` / `subscriptions:write`：订阅管理。
- scope 同步两处（domain validScopes + 前端 PAT_SCOPES），由编译期断言保持对齐（沿用现有 `tools.go` 编译期断言模式）。注：PAT scope 不入 DB seed，校验在创建/查询时即时做（对齐 api_token 现状）。

### 抓取管线复用与扩展

- **`ImportURL` 现状**：返回 HTML，做 readability + meta/SEO 提取 + 数学公式保留 + 可选 AI 公式修复。
- **扩展**：新增 HTML→Markdown 转换（引入 `JohannesKaufmann/html-to-markdown`），`ImportResult` 增 `ContentMD` 字段，让 `scrape_url` 同时返回 md 与 html（对齐 Firecrawl `formats` 共识，agent 选格式）。
- **canonical_url 提取**：优先 `og:url` / `<link rel=canonical>`，回退到输入 url。
- **SSRF 防护层**（独立公共组件，单独提交）：私网地址过滤（127/10/172.16/192.168/169.254/IPv6 ::1 与 fc00::/7）+ DNS 重绑定防护（解析后 IP 校验）+ 协议白名单（http/https）+ 超时（复用现有 15s）+ 响应体大小限制。这一层同时保护现有 admin `ImportURL` 接口（当前只有 scheme 校验，是已知缺口）。

### RSS 解析与订阅抓取

- 引入 `mmcdole/gofeed`（业界事实标准，通吃 RSS 2.0 / Atom / JSON Feed）。
- **去重**：每次抓 feed → 解析 entries → 查 `subscription_entries` 表过滤已处理 → 对新 entry 抓正文建草稿。
- **canonical_url 自动填充**：抓来的 post 的 `canonical_url = entry.link`（除非订阅配了 `canonical_override`）。
- **草稿默认状态**：`auto_publish=false` 时建 draft；`auto_publish=true` 时建 published（订阅执行流程内部走 `application/post.Service.Create` + `Publish`，**不**经过 MCP scope 校验，scope 是给 agent 用的；但创建订阅时若 auto_publish=true 需 PAT 持有 `posts:publish` scope 才允许配）。

### 调度模型

- **实现载体**：复用 `job/cleanup_job.go` 的 ticker + `select` 模式，新建 `job/subscription_job.go`。零新依赖（不引 cron 库，Q4b 已选固定频率枚举）。
- **并发模型**：有界并行 worker pool（默认 5）。跨源并行（不同订阅源 goroutine 并行）+ 同源串行（单个订阅内 feed + entries 串行，对源站礼貌）+ 错误隔离（每 goroutine 独立 recover）。
- **触发频率**：ticker 每 30 分钟检查 `WHERE next_fetch_at <= NOW() AND status='active'` 的订阅。
- **不引入任务队列**（asynq/river），个人博客订阅量级（< 50）不需要。

### 失败处理（Miniflux 共识）

- **feed 拉取失败分类**：
  - HTTP 429 + Retry-After → 设 `retry_after_until`，推迟下次抓取，`consecutive_failures` 不变。
  - HTTP 4xx / malformed XML（永久错误）→ 立即 `status=paused`。
  - 网络 / 超时 / 5xx（瞬时错误）→ `consecutive_failures += 1`，达 5 → `status=paused`。
- **feed 拉取成功**：`consecutive_failures` 清零，处理 entries。
- **entry 正文失败**：`fail_count += 1`，达 3 → `status=dead`，不再补抓。
- **告警通道**：本期只写订阅表（`last_error` + `consecutive_failures` + `status`），后台 UI 显示。邮件/MCP 通知不进本期范围（见 Out of Scope）。

### 转载渲染

- **SEO `<head>`**（必须，本次做）：文章详情页 `<head>` 按 `canonical_url` 输出 `<link rel="canonical">`（NULL 自指、非空指向源）。
- **最小可见标记**（本次做）：转载文章标题下一行"转载自 · [源]"，复用现有 typography，零设计成本。
- **完整视觉样式**（延后）：列表卡片角标、详情页边框/底色、文末版权块作为独立 UI feature，等设计师介入或站长有具体想法。

### robots.txt 尊重

- 引入 `temoto/robotstxt`，`scrape_url` 与订阅抓取执行前先拉目标站点 `/robots.txt`，遵守 `Disallow` 规则。与 SSRF 防护层一起实现（都是抓取前的预检）。

### 代码组织（遵守 AGENTS.md 分层）

- **抓取逻辑**：复用并扩展 `application/post/` 的 `ImportURL`，不放进 `application/mcp`（mcp 层只暴露 tool，业务在 application/post）。
- **订阅领域**：`domain/subscription/`、`application/subscription/`、`infrastructure/persistence/gorm/subscription_repo.go`，独立 feature。
- **MCP tool**：`application/mcp/` 增 scrape_url + 7 个订阅 tool，沿用现有 `PostService` 端口模式（新增 `SubscriptionService` 端口接口）。
- **调度**：`job/subscription_job.go`，与 `cleanup_job.go` 并列。

## Testing Decisions

### 测试理念

只测外部行为，不测实现细节。优先复用现有 seam，不新建。理想是单 seam 覆盖核心路径。

### 主要 seam

- **seam #1（最高优先）—— MCP tool 层**：沿用现有 `api/internal/application/mcp/tools_test.go` 的 `fakePostService` 模式。新增 `fakeSubscriptionService`，单测覆盖 8 个新 tool 的 scope 校验、参数透传、错误返回。**这是 MCP 行为的最高 seam**，所有 tool 的权限/参数/输出契约在这一层验证。
- **seam #2 —— application service 层**：沿用 `application/post/service_slug_test.go` 模式。覆盖 subscription service 的 CRUD、去重逻辑、失败状态机（瞬时/永久/Retry-After 三类分支）、entry 补抓计数。
- **seam #3 —— SSRF 防护层**：纯函数测试（输入 URL/host → 是否拒绝），不依赖网络。覆盖私网/协议/DNS 重绑定各类边界。
- **seam #4 —— HTML→MD 转换**：纯函数测试，输入 HTML 片段 → 验证 Markdown 输出。覆盖代码块、表格、数学公式节点保留。
- **seam #5 —— 端到端抓取**（沿用现有 `import_url_e2e_test.go`，标记 net-dependent）：扩展现有 e2e，验证 `scrape_url` 完整链路（含 SSRF 防护、canonical 提取、HTML→MD）。

### 不测的部分

- 不测 goroutine 调度细节（worker pool 内部），测其外部行为：给定一组订阅 + 时间推进，期望某些订阅被抓、某些被跳过。用 fake clock + fake service 隔离。
- 不测 GORM SQL 细节，测 repository 接口契约（沿用现有 repo 测试模式）。
- 不测 gofeed / html-to-markdown 库本身（第三方库自带测试）。

## Out of Scope

- **通知中心**：邮件/站内通知系统是独立 PRD（未来单独立项，编号待定）。本期订阅 paused 只写订阅表 + 后台 UI 显示，不 emit 任何事件、不依赖通知中心。未来通知中心接入时，会回头给订阅 paused 加事件 emit，但那是通知中心 PRD 的事。
- **单页监控**：Phase 2 才做。本期订阅表预留 `source_type` 字段为未来铺路，但不实现 page 类型的抓取/diff 逻辑。
- **图片本地化/代理**：转载文章的外链图片（源站删图/防盗链 → 图片失效）是已知缺口，但是独立 feature（涉及存储、防盗链处理、URL 改写），单独立项。
- **抓取配额**：PAT 级日配额（防恶意 PAT 持续抓取）本期不做，标记为已知安全缺口。本期只有全局 60/min 速率限制。
- **OPML 导入导出、订阅分组、统计分析、内容许可证处理**：YAGNI，未来按需。
- **完整转载视觉样式**：列表卡片角标、详情页边框/底色、文末版权块作为独立 UI feature 延后。

## Further Notes

### 难逆决策（建议落 ADR-0007）

- `canonical_url *string` 字段命名与语义选择（业界 SEO 标准对齐）。
- Phase 1 只做 RSS 不做单页监控（订阅模型形态选择）。
- 调度模型选有界并行 worker pool 而非纯串行/全并行。
- 通知中心独立 PRD 边界（订阅失败不依赖通知基础设施）。

### 改动拆分（14 个独立提交单元，按依赖顺序）

P0–P5 是同步抓取路径（post 层 + scrape tool），S1–S6 是订阅路径（subscription 领域 + tool + 调度），W1–W2 是前端。具体拆分见 PRD 配套的 issues。每单元 = 一个独立 commit/PR，遵守 AGENTS.md 原子提交规则（公共组件单独提交、前后端分离、重构与功能分离）。

### 业界参考

- **Miniflux**（失败处理标杆）：连续 5 次失败自动禁用 feed、`reset-feed-errors` CLI、尊重 Retry-After 不增计数。
- **Firecrawl MCP**（scrape_url tool 形状标杆）：`formats` 参数让 agent 选 markdown/html/json，独立可组合工具反对 do-everything。
- **Ghost / DEV.to / Bear Blog**（canonical_url 字段标杆）：单一 `canonical_url` 字段，blank=original。
- **Google Search Central**（rel=canonical SEO 标准）：NULL 自指、非空指向源。
