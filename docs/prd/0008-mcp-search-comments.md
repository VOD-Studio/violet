# PRD: MCP 批注反馈检索回路（violet-comments server）

## Problem Statement

博客的评论/锚点批注系统（PRD-0001）已完全落地：成熟的 `comment` 聚合根、双轨认证（登录 + 匿名）、锚点选区批注、人工审核（pending/approved/spam/deleted）。读者可对文章选区划线批注"这段公式错了""这里没讲清楚"——这些是**给作者的建设性反馈**，天然构成"写作改进"的原料。

但 MCP 体系（PRD-0005/0006/0007 后）有三个 server 共 16 个 tool + 3 个 Resource + 2 个 Prompt，**没有任何消费评论/批注的能力**。写作 agent 帮作者改进文章时，回答不了三个问题：

1. **「读者对我哪篇文章提过 X 类反馈？」**——无法按关键词检索已审核的评论/批注（含锚点选区原文）。
2. **「最近读者有什么反馈？」**——无法按时间浏览最新评论动态。
3. **「哪些文章反馈最密集、最该先改？」**——无法聚合统计批注密度做优先级判断。

HTTP 侧的评论后台（`/admin/comments`）只有**审核功能**（列表/批准/标记垃圾），没有任何检索/搜索/统计能力——它服务的是人工审核流程，不是"反馈→改进"的分析闭环。MCP 是这个闭环的第一消费者（agent 是分析+改进的执行者），HTTP 检索留待将来前台需求驱动。

同时暴露一个**历史命名问题**：第一个 MCP server 用裸品牌名 `violet`，名字没描述所拥有的域；它的内容是文章 CRUD + 文章检索（S1），该按域命名为 `violet-posts`。S3 引入评论域，正名时机已到。

## Solution

两件事：(1) **正名** `violet` → `violet-posts`（反映文章域）；(2) **新建第四个 server `violet-comments`**（`/api/v1/mcp/comments`），挂 3 个评论检索 tool，形成"读者批注 → agent 检索反馈 → 改进文章"的闭环。

### 三个检索 tool（PAT `comments:read` 私有视角，仅 approved）

1. **`search_comments`**：按关键词检索评论正文，可选 type（all/annotation/free），分页。
2. **`list_recent_comments`**：按 `created_at DESC` 浏览最新评论，可选 type，分页。
3. **`comment_stats`**：按文章聚合批注/评论计数，帮 agent 判断优先改哪些文章。

### 为什么是独立 server 而非挂文章 server

业界 2026 共识（[AWS DDD 文](https://dev.to/aws/rediscovering-domain-driven-design-one-mcp-server-at-a-time-1i79)）：**"Name your MCP servers after the domain they own, not the API they wrap"**，且"each server owns one domain"——混域是"designing context boundaries"失败。

评论（comment）与文章（post）是两个独立的限界上下文：独立聚合根、独立仓储、独立审核流程、独立 HTTP 权限（`comment:view` vs 文章权限）。把评论检索塞进"文章 server"正是 AWS 警告的"三个 concerns 塞进一个 boundary"。故新建 `violet-comments`，与 `violet-posts` 物理隔离。

闭环由 S1/S2/S3 组合构成：S3 检索反馈（含锚点选区原文）→ agent 理解"读者对原文 X 的反馈是 Y"→ S1 `get_post`/S2 `blog://posts/{slug}` 读全文 → agent 起草改进 → `update_post` 写回。S3 是闭环的"反馈数据接入"环，不越界到写评论状态（审核/删除归既有后台 + HTTP）。

## User Stories

1. 作为站长，我想让 agent 检索读者对文章的评论/批注（按关键词），这样能找到"读者提过某类问题"的反馈来改进文章。
2. 作为站长，我想检索时看到批注的锚点选区原文（`selected_text`），这样 agent 能精确定位"读者说这段有问题"的"这段"是哪段。
3. 作为站长，我想按评论类型过滤（只看批注 / 只看自由评论 / 全部），这样聚焦定位反馈或看全貌。
4. 作为站长，我想按时间浏览最新评论动态，这样被动了解"最近读者有什么反馈"而非主动找特定词。
5. 作为站长，我想看到按文章聚合的批注密度统计，这样 agent 能判断"哪些文章反馈最密集、最该先改"。
6. 作为站长，检索结果只含已审核通过（approved）的评论，这样未审阅的 pending（可能含垃圾）不污染 agent 的写作建议上下文。
7. 作为站长，评论检索需 PAT 登录（`comments:read`），这样含读者个人信息的反馈不暴露给匿名 agent。
8. 作为同时挂多个 server 的 agent，我想 server 名能反映它拥有的域（`violet-posts`/`violet-comments`），这样在 server 选型层就能读到分工。

## Implementation Decisions

### 正名：violet → violet-posts

`brand.MCPServerName` 从 `violet` 改为 `violet-posts`。前端 `MCP_SERVERS` 的 `key` 同步改。**不管已接入 agent 的旧 key**（用户授权，旧配置失效就重配）。改名是独立的破坏性重构 commit，先于 S3 功能提交（AGENTS.md「重构与功能分离」）。

### 新建 violet-comments server

**`violet-comments`**（`/api/v1/mcp/comments`），第四个 MCP server，独立限流维度 `mcp-comments`。

| server | 端点 | 鉴权 | scope | 域 |
|---|---|---|---|---|
| `violet-posts`（改名） | `/api/v1/mcp` | PAT | `posts:read/write/publish` | 文章 |
| `violet-scraper` | `/api/v1/mcp/scraper` | PAT | `posts:scrape`+`subscriptions:*` | 抓取/订阅 |
| `violet-reader` | `/api/v1/mcp/reader` | 匿名 | — | 公开只读 |
| **`violet-comments`（新）** | `/api/v1/mcp/comments` | PAT | **`comments:read`（新）** | 评论 |

**新 scope `comments:read`**：PAT scope 体系是 `<domain>:<action>` 格式（`posts:read`/`subscriptions:read`），评论检索对齐为 `comments:read`。与 HTTP 后台 `comment:view` permission（角色 RBAC）是同一权限意图在两套鉴权体系的表达，不能合并（PAT 用 scope，session 用 permission）。

### 三个 tool 形状（遵循 Philipp Schmid / AWS 最佳实践：扁平参数、受限枚举、默认值）

**`search_comments`**（scope `comments:read`）

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `query` | string | 必填 | 关键词；`body` ILIKE，空格分词 AND（复用 S1 模式） |
| `type` | enum | `all` | `all`/`annotation`/`free`（对齐现有 `AnchorFilter` 枚举） |
| `limit` / `offset` | int | 20 / 0 | 上限 50，超出钳制 |

返回 `{ comments: [...], total_count, has_more, next_offset }`。

**`list_recent_comments`**（scope `comments:read`）

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `type` | enum | `all` | 同上 |
| `limit` / `offset` | int | 20 / 0 | 同上 |

排序 `created_at DESC`。返回结构同 `search_comments`。

**为什么 search 与 list 拆两个 tool 而非合并（query 可选）**：业界（AWS "complexity leads to hallucination"、Philipp Schmid "outcomes not operations"）反对"可选参数改变 tool 行为"的多模式 tool。找特定词（search）与浏览动态（list）是两个不同的 agent outcome，拆开让选型清晰；两 tool 高度相关且正交，不构成"tool 过载"干扰（arXiv 说的选择退化针对无关 tool）。

**`comment_stats`**（scope `comments:read`）

无参数，统计 approved 全量。返回：

```
{
  summary: { total_annotations, total_comments, posts_with_feedback },
  posts: [
    { post_id, post_title, post_slug, annotation_count, comment_count, latest_at }
    // 按 annotation_count DESC，仅含有反馈的文章，不分页
  ]
}
```

### 返回字段（B2）

每条评论返回（复用 `AdminCommentDTO` 形态）：

```
{
  id, post_id, post_slug, post_title,
  type: "annotation" | "free",
  body,                    // 完整正文（评论短，不截取 snippet，与 S1 长文不同）
  author_name, created_at,
  anchor?: {              // 仅 annotation
    selected_text,        // 选区原文（读者划中的文字，闭环核心）
    block_id
  }
}
```

**关键设计**：
- **完整 body**：评论是纯文本 + emoji 占位（无 Markdown），通常短，完整返回不撑爆上下文；与 S1 长文章正文必须截 snippet 不同。
- **批注带 `anchor.selected_text`**：读者划中要反馈的原文，直接构成"读者对原文 X 的反馈是 Y"的闭环。这是 S3 的核心价值字段。
- **不带块完整上下文**：保持返回精简；agent 需更多上下文调 S2 `blog://posts/{slug}` 读全文（体现 S1/S2/S3 组合价值）。

### 检索技术：ILIKE（复用 S1 选型）

`body ILIKE '%kw%'`，多关键词空格分词 AND。PG ILIKE 零部署成本、中文子串精确必中（PRD-0006 检索技术选型已论证）。未来升级 pg_trgm/zhparser 时收敛在仓储层单方法，MCP tool 接口零变化（seam 已留）。

### 仓储层：新增两个方法

现状 `CommentRepository` **零检索能力**（探查确认）。新增：

1. **`Search(ctx, status, query, anchorFilter, page, limit)`** — `body` ILIKE + status/anchorFilter 过滤 + 分页，返回 `[]*CommentWithPost, total, error`。复用 `FindAll`（已做 posts JOIN、多维 WHERE、双 query 计数）模式，加 `body ILIKE`。
2. **`Stats(ctx, status)`** — 按 `post_id` 聚合，`GROUP BY post_id` 计 annotation_count（`anchor_block_id IS NOT NULL`）/ comment_count / `MAX(created_at)`，JOIN posts 取标题/slug。返回 `[]PostCommentStat`。

`list_recent_comments` 复用现有 `FindAll(status="approved", anchorFilter, page, limit)`（已 `ORDER BY created_at DESC`），无需新仓储方法。

### status 可见性：仅 approved

MCP 检索**仅返回 `status == approved`**（与前台"黑洞模式"不同——前台匿名见空、登录见 approved∪自己pending；MCP 是管理/分析工具但只消费已审阅有效的反馈）。pending（未审阅，可能含垃圾）不进 agent 上下文，避免污染写作建议。语义呼应：**approved 评论 ≈ published 文章，都是"已审阅的有效内容"**。

### 边界表达（三层，复用 S2 框架）

1. **primitive description**：`search_comments`/`list_recent_comments` 描述点明"仅已审核评论"+ scope；用 URI 指代文章通道（"读全文用 `blog://posts/{slug}`"）。
2. **`ServerOptions.Instructions`**：violet-comments 写一段"本 server 检索读者评论/批注反馈，仅已审核；用于写作改进闭环。文章本身用 violet-posts/violet-reader"。
3. **文档**：CONTEXT.md MCP 章补 `violet-comments` 词条；本 PRD 记录"评论与文章是独立 bounded context"的域边界决策。

### 前端：零改动（接入页）

`MCP_SERVERS` 数组追加 `violet-comments` 条目（PAT server，非 anonymous，复用现有 PAT server 配置生成逻辑）。接入页**不需要**评论检索 UI——S3 是 agent 通道，评论审核 UI（`/admin/comments`）已存在且独立。

## Testing Decisions

只测外部行为，复用现有 seam。

- **MCP tool 层**（seam #1）：沿用 `tools_test.go` fake service 模式。覆盖 3 tool 的 scope 门禁（无 `comments:read` 拒绝）、参数默认值/钳制、type 过滤、空结果提示、错误透传。
- **Service 层**（seam #2）：沿用 `service_test.go` 模式。覆盖 search 的多关键词 AND、type 过滤；stats 的聚合正确性（批注/评论计数、排序、零反馈文章排除）。
- **仓储层**（seam #3）：沿用 gorm repo 测试模式。覆盖 ILIKE 中英文、多关键词 AND、status=approved 过滤、anchorFilter 各枚举、分页边界、stats 的 GROUP BY 聚合。

不测：ILIKE 本身（Postgres 语义）、MCP SDK 序列化。

## Out of Scope

- **pending 评论检索**：MCP 仅消费 approved；pending 审核归后台 UI。
- **评论写操作**（resolve/审核/删除）：归既有 HTTP 后台；S3 纯读域，不越界。
- **`violet-scraper` 正名**：抓取/订阅严格说也是两域，但 S3 不碰它，留待将来。
- **HTTP 评论检索接口 / 前台搜索 UI**：将来由前台需求驱动，单独立项。
- **评论嵌套回复检索**：S3 返回顶层（depth=0）+ replies_total 计数，不展开回复树（避免 N+1）；agent 需回复细节调 HTTP `/comments/{id}/replies`。

## Further Notes

### 系列版图定位

本 PRD 是 PRD-0006 系列版图的 **S3**（原标注"批注反馈回路，待立项"）。完成后：

| 子项目 | 内容 | 状态 |
|---|---|---|
| S1 检索核心 | search_posts / search_formulas / search_code_blocks | ✅ 已合并（PR #59） |
| S2 Resources+Prompts | 公开 reader server + writing_style + polish_draft | ✅ 已实现（PRD-0007） |
| **S3 批注检索回路** | **violet-comments server + 3 评论检索 tool** | **本 PRD** |
| S5 跨域杂项 | 音乐/订阅条目/版本历史检索 | 待立项 |
| S4 质量守门 | lint_post + LLM 写作辅助 | 待立项 |

### 难逆决策

- **评论与文章分属独立 bounded context**（决定评论检索独立 server，不挂文章 server；依据 AWS DDD MCP 命名实践）。
- **violet → violet-posts 正名**（破坏旧 key，用户授权不管已接入配置）。
- **MCP 仅消费 approved**（pending 不进 agent 上下文；与前台可见性语义不同）。
- **search/list 拆两 tool**（非 query 可选单 tool；依据 outcome-first + 反多模式 tool）。
- **comment_stats 无时间窗**（优先级看累积反馈，非时间窗；时间维度用 list_recent）。

### 改动拆分（遵守 AGENTS.md 原子提交规则）

1. `refactor(mcp): violet server 正名为 violet-posts`（brand 常量 + 前端 MCP_SERVERS key + 接入页快照；独立可 revert）。
2. `feat(api-token): 新增 comments:read scope`（domain/api_token scope 常量 + 校验；独立）。
3. `feat(comment): 评论仓储新增检索与统计方法`（Search + Stats + repo 测试；独立）。
4. `feat(comment): Service 新增评论检索编排`（SearchComments + ListRecentComments + CommentStats + 单测；依赖 3）。
5. `feat(mcp): 新增 violet-comments server 与三个检索 tool`（server 装配 + tool handler + Instructions + tool 测试；依赖 4）。
6. `feat(web): 接入页 MCP_SERVERS 追加 violet-comments`（types + 配置生成；依赖 1 的 key 改名）。
7. `docs(domain): CONTEXT.md MCP 章补 violet-comments 词条`（文档；独立）。

3 独立；4 依赖 3；5 依赖 4；1/2/6/7 可并行（1 与 6 都动 MCP_SERVERS，6 依赖 1 的 key 落定）。

### 业界参考

- **MCP server 按域命名**：[AWS DDD](https://dev.to/aws/rediscovering-domain-driven-design-one-mcp-server-at-a-time-1i79) "Name your MCP servers after the domain they own"；[zazencodes](https://zazencodes.com/blog/mcp-server-naming-conventions) domain-based 优于 capability/persona-based。
- **tool 拆分 vs 合并**：[Philipp Schmid](https://www.philschmid.de/mcp-best-practices) "outcomes not operations" + "curate ruthlessly"；[AWS](https://aws.amazon.com/blogs/machine-learning/mcp-tool-design-practical-approaches-and-tradeoffs/) "complexity leads to hallucination"（反多模式 tool）。
- **检索技术 ILIKE**：PRD-0006 已论证（零部署成本、中文子串精确；升级 seam 在仓储单方法）。
