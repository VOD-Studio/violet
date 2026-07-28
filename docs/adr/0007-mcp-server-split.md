# MCP Server 拆分为文章与抓取两个独立端点
Status: accepted（2026-07-28）

## 背景

抓取 MCP 改造（PRD-0005）前，后端只有一个 MCP server 挂在 `/api/v1/mcp`，注册 5 个文章 CRUD tool，靠 PAT scope（`posts:read/write/publish`）做细粒度授权。前端 MCP 接入页（`web/src/routes/admin.mcp.tsx`）按单 server 设计：硬编码 `mcpServers: { "mimo-blog": ... }` 一条配置。

抓取 MCP 改造完成后，同一 server 上新增 8 个 tool（`scrape_url` + 7 个 subscription），tool 总数达 13 个。这触发了是否拆分 server 的架构决策。

## 决策

**拆成 2 个独立 MCP server，各自端点：**

```
/api/v1/mcp            → "mimo-blog" 文章 server（5 个 post CRUD tool）
                         scope: posts:read/write/publish
                         风险：低（只写自己的草稿）

/api/v1/mcp/scraper    → "mimo-blog-scraper" 抓取 server（8 个 tool）
                         scope: posts:scrape + subscriptions:read/write
                         风险：高（SSRF + 外部抓取）
                         可单独配更严限流
```

两个 server 复用同一套 PAT 鉴权（`auth.RequireBearerToken` + `PATVerifier`），PAT 本身仍是全局的（一个 PAT 可含两组 scope，agent 选配哪个 server 时决定用哪些 scope）。

## 理由（业界证据）

MCP 业界 2026 共识（[官方架构](https://modelcontextprotocol.io/docs/learn/architecture) + [Mathur 架构决策](https://www.linkedin.com/posts/mathurd_one-mcp-server-or-ten-the-architecture-decision-activity-7460913780143788032-TeG_) + [分组实践](https://mcp-bundler.com/2025/12/01/mcp-server-grouping-organization-best-practices/)）有三条拆分触发条件，我们**三条全中**：

1. **安全边界**：post CRUD 无 SSRF 风险（只写自己的草稿），抓取类有 SSRF 风险（scrape_url 任意 URL 抓取 + 订阅抓取外部 feed）。两者是不同的信任域，业界规则"split when servers need different security contexts"直接适用。
2. **tool 数量**：13 个 tool 进入业界说的"10-20 LLM 选择退化区间"（[Tavargere](https://www.linkedin.com/posts/zahiruddin-tavargere_sep-1300-tool-filtering-with-groups-and-activity-7371031592192049152-jOF6)），拆分让 agent 选择更准。
3. **功能域内聚**："写博客文章"与"从外站拉内容"是认知上两个不同的域，各自构成完整的、可独立使用的 server。

业界同时反对"ten tiny fragmented servers"（过度拆分）。判断是否过度的标准是"拆出的每个 server 是否是完整可独立的域"——我们的两个 server 都满足（只想写文章的 agent 单配文章 server 够用；想转载/订阅的 agent 单配抓取 server 够用）。不再拆第三个（如 subscription 独立），因为订阅的目的是抓取，离开抓取不够独立。

## 代价

- **后端装配重复**：PAT verifier + auth middleware 两套，但可复用现有 `inframcp.NewPATVerifier` + `mcpauth.RequireBearerToken`，重复成本小。
- **agent 配两条**：用户在前端要选配哪个 server（或都配）。前端 MCP 接入页需改为支持多 server 配置生成（选 PAT + 选 server + 生成对应 `mcpServers` JSON）。
- **已接入 agent 的配置需迁移**：现有只配 `mimo-blog` 的 agent 若要用抓取能力，需补配 `mimo-blog-scraper`。这是迁移成本，但抓取 MCP 是新功能，没有现成 agent 依赖。

## 否决的替代方案

- **保持单 server（靠 scope 隔离）**：业界默认选项，agent 配一条简单。但 SSRF 风险与 post CRUD 共享端点，不能独立限流/监控/回收。三条触发条件全中的情况下，安全隔离的收益大于配置简单的收益。
- **拆 3 个（文章 + 抓取 + 订阅）**：订阅离开抓取不够独立（订阅的目的是抓取），属过度拆分，否决。

## 实施影响

- 后端：`app/mcp_container.go` 拆出两个 server 装配；`cmd/server/main.go` 加 `/api/v1/mcp/scraper` 路由；`application/mcp/server.go` 的 `NewServer` 拆成 `NewPostServer` + `NewScraperServer`（或参数化 tool 集合）。
- 前端：MCP 接入页配置卡片改多 server（选 PAT + 选 server + 生成 JSON）。
- 不影响 tool 内部实现（tool handler 不变，只是注册到不同 server）。
