# Violet MCP Server 使用指南

violet 通过 MCP（Model Context Protocol）向外暴露博客内容读写能力。共 4 个面向 AI agent 的 server，按「读/写/抓取/评论」切分权限边界，互不重叠。

## 总览

| Server | 定位 | 鉴权 | 数据范围 |
|--------|------|------|---------|
| `violet-reader` | 公开只读通道 | 匿名 | 仅已发布文章 + 写作风格 prompt |
| `violet-comments` | 读者反馈检索 | PAT（`comments:read`） | 已审核通过的评论/批注 |
| `violet-posts` | 自己的文章读写 | PAT（`posts:read/write/publish`） | 当前用户名下文章（含草稿） |
| `violet-scraper` | 外站抓取 + RSS 订阅 | PAT（`posts:scrape` / `subscriptions:*`） | 外站内容 + 订阅配置 |
| `violet-notes` | 知识笔记写入（AI 会话沉淀） | PAT（`notes:read/write/publish`） | 当前用户名下笔记（含草稿） |

此外 `.omp/mcp.json` 还保留了一个本地开发用的 `violet` server（指向 `localhost:5174`），是全量 server，用于本地联调；生产环境拆分为上述 5 个最小权限通道。

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

### violet-comments — 读者反馈检索

检索读者在文章下留的评论和**划线批注**。批注带 `anchor.selected_text`（读者划中的原文）。仅返回**已审核通过（approved）**的反馈。

| 工具 | 用途 |
|------|------|
| `comment_stats` | 按文章聚合批注密度，定位「哪篇反馈最密集、最该先改进」 |
| `list_recent_comments` | 按时间倒序看最近反馈动态 |
| `search_comments` | 按关键词检索，判断「读者是否提过某类反馈」 |

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

会话收尾使用 `.agents/skills/blog-writing/` 从可解释的工程发现选题：需要展开因果或机制时写文章，一个触发条件和修法已足够时写笔记，同主题有新增材料时更新，只有过程记录时不写。文章围绕具体读者问题组织；稿件完成并经过独立审读后，可交付全文或本地文件供审阅。保存、发布与写作分开，自动捕获不默认上传，用户明确的保存或发布授权不重复确认。

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

## 使用决策

- 读公开已发布内容 → **reader**（resources）或 posts 的 `search_posts`
- 看读者反馈 → **comments**
- 写/改/发布自己的文章 → **posts**
- 搬运外站 / 订阅 RSS → **scraper**
- 会话沉淀知识笔记 → **notes**（配合 `.agents/skills/blog-writing`）

## 更新日志

- 2026-07-30: 初始版本，记录 reader/comments/posts/scraper 四个 server 的定位与工具清单
- 2026-08-07: 新增 `create_tag` / `list_tags`（violet-posts），补全标签创建能力——此前 `create_post` 带未创建的标签会失败
- 2026-09-03: 新增 `violet-notes`（PRD-0024 AI 会话沉淀）：5 个笔记工具、`notes:read/write/publish` scope、会话捕获 skill 部署步骤
- 2026-09-07: 功能级文章调整为源码驱动的工程长文；新增 MCP 不可用时经用户确认保存并提交项目恢复稿，在连接恢复入库后提交删除
