# Violet MCP Server 使用指南

violet 通过 MCP（Model Context Protocol）向外暴露博客内容读写能力。共 4 个面向 AI agent 的 server，按「读/写/抓取/评论」切分权限边界，互不重叠。

## 总览

| Server | 定位 | 鉴权 | 数据范围 |
|--------|------|------|---------|
| `violet-reader` | 公开只读通道 | 匿名 | 仅已发布文章 + 写作风格 prompt |
| `violet-comments` | 读者反馈检索 | PAT（`comments:read`） | 已审核通过的评论/批注 |
| `violet-posts` | 自己的文章读写 | PAT（`posts:read/write/publish`） | 当前用户名下文章（含草稿） |
| `violet-scraper` | 外站抓取 + RSS 订阅 | PAT（`posts:scrape` / `subscriptions:*`） | 外站内容 + 订阅配置 |

此外 `.omp/mcp.json` 还保留了一个本地开发用的 `violet` server（指向 `localhost:5174`），是全量 server，用于本地联调；生产环境拆分为上述 4 个最小权限通道。

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

## 使用决策

- 读公开已发布内容 → **reader**（resources）或 posts 的 `search_posts`
- 看读者反馈 → **comments**
- 写/改/发布自己的文章 → **posts**
- 搬运外站 / 订阅 RSS → **scraper**

## 更新日志

- 2026-07-30: 初始版本，记录 reader/comments/posts/scraper 四个 server 的定位与工具清单
- 2026-08-07: 新增 `create_tag` / `list_tags`（violet-posts），补全标签创建能力——此前 `create_post` 带未创建的标签会失败
