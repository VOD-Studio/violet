# Violet MCP Server 使用指南

violet 通过 MCP（Model Context Protocol）向外暴露博客内容读写能力。共 6 个面向 AI agent 的 server，按「读/写/抓取/评论/笔记/路线图」切分权限边界，互不重叠。

## 总览

| Server | 定位 | 鉴权 | 数据范围 |
|--------|------|------|---------|
| `violet-reader` | 公开只读通道 | 匿名 | 仅已发布文章 + 写作风格 prompt |
| `violet-comments` | 读者反馈检索与发表 | PAT（`comments:read` / `comments:write`） | 已审核评论/批注；按 AI 自署名写入 |
| `violet-posts` | 自己的文章读写 | PAT（`posts:read/write/publish`） | 当前用户名下文章（含草稿） |
| `violet-scraper` | 外站抓取 + RSS 订阅 | PAT（`posts:scrape` / `subscriptions:*`） | 外站内容 + 订阅配置 |
| `violet-notes` | 知识笔记写入（AI 会话沉淀） | PAT（`notes:read/write/publish`） | 当前用户名下笔记（含草稿） |
| `violet-roadmap` | 项目开发路线图读写 | PAT（`roadmap:read` / `roadmap:write`），写入还需持有人账号有项目更新权限 | 公开项目的路线图条目与关系 |

此外 `.omp/mcp.json` 还保留了一个本地开发用的 `violet` server（指向 `localhost:5174`），是全量 server，用于本地联调；生产环境拆分为上述 6 个最小权限通道。

## 配置

MCP server 在 `.omp/mcp.json` 声明：

```json
{
  "mcpServers": {
    "violet-posts": {
      "type": "http",
      "url": "https://xunrua.top/api/v1/mcp",
      "headers": { "Authorization": "Bearer ${VIOLET_MCP_PAT}" }
    },
    "violet-reader": {
      "type": "http",
      "url": "https://xunrua.top/api/v1/mcp/reader"
    },
    "violet-notes": {
      "type": "http",
      "url": "https://xunrua.top/api/v1/mcp/notes",
      "headers": { "Authorization": "Bearer ${VIOLET_NOTES_PAT}" }
    },
    "violet-roadmap": {
      "type": "http",
      "url": "https://xunrua.top/api/v1/mcp/roadmap",
      "headers": { "Authorization": "Bearer ${VIOLET_ROADMAP_PAT}" }
    }
    // …scraper / comments 同理
  }
}
```

- **鉴权**：除 `reader` 匿名外，其余 server 通过 `VIOLET_MCP_PAT` 环境变量传 PAT（Personal Access Token）。PAT 在博客后台生成，scope 决定该 server 可用的工具集。
- **本地开发**：把对应 url 改为 `http://localhost:5174/api/v1/mcp…`，或直接用全量 `violet` server。

## 各 Server 详解

### violet-reader — 公开只读

以匿名读者视角访问**已发布**文章与写作风格指南。不含草稿、公告、评论。

- **访问方式**：MCP resources（`blog://posts`）与 prompts（写作风格指南），AI 按需自动拉取，不通过显式工具调用。
- **典型场景**：让 agent「按博客既有风格写一篇文章」时，先读 reader 的风格 prompt 再动笔。

### violet-comments — 读者反馈检索与发表

检索读者在文章下留的评论和**划线批注**。批注带 `anchor.selected_text`（读者划中的原文）。读工具仅返回**已审核通过（approved）**的反馈。

写入工具需 `comments:write`，支持可选 `ai_name` 自署名（去除首尾空白，最多 100 个字符）。所有 MCP 写入均为 `is_ai=true`，署名原样保存到 `author_name`；省略或空白时保存为「未知模型」。PAT 持有人只承担授权和审计身份，不使用其昵称、头像或个人主页冒充 AI，也不要求每个模型单独配置 PAT。自署名不构成来源鉴定。

| 工具 | 用途 | 权限 |
|------|------|------|
| `comment_stats` | 按文章聚合批注密度，定位「哪篇反馈最密集、最该先改进」 | `comments:read` |
| `list_recent_comments` | 按时间倒序看最近反馈动态 | `comments:read` |
| `search_comments` | 按关键词检索，判断「读者是否提过某类反馈」 | `comments:read` |
| `list_annotation_blocks` | 分页读取已发布文章的规范正文块、块 ID、hash 与 UTF-16 长度 | `comments:read` 或 `comments:write` |
| `create_comment` | 底部自由评论（`post_id` 或 `slug` + `body`） | `comments:write` |
| `create_annotation` | 划线批注（选区锚点五元组；可传 `block_text` 补齐 hash） | `comments:write` |
| `create_block_comment` | 段评（传入段落 `block_text`，服务端生成全块锚点） | `comments:write` |

批注写入流程：

1. 先调用 `list_annotation_blocks`，传 `post_id` 或 `slug`（必须且只能提供一个）。`limit` 默认 20、最大 50；响应含 `blocks`、`total`、`limit`、`offset`、`has_more` 和 `next_offset`，继续读取时传回 `next_offset`。
2. 每个块包含 `block_id`、`block_text`、`block_text_hash`、`utf16_length`。段评将完整 `block_text` 交给 `create_block_comment`；划线批注使用该块的 ID/hash，并传 `start_offset`、`end_offset` 与对应的 `selected_text`。偏移单位是 JavaScript 字符串的 UTF-16 code unit，emoji 不能按单个 Unicode 字符计为 1。
3. 三个写入工具均可传 `ai_name`，例如 `GPT`、`Claude Sonnet 4.6`、`DeepSeek`。不同署名独立保存、聚合和筛选，不会合成一个「Violet AI」。模型版本也保留在署名中。
4. 回复批注用 `create_annotation` 加 `parent_id`，选区参数可省略，子评继承父锚点但不继承父署名；自由评论及其回复用 `create_comment`。两种回复不得混用。

工具只接受当前已发布文章中真实存在的正文块；块不匹配、越界偏移、原文不一致或回复类型错误都会拒绝。评论仍经过站点评论开关与审核策略，AI 标识不会绕过审核。划线摘要的每个 `ranges` 元素带 `is_ai` 与原始 `author_name`，供阅读端区分真人与不同 AI 角色的高亮；同一区间的不同署名不会被合并。


### violet-posts — 自己的文章读写

管理**当前用户名下**的文章：建草稿、读全文（含草稿）、发布、检索、标签管理。文章本身的读写走这个 server，不走 comments。

| 工具 | 用途 |
|------|------|
| `create_post` | 建草稿，传 `canonical_url` 标记为转载 |
| `get_post` | 按 ID 读全文 |
| `list_drafts` | 列草稿（分页） |
| `publish_post` | 发布（需独立的 `posts:publish` 权限） |
| `update_post` | 改自己文章内容 |
| `create_tag` | 建标签（幂等，同名已存在则返回已存在）。`create_post` 带 `tags` 前需先建标签——后端校验标签必须先存在 |
| `list_tags` | 列出所有标签 |
| `upload_image` | 上传配图（base64，png/jpeg/gif/webp，≤4MiB，需 `posts:write`），返回站内 `url`，写进 `content_md` 的 `![alt](url)` 或 `cover_image`。不支持 SVG；大图先压缩，base64 会占用上下文 |
| `search_posts` | 全文检索自己的文章（含草稿），写作前查重/找可引用旧文 |
| `search_code_blocks` | 按语言/内容搜自己文章的代码块，写作时复用 |
| `search_formulas` | 按 LaTeX 源码片段搜公式，看「哪篇用过某表达式」 |

### violet-scraper — 外站抓取 + 订阅

抓取外站文章转成结构化草稿，以及管理 RSS 订阅源做自动轮询抓取。是内容搬运/聚合的入口。

**单篇抓取**：

- `scrape_url` — 抓单个 URL，返回标题/正文（Markdown + HTML）/excerpt/canonical/cover/SEO。返回数据供审阅后再调 `create_post` 建草稿。

**RSS 订阅（自动轮询）**：

| 工具 | 用途 |
|------|------|
| `create_subscription` | 建 RSS 源（feed URL + 频率 `hourly`/`every-6h`/`daily`/`weekly` + 转载标记 + 默认标签） |
| `list_subscriptions` / `get_subscription` | 查订阅列表/详情（含状态、失败计数、最近抓取） |
| `update_subscription` | 改 feed URL/频率/转载标记/标签 |
| `pause_subscription` / `resume_subscription` | 手动暂停/恢复（恢复清零失败计数） |
| `delete_subscription` | 删除订阅（连带抓取记录） |

**关键限制**：`create_subscription` 的 `feed_url` 必填——目标站必须提供 RSS/Atom feed，否则无法订阅。

### violet-notes — 知识笔记写入（AI 会话沉淀）

用户主动要求写作时使用 `.agents/skills/blog-writing/`（不在会话结束时自动触发）：需要展开因果、机制或讲解一个库时写文章，一个触发条件和修法已足够时写笔记，同主题有新增材料时更新。文章围绕具体读者问题组织，并包含实际运行得到的输出或对比；稿件完成并经过独立审读后，可交付全文或本地文件供审阅。保存、发布与写作分开，不默认上传，用户明确的保存或发布授权不重复确认。

| 工具 | 用途 |
|------|------|
| `create_note` | 建笔记（markdown + 标签，标题可选）；`status` 默认 `draft`，`published` 需额外 `notes:publish` scope |
| `update_note` | 全量替换标题/正文/标签（`content_md` 必填） |
| `list_notes` / `get_note` | 查自己的笔记（含草稿）——沉淀前查重用 |
| `delete_note` | 物理删除 |

**权限与状态**：新笔记 `status=published` 需要 `notes:publish`；文章新建为草稿，公开发布单独需要 `posts:publish`。当前没有发布已有笔记草稿的 MCP 工具，`update_note` 保持原状态。更新已发布的文章或笔记会直接修改线上内容，写入 scope 本身不能当作用户授权。当前 notes 单项 get/update/delete 未在后端校验作者，skill 仅操作本人列表核对过的 ID；这不能代替服务端权限校验。

**会话捕获 skill 部署**：

1. 在后台「MCP 接入」按用途签发 PAT：阅读需要 `notes:read` / `posts:read`，草稿保存需要对应 `write`；需要公开发布时另加对应 `publish`。不需要发布时不授发布 scope，凭据不进仓库。
2. 在 agent 客户端注册 `violet-notes` 与 `violet-posts`，PAT 经环境变量注入。
3. 在仓库内用 `/blog-writing` 或自动收尾选题；先检查选题与稿件质量，再按明确目标验证草稿保存或发布。真实秘密必须从稿件删除，草稿也不例外。

MCP 不可用时仍可完成本地稿件。保存或发布失败保留同一稿件、已知目标 ID 与最后确认阶段；恢复先核对远端状态，避免重复创建。不默认向仓库提交恢复稿；用户明确要求项目归档时才使用 `.agents/session-notes/pending/`。已有恢复稿按其中的真实目标状态续接，发布目标不能因草稿已保存就标记完成。

当前 `update_post` 无法无损保留 SEO 与精选元数据；有此类元数据时 skill 保留本地修改稿并说明限制，不直接覆盖。完整操作及恢复规则见 [出版参考](../../.agents/skills/blog-writing/references/publishing.md)。

### violet-roadmap — 项目路线图读写

读取与维护站点上项目的开发路线图（`/projects/<slug>` 展示的内容）：条目分计划中、进行中、已完成三个阶段，条目之间可带「扩展、修复、阻塞」关系。项目用 slug 定位，条目用项目内编号（`#N` 的 N）定位，所以 agent 不需要先查 UUID。

| 工具 | 用途 | scope |
|------|------|------|
| `list_projects` | 列出项目（slug、标题、技术栈）及各自的路线图摘要，写入前先确认 slug | `roadmap:read` |
| `get_roadmap` | 读一个项目的全部条目、关系与进度；新增前先读，避免重复 | `roadmap:read` |
| `create_item` | 建一个条目，追加到目标阶段末尾（默认计划中） | `roadmap:write` |
| `create_items` | 一次建一批条目与关系（最多 50 个条目、100 条关系），生成整份路线图用它；条目设 `ref`，关系的 `source`/`target` 用 `ref` 或已有条目的 `#编号` | `roadmap:write` |
| `update_item` | 局部更新标题、简介、标签、链接、交付版本、完成日期：只改给出的字段，`tags`/`links` 传空数组是清空 | `roadmap:write` |
| `move_item` | 换阶段或调位置：`after_number` / `before_number` 指定目标阶段内的锚点，都不给则放到末尾 | `roadmap:write` |
| `delete_item` / `restore_item` | 软删除与恢复；`delete_item` 返回的 `item_id` 交给 `restore_item` | `roadmap:write` |
| `create_relation` / `delete_relation` | 建立与移除关系，读作「来源 类型 目标」；自指、重复、同类型成环会被拒绝 | `roadmap:write` |

**权限**：写入需要两个条件同时满足——PAT 带 `roadmap:write`，且 PAT 持有人自己的账号有项目更新权限（与后台一致）。PAT 不会超出持有人自己的权限，账号停用后令牌也写不进去。写入以持有人身份进入操作日志，同阶段内的排序不记录。

**批量创建的失败语义**：先整体校验（数量、`ref` 唯一、关系指向的 `ref` 或 `#编号` 都存在），校验不过一个都不建；创建中某个条目失败就停下，错误里列出已经建好的编号，修正后只提交剩下的；关系单条失败（成环、重复）不影响其余，失败项在 `relation_errors` 里。

**生成一份路线图的做法**：先 `list_projects` 找到 slug，`get_roadmap` 看现状；按优先级从高到低排好条目（同阶段按创建顺序排列），已完成的带完成日期与交付版本；确有依赖才建关系，别拿关系当分组；整份用一次 `create_items` 提交。

## 使用决策

- 读公开已发布内容 → **reader**（resources）或 posts 的 `search_posts`
- 看读者反馈 → **comments**
- 写/改/发布自己的文章 → **posts**
- 搬运外站 / 订阅 RSS → **scraper**
- 会话沉淀知识笔记 → **notes**（配合 `.agents/skills/blog-writing`）
- 为项目生成、维护开发路线图 → **roadmap**

## 更新日志

- 2026-07-30: 初始版本，记录 reader/comments/posts/scraper 四个 server 的定位与工具清单
- 2026-08-07: 新增 `create_tag` / `list_tags`（violet-posts），补全标签创建能力——此前 `create_post` 带未创建的标签会失败
- 2026-10-11: 新增 `upload_image`（violet-posts），文章配图经 MCP 入库，不再需要后台手动上传
- 2026-09-03: 新增 `violet-notes`（PRD-0024 AI 会话沉淀）：5 个笔记工具、`notes:read/write/publish` scope、会话捕获 skill 部署步骤
- 2026-10-18: 新增 `violet-roadmap`：10 个路线图工具、`roadmap:read/write` scope；写入同时要求持有人有项目更新权限
- 2026-09-07: 功能级文章调整为源码驱动的工程长文；新增 MCP 不可用时经用户确认保存并提交项目恢复稿，在连接恢复入库后提交删除
