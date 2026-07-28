# PRD: MCP 检索三 tool（search_posts / search_formulas / search_code_blocks）

## Problem Statement

博客已有两个 MCP server（ADR-0007）：文章 server（5 个 post CRUD tool）与抓取 server（scrape_url + 7 个订阅 tool），共 13 个 tool 全部覆盖「写」与「拉」两条路径，**没有任何检索能力**。

LLM agent 帮站长写作时回答不了三个基本问题：

1. **「我之前写过 X 吗？」**——无法按关键词检索自己的文章（含草稿），容易重复写作或漏掉可引用的旧文。
2. **「我哪篇文章用过这个公式？」**——本博客是数学/化学向，公式是核心内容资产。浏览时渲染架构（ADR-0004）把公式以 `$...$`/`$$...$$` LaTeX 源码存于 content_md，天然可按源码检索，但没有入口。
3. **「我那段代码写在哪个文章里？」**——可运行代码块（ADR-0006）同样带语言与 runnable 标记存于 content_md，无法复用。

HTTP 侧同样没有文章搜索（全库 grep 仅 music search 存在），本 PRD 只做 MCP 侧（agent 是检索的第一消费者），HTTP 搜索留待将来前台需求驱动。

## Solution

在现有文章 server（`/api/v1/mcp`，低风险读域）新增 3 个检索 tool：

1. **`search_posts`**：标题/摘要/正文 ILIKE 全文检索，返回精选 snippet（不 dump 全文），分页。
2. **`search_formulas`**：按 LaTeX 源码片段检索公式，返回公式所在文章 + 源码 + 展示模式。
3. **`search_code_blocks`**：按语言/内容/runnable 标记检索代码块。

定位为**私有写作助手视角**：PAT + `posts:read` scope，检索范围 = PAT 持有人的全部文章（含草稿），与 `list_drafts`/`get_post` 的既有私有视角一致。公开内容检索不做 tool——按 MCP 三原语语义（Tools=动作、Resources=只读数据、Prompts=行为模板），公开内容归后续 S2 的 Resources 通道（见 Further Notes 系列版图）。

## User Stories

1. 作为站长，我想让 agent 写作前检索我是否写过某主题（含草稿），这样避免重复写作、可引用旧文。
2. 作为站长，我想检索时看到命中上下文片段（snippet）而非全文，这样 agent 的上下文窗口不被撑爆；需要全文时 agent 自行调 `get_post`。
3. 作为站长，我想按状态过滤检索（只看草稿/只看已发布），这样缩小范围。
4. 作为站长，我想按 LaTeX 源码片段（如 `\ket`、`\ce{H2O}`）检索公式，这样能找到用过某物理/化学表达式的文章。
5. 作为站长，我想按语言和内容检索代码块（如「所有 python 的 runnable 块」），这样写作时复用旧代码。
6. 作为站长，检索结果分页并带 `total_count`/`has_more`，这样 agent 能决定是否翻页而不是一次吞下全部。
7. 作为站长，检索无结果时返回可操作的建议（换关键词/缩短线索），这样 agent 能自我纠正而不是卡住。
8. 作为站长，检索能力复用 `posts:read` scope 挂在现有文章 server，这样 PAT 权限模型零变化、不给抓取 server 增加读面。

## Implementation Decisions

### MCP tool 形状（遵循 2026 业界最佳实践，见 Further Notes）

扁平参数、受限枚举、默认值减少 agent 决策；返回精选 snippet 不 dump 全文；分页元数据齐备。

**`search_posts`**（scope `posts:read`）

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `query` | string | 必填 | 关键词；空格分割多词，AND 逻辑 |
| `status` | enum | `"all"` | `all`/`draft`/`published`/`archived` |
| `limit` | int | 20 | 上限 50，超出钳制 |
| `offset` | int | 0 | 分页偏移 |

返回 `{ posts: [{id, slug, title, status, tags, snippet, updated_at}], total_count, has_more, next_offset }`。
snippet = 首个命中点前后各约 80 字符的上下文窗口（Go 侧生成，纯文本）。

**`search_formulas`**（scope `posts:read`）

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `query` | string | 必填 | LaTeX 源码片段（tool 描述中教 agent：如 `\frac`、`\ket`、`\ce{H2O}`） |
| `limit` / `offset` | int | 20 / 0 | 同上 |

返回 `{ formulas: [{post_id, post_slug, post_title, latex, display_mode, context_snippet}], total_count, has_more, next_offset }`，`display_mode` ∈ `inline`/`block`。
实现：SQL ILIKE 在 content_md 初筛候选文章 → Go 提取器解析公式 → 过滤 LaTeX 含 query 的命中。

**`search_code_blocks`**（scope `posts:read`）

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `query` | string | 可选 | 代码内容关键词 |
| `lang` | enum | `"all"` | `python`/`node`/`go`/`rust`/`bun`/`all`（对齐 code runner 五语言） |
| `runnable_only` | bool | false | 只返回带 runnable 标记的块 |
| `limit` / `offset` | int | 20 / 0 | 同上 |

返回 `{ code_blocks: [{post_id, post_slug, post_title, lang, runnable, code}], total_count, has_more, next_offset }`。

### 检索技术选型：ILIKE

四方案对比（2026 证据，详见 Further Notes）：

| 维度 | ILIKE（选定） | pg_trgm | zhparser/pg_jieba | ParadeDB pg_search |
|------|--------------|---------|-------------------|--------------------|
| 中文命中 | 子串精确，必中 | 查询词 ≥3 字符才有效，两字词退化 | 真分词最精准 | 单字 token，命中广但无词边界 |
| 部署成本 | 零 | contrib 自带 | 自定义镜像编译 | 换 paradedb 镜像 |
| 相关性排名 | 无（按 updated_at 倒序） | similarity 弱排名 | ts_rank | BM25（中文单字 token 排名打折） |
| 适配度 | 个人博客毫秒级 | 中文短板真实 | 运维负担 | 替代 ES 级，杀牛刀 |

选定 **ILIKE**：写作助手场景的需求是「找到」而非「排名」；检索实现收敛在仓储层单一方法，未来文章量增长后升级 pg_trgm/zhparser 时 MCP tool 接口零变化（seam 已留）。

### 架构落位（贴合现有 DDD + ADR-0007）

- **`application/mcp`**：新 `SearchTools` struct，3 个 tool 注册进现有 `NewPostServer`。tool 总数 5→8，在业界 5-15 合理区间，不触发 server 拆分。
- **`domain/post`**：仓储接口新增 `Search(ctx, authorID, query, status, page, limit)`。
- **`infrastructure/persistence/gorm/post_repo.go`**：ILIKE 实现（`title`/`excerpt`/`content_md` 三列，多关键词 AND，updated_at 倒序）。
- **`application/post`**：Service 新增 `Search`（编排 + snippet 生成）；新建 **Markdown 元素提取器**（独立小文件）：扫描 content_md 提取公式（`$...$`/`$$...$$`）与代码块（围栏 + info string 解析 runnable/ResourceLimits）。
  - 注意：`math_extract.go` 是导入方向的 HTML→Markdown 公式还原（scrape 流程），**不可复用**；提取器是新组件，纯文本状态机。
- **鉴权**：复用 `requireScope(posts:read)`；搜索范围 `WHERE author_id = PAT 持有人`（与 `list_drafts` 一致）。
- **前端零改动**（MCP 接入页已支持文章 server 配置生成，tool 增减不影响）。

### 错误处理（错误即指令，agent 可自我纠正）

- 空结果 → 文本提示：「未找到匹配 'X'。建议：缩短关键词/换英文术语/去掉空格用单词重试」。
- `query` 为空 → tool error：「query 不能为空：提供关键词（search_posts）或 LaTeX 片段（search_formulas）」。
- `limit` 超界 → 钳制到 50（tool 描述中说明上限）。
- scope 缺失 → 复用现有 `requireScope` 错误模式。

## Testing Decisions

只测外部行为，复用现有三层 seam，不新建测试设施。

- **seam #1（最高优先）—— MCP tool 层**：沿用 `tools_test.go` 的 fake service 模式。覆盖 3 个 tool 的 scope 门禁（无 `posts:read` 拒绝）、参数默认值/钳制、空结果提示文案、错误透传。
- **seam #2 —— Service 层**：沿用 `service_slug_test.go` 模式。覆盖 snippet 窗口截取（命中在开头/中间/结尾/多次命中只取首个）、Markdown 提取器（嵌套 `$`、代码块内反引号、runnable info string 解析、数学块与代码块相邻）。
- **seam #3 —— 仓储层**：沿用 gorm repo 测试模式。覆盖 ILIKE 中英文、多关键词 AND、status 过滤、author_id 隔离、分页边界（offset 超出返回空 + has_more=false）。

不测：ILIKE 本身行为（Postgres 语义）、MCP SDK 序列化。

## Out of Scope

- **公开内容检索**：归 S2 Resources 通道（无 PAT 的只读 `blog://posts/{slug}`），本 PRD 不做。
- **相关性排名 / 中文分词 / 模糊匹配**：ILIKE 按时间排序足够；升级路径已留 seam，需要时单独立项。
- **语义搜索 / 向量检索**：agent 客户端可自行多轮同义词查询，服务端不建 RAG 设施。
- **HTTP 搜索接口 / 前台搜索 UI**：将来由前台需求驱动，单独立项。
- **检索评论/订阅条目/音乐**：分别归 S3/S5（见 Further Notes 系列版图）。
- **结果高亮标记**（如 `<mark>`）：snippet 为纯文本，agent 自行定位关键词，不加标记语法。

## Further Notes

### 系列版图：MCP 能力扩展五个子项目

本 PRD 是 S1。完整版图（按构建顺序）：

| 子项目 | 内容 | 风险域 | 状态 |
|--------|------|--------|------|
| **S1 检索核心** | search_posts / search_formulas / search_code_blocks | 读域（posts:read） | 本 PRD |
| **S2 Resources+Prompts** | 公开只读 `blog://` resources + 写作模板 prompts | 新公开通道 | 待立项 |
| **S3 批注反馈回路** | search_comments + list_recent_comments（锚点批注→写作改进闭环） | 读域 | 待立项 |
| **S5 跨域杂项** | 音乐检索 / 订阅条目检索 / 版本历史 | 读域 | 待立项 |
| **S4 质量守门** | lint_post（公式校验+SEO 完整性，死链可选默认关）+ LLM 写作辅助（摘要/SEO/标题） | 读域 + LLM 成本 | 待立项 |

已沉淀的系列级决策：

- **私有/公开分工**：检索类 tool 一律私有视角（PAT 持有人），公开内容一律走 Resources 通道（三原语语义分工）。
- **`verify_code_block` 移除**：沙箱执行能力不暴露到 MCP——写文章的 agent（Claude Code 等）自带本地执行环境，服务端沙箱服务的是读者场景（已有阅读页 SSE）。增量价值边际、执行域暴露成本真实。未来无执行环境的轻量 client 有需求时可纯增量加回。
- **S4 瘦身**：移除 verify 后 S4 无执行域，lint_post 只做静态检查，可挂现有文章 server 加独立 scope，不需独立 server。

### 难逆决策

- 检索定位私有 tool（决定后续所有读类 tool 的视角约定）。
- ILIKE 起步（放弃分词/排名，换取零部署成本；升级 seam 在仓储层单方法）。
- tool 挂现有文章 server 而非新建检索 server（8 tool 在合理区间，ADR-0007 三条件均未触发）。

### 改动拆分（遵守 AGENTS.md 原子提交规则）

1. `docs(prd): 沉淀 PRD-0006`（本文件）。
2. `feat(post): 文章仓储新增 ILIKE 全文检索方法`（domain 接口 + gorm 实现 + repo 测试）。
3. `feat(post): 新增 Markdown 公式与代码块提取器`（application/post + 单测）。
4. `feat(post): Service 新增文章检索编排与 snippet 生成`（service + 单测）。
5. `feat(mcp): 文章 server 新增三个检索 tool`（SearchTools + 注册 + tool 层测试）。

每步独立可 revert；2/3 无依赖可并行，4 依赖 2+3，5 依赖 4。

### 业界参考

- **MCP tool 设计**：Philipp Schmid《MCP is Not the Problem, It's your Server》（2026-01）六条最佳实践——outcomes not operations / 扁平参数 / instructions are context / curate ruthlessly（5-15 tool）/ 命名可发现 / 分页元数据。Metorial《MCP Server Best Practices for 2026》同口径。
- **三原语语义**：Microsoft《MCP Demystified: Tools vs Resources vs Prompts》——Tools=动作、Resources=只读数据、Prompts=行为模板（私有 tool + 公开 Resource 分工的依据）。
- **pg_trgm 中文限制**：阿里云实测《Performance Optimization of Fuzzy Queries for Chinese Characters Using PostgreSQL trgm》——查询词至少 3 字符。
- **ParadeDB 中文 tokenizer**：官方文档 chinese_compatible 为单字 token（无词边界）。
- **ADR-0007**：server 拆分三条件（安全边界/tool 数量/功能域内聚），本 PRD 均未触发。
