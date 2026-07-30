# MCP 引入匿名公开只读通道（violet-reader）
Status: accepted（2026-07-29）

## 背景

ADR-0007 把 MCP server 拆成文章（`/api/v1/mcp`）与抓取（`/api/v1/mcp/scraper`）两个独立端点，拆分依据是三条触发条件：**安全边界 / tool 数量 / 功能域内聚**。两个 server 共用一套 PAT 鉴权（`auth.RequireBearerToken`），体系内**所有端点都需 PAT、所有内容都是私有视角**。

PRD-0007（S2）要补 MCP 三原语里空白的 Resources 与 Prompts，定位为 S1 私有检索 tool 的**公开对照面**：让无 PAT 的轻量 agent 能读已发布文章（尽管这些内容在博客前台本就公开），并注入博客特有的写作风格。这要求博客 MCP 体系出现**第一个匿名端点**。

由此产生架构决策：匿名公开通道该挂哪里？是否独立 server？

## 决策

**新增第三个独立 server `violet-reader`**（`/api/v1/mcp/reader`），作为匿名公开只读通道：

```
/api/v1/mcp            → violet（文章 CRUD + 检索 tool + polish_draft prompt）
                         PAT 鉴权，scope posts:read/write/publish
                         风险：低（写自己草稿）

/api/v1/mcp/scraper    → violet-scraper（抓取 + 订阅 tool）
                         PAT 鉴权，scope posts:scrape + subscriptions:read/write
                         风险：高（SSRF）

/api/v1/mcp/reader     → violet-reader（已发布文章 Resources + writing_style prompt）
                         匿名（不套 RequireBearerToken）
                         风险：无（只读已发布）
                         独立限流维度 mcp-reader
```

reader 仅暴露 `status == published` 的文章（草稿/公告/评论均不在域）。草稿 embed 资源用独立 URI `blog://drafts/{slug}`（reader 不注册该 template，与已发布 `blog://posts/{slug}` 路径段区分）。

## 理由

ADR-0007 的三触发条件原本针对"风险高低"的信任域隔离。violet-reader 命中的是**安全边界触发条件的新形态**：信任域从"风险高低"变为"**匿名 vs 鉴权**"。匿名流量与 PAT 流量是根本不同的信任域：

1. **物理隔离让边界可见**：匿名端点不套 `RequireBearerToken`，装配层（`MCPContainer.PublicHandler`）一眼可辨；混挂文章 server 会让同一端点同时服务 PAT 私有 tool 与匿名公开 Resource，违背 ADR-0007 "不同信任域物理隔离"的精神。
2. **独立限流/急停**：匿名流量用独立维度 `mcp-reader`（120/min），与 PAT 流量（`mcp` 60/min、`mcp-scraper` 30/min）分离；为 issue #51 端点级开关留接入点（急停 reader 不影响 PAT server）。
3. **功能域内聚**："公开只读博客内容"是完整可独立的域——只想读公开内容的轻量 client 单配此 server 够用，不需要 PAT。

业界证据印证方向：官方 Resources 规范（2025-11-25）允许同 server 混鉴权（协议层合法，"Resource permissions SHOULD be checked before operations"），但 Descope / Stytch / Kapa.ai 等多篇安全实践倾向按信任域分离。我们的选择（独立 server）是更保守的安全侧。

## 代价

- **第三个端点**：前端 MCP 接入页要多一个 server 配置项。但 reader 进 `MCP_SERVERS` 数组（加 `anonymous` 维度），复用现有配置生成逻辑，增量成本小（见下"reader 进 MCP_SERVERS 而非独立区块"）。
- **草稿/已发布双 URI**：`blog://posts/{slug}`（已发布）与 `blog://drafts/{slug}`（草稿 embed）并存。这是必要的——`EmbeddedResource.URI` 是可寻址标识，agent 可能 `resources/read` 它；草稿不在公开通道，必须用独立 URI 区分状态，避免 agent 读到内容不符的已发布旧版。

## 否决的替代方案

- **混挂文章 server（靠 scope 隔离）**：协议层合法，但匿名与 PAT 共享端点，不能独立限流/急停，违背信任域隔离。否决。
- **reader 移出 MCP_SERVERS、接入页单开"公开通道"区块**：概念看似最干净，但（1）配置流割裂——用户复制两段、手动合并 JSON，易错；（2）可达性差——reader 是 S2 主交付物，该零成本混进一次配置复制，不该藏在另一区块；（3）ClientConnectPanel 复用代价高（参数化或写两套 panel，都比加一个 `anonymous` boolean 贵）。改用 `anonymous` 显式维度 + `serversForScopes` 恒并入 reader，主路径即可见公开通道。

## 实施影响

- 后端：`brand.MCPReaderServerName = "violet-reader"`；`application/mcp` 新增 `PublicTools`（2 个 Resource handler）+ `NewPublicServer`；`app/mcp_container.go` 加 `PublicHandler`（不套 auth）；`cmd/server/main.go` 挂 `/api/v1/mcp/reader`（独立限流）。
- 边界表达三层（防 agent 在重叠区选型困惑）：
  1. **primitive 描述**：按"寻址（ID vs slug）+ 状态（草稿 vs 已发布）"两维度给选型规则，用 URI 指代对方通道而非 server 名。
  2. **`ServerOptions.Instructions`**：协议原生字段，进 initialize 响应、入 agent context，三 server 各一段（reader 说明"匿名公开只读，草稿/写操作走 violet"）。
  3. **文档**：本 ADR + CONTEXT.md 公开通道词条。
- 前端：`MCPServerSpec` 加 `anonymous?: boolean`；`serversForScopes` 恒并入匿名 server；`CreatePATDialog` 过滤匿名；`clients.ts` `headersOf(ctx, s)` 匿名时不生成 Authorization，9 个 client 各自条件化；`ClientConnectPanel` 开关加"公开"badge。

## 难逆决策记录

- **已发布双通道有意冗余**：已发布文章既可经私有 `get_post`（PAT，按 ID）读，也可经公开 `blog://posts/{slug}`（匿名，按 slug）读。**这是有意为之，非待消除的冗余**——匿名读者无 PAT，必须经公开通道触达已发布内容。未来维护者勿当冗余合并。
- **匿名公开通道的引入**：博客 MCP 体系从此有 PAT/匿名两种信任域，此为本 ADR 的根本性变化。
- **草稿 URI 区分**：`blog://drafts/{slug}` 与已发布路径段编码状态，与公开/私有线同构。
