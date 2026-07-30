# PRD: MCP 公开只读通道(Resources + Prompts)

## Problem Statement

博客 MCP 体系经 PRD-0006 后有两个 server(文章 + 抓取)共 8 个 tool,**全部 PAT 鉴权、全部私有视角**。三原语里只用了 Tools 一种,Resources 与 Prompts 通道空白。

由此产生两个缺口:

1. **匿名 agent 读不到已发布内容。** 现状读文章的唯一途径是 PAT-gated 的 `get_post`/`search_posts`。一个没有 PAT 的轻量 agent(只读型助手、内容聚合器)无法消费博客的已发布文章,尽管这些内容在博客前台本就公开。MCP 通道的适用面被限制在"持有 PAT 的写作 agent"。
2. **博客特有的写作上下文无法注入。** 博客有固定的品牌写作风格(公式用 `\ket`、代码块加 runnable 标记、转载必 canonical 等),只有站长/服务端知道,通用 agent(Claude Code 等)不知道。agent 写出的文章文风不统一、漏掉本博客约定。三原语里 Prompts 正是为这类"服务端定义、可复用的指令模板"设计的,但通道空白。

HTTP 侧不做(与 PRD-0006 同口径:agent 是第一消费者,前台网页已覆盖人类读者的公开读取)。

## Solution

引入博客 MCP 体系的**第三个 server `violet-reader`**(`/api/v1/mcp/reader`),作为**匿名公开只读通道**:

1. **Resources**(匿名):已发布文章的只读数据通道
   - `blog://posts/{slug}`(单篇,ResourceTemplate):完整 Markdown 源码(含公式 LaTeX 与代码块)
   - `blog://posts`(目录,静态 Resource):已发布文章的 slug + 标题列表,供发现
2. **Prompts**(分两组):
   - `writing_style`(挂 reader,匿名静态):博客品牌写作风格指南
   - `polish_draft`(挂文章 server,PAT `posts:read`,参数 `slug`):embed 草稿 + 注入风格,编排润色工作流

定位为**私有写作通道(PRD-0006)的公开对照面**。三原语语义分工落地:Tools=私有动作(PAT)、Resources=公开只读数据(匿名)、Prompts=可复用指令(公开模板 + PAT 编排)。

### 与 S1 的分工:有意冗余的已发布双通道

已发布文章**双通道均可读**:
- 私有通道 `get_post`(PAT,按 ID,可读草稿)
- 公开通道 `blog://posts/{slug}`(匿名,按 slug,仅已发布)

**这是有意为之**,非待消除的冗余:匿名读者无 PAT,必须经公开通道触达已发布内容。两通道按**寻址方式(ID vs slug)+ 状态(草稿 vs 已发布)**两维度区分,描述文案给出选型规则(见 Implementation Decisions 边界表达节)。

## User Stories

1. 作为读者(或只读型 agent),我想不经 PAT 读取博客已发布文章的完整 Markdown 源码,这样轻量 agent 能消费内容、聚合器能结构化抓取。
2. 作为读者,我想先看到一个已发布文章目录(slug + 标题),这样我能发现有哪些文章可读,而不是盲猜 slug。
3. 作为站长,我想让 agent 写作前注入本博客的品牌写作风格指南,这样写出的文章文风一致、遵守本博客约定(公式/代码块/转载规范)。
4. 作为站长,我想用一个 prompt 完成读草稿 + 注入风格 + 触发润色的编排,而不是手动调 get_post 再拼提示词。
5. 作为同时挂载私有与公开通道的 agent,我想在两个通道的重叠区(读已发布文章)一眼判断该用哪个,而不是纠结或重复读。
6. 作为站长,我想在接入页零成本把公开通道混进一次配置复制里(与 PAT server 同段 mcp.json),而不是为匿名通道单独操作或手写配置。
7. 作为接入者,我想 server 在 initialize 时就告知自己的能力定位(公开只读 / PAT 私有),这样在 server 选型层(比 tool 描述高一层)就能读到分工。

## Implementation Decisions

### 架构落位:第三个独立 server

**`violet-reader`**(`/api/v1/mcp/reader`),独立于现有两个 PAT server:

| server | 端点 | 鉴权 | 原语 | 风险域 |
|---|---|---|---|---|
| `violet` | `/api/v1/mcp` | PAT | Tools(写/检索) + Prompts(`polish_draft`) | 低(写自己草稿) |
| `violet-scraper` | `/api/v1/mcp/scraper` | PAT | Tools(抓取/订阅) | 高(SSRF) |
| **`violet-reader`(新增)** | `/api/v1/mcp/reader` | **匿名** | Resources(只读数据) + Prompts(`writing_style`) | 无(只读已发布) |

**为什么独立 server 而非挂文章 server**(见 ADR-0008 详述,此处摘要):

ADR-0007 的 server 拆分三条件(安全边界 / tool 数量 / 功能域内聚)原本针对"风险高低"的信任域隔离。`violet-reader` 引入的是**信任域的新形态:匿名 vs 鉴权**——博客 MCP 体系的第一个匿名端点。匿名流量与 PAT 流量是根本不同的信任域,物理隔离让边界可见、可独立限流/急停(为 issue #51 端点级开关留接入点)。混挂文章 server 会让同一端点同时服务 PAT 私有 tool 与匿名公开 Resource,违背 ADR-0007 "不同信任域物理隔离"的精神。

业界证据(2026)印证:[官方 Resources 规范](https://modelcontextprotocol.io/specification/2025-11-25/server/resources)允许同 server 混鉴权(协议层合法),但[Descope](https://www.descope.com/blog/post/mcp-server-security-best-practices)/[Stytch](https://stytch.com/blog/mcp-authentication-and-authorization-guide/) 等多篇安全实践倾向按信任域分离。

### Resources 形状

**`blog://posts/{slug}`** 单篇(ResourceTemplate,匿名)

返回完整 Markdown 源码(`content_md`),含公式 LaTeX 源与代码块。MIME `text/markdown`。handler 调 `postService.GetPublishedBySlug(ctx, slug)`(新增,见下),仅返回 `status == published` 的文章,否则 ResourceNotFound。

**`blog://posts`** 目录(静态 Resource,匿名)

返回已发布文章的 `{slug, title}` 列表(不 dump 正文)。handler 调现有 `postService.ListPublished`。MCP 协议的 `resources/list` 不自动展开 ResourceTemplate 实例,故目录需独立静态 Resource,否则 agent 拿不到 slug 清单。

**URI scheme 选 `blog://` 而非 `violet://`**:scheme 是长期稳定标识符,agent 配置会硬编码。仓库刚经历 mimo→violet rebrand(见 git log),scheme 不该绑品牌,描述"博客这类东西"而非"某品牌的博客"。

### 数据访问层:status 过滤下沉

现状 `postService.GetBySlug` → `repo.FindBySlug` **不过滤 status**(能查出草稿/归档/任何状态)。匿名 reader 若直接复用,有**草稿泄露风险**。

新增 **`postService.GetPublishedBySlug(ctx, slug)`**:内部调 `FindBySlug` 后校验 `status == published`,否则返回 NotFound。状态过滤收敛在 Service 层(reader handler 零状态判断),符合 DDD 分层,且该方法可被前台 SSR 复用(前台单篇本就该只读 published)。

业界安全共识([Checkmarx](https://checkmarx.com/learn/mcp-security-risks-real-world-incidents-and-security-controls/)、[Trend Micro](https://www.trendmicro.com/vinfo/us/security/news/vulnerabilities-and-exploits/update-on-exposed-mcp-servers-the-threat-widens-to-the-cloud)、[AuthZed MCP Breaches Timeline](https://authzed.com/blog/timeline-mcp-breaches)):在数据层/服务端过滤 published,不依赖客户端或中间件判断。AuthZed 时间线记录的真实事故即"私有/未发布数据经 MCP 意外暴露"。

### Prompts 形状

**`writing_style`**(挂 reader,匿名,无参数)

静态 messages,注入博客品牌写作风格指南。内容**硬编码在 Go 常量**(风格规则相对稳定,变更频率低;改规则即改代码+发版)。业界主流实践:SDK 把 prompt 当静态模板处理,数据库驱动的动态 prompt 属企业级特性([Dev.to AWS Heroes](https://dev.to/aws-heroes/mcp-prompts-and-resources-the-primitives-youre-not-using-3oo1)),S2 不引入。将来站长真有"自定义风格"需求(S4 域)再升级为可配置。

```
writing_style():
  msg[0] user: [TextContent("你是本博客写作助手。请严格遵循以下品牌写作风格指南:\n\n" + <风格规则全文>)]
```

风格规则覆盖:公式标记约定(`\ket` 而非 `|ψ⟩`、`\ce{}` 化学式)、代码块规范(runnable 标记、语言标注)、转载规范(canonical 必填)、标题/摘要风格、标签使用约定等。具体规则在实现时按博客现状固化。

**`polish_draft`**(挂文章 server,PAT `posts:read`,参数 `slug`)

编排型 prompt:一次 `prompts/get` 完成读草稿 + 注入风格 + 触发润色。草稿查询范围 = **PAT 持有人的文章**(与 `get_post`/`search_posts` 一致)。

```
polish_draft(slug):
  msg[0] user: [TextContent("按以下风格指南润色草稿:\n\n" + <风格规则全文>),
                EmbeddedResource(uri="blog://drafts/{slug}", <草稿全文>)]
  msg[1] user: [TextContent("输出润色后的完整 Markdown,保持公式与代码块标记不变。")]
```

- **2-message 结构**:指令+草稿同条 message 的两个 content block(语义上"指令和它处理的数据是一组"),输出要求独立一条(完成动作的触发语)。比多 message 拆分更紧凑,符合"content 数组内组合多来源"的 SDK 设计。
- **草稿 embed URI 用 `blog://drafts/{slug}` 而非 `blog://posts/{slug}`**(见下"草稿 URI 回修")。
- 草稿不存在或非 PAT 持有人 → 显式 JSON-RPC `-32602`(invalid params,带可读消息),**不静默降级**([Speakeasy](https://www.speakeasy.com/mcp/core-concepts/prompts/):validate required arguments, handle missing data gracefully)。

### 草稿 URI 回修:`blog://drafts/{slug}`

`EmbeddedResource` 的 URI 是**可寻址标识**(`ResourceContents.URI`),agent 收到后可能发起 `resources/read` 直接读。若草稿 embed 用 `blog://posts/{slug}`:

- reader(A2 决策:仅 published)读不到草稿——NotFound,或读到同名已发布旧版(内容与 prompt embed 的草稿不符);
- 草稿 slug 与已发布文章撞名时 URI 歧义。

回修:草稿 embed 用独立 URI **`blog://drafts/{slug}`**。reader 不注册该 template(保持 A2 边界),仅 `polish_draft` 内部以此标识草稿资源。URI 路径段区分状态(`posts` = 已发布 / `drafts` = 草稿),与"公开/私有"分工同构,成为边界表达的一部分。

### 边界表达:让 agent 与维护者看清分工

三原语 + 两通道的重叠区易致 agent 选型困惑。边界表达分三层:

**层次 1 — primitive description(面向 agent 选型)**

延续现有惯例(search_posts 已有对照先例),按"寻址 + 状态"两维度给**选型规则**,用 URI 指代对方通道而非 server 名(挂 violet 的 agent 未必挂 reader):

- `get_post`:"按 ID 读取文章(含草稿正文)。唯一读草稿的途径;手里是 slug 或面向已发布文章时,可用公开通道的 `blog://posts/{slug}` 资源(无需令牌)。需 posts:read 权限。"
- reader 单篇 Resource:"按 slug 读取已发布文章的完整 Markdown 源码(含公式 LaTeX 与代码块)。仅已发布;读草稿用 violet server 的 get_post(需 PAT)。"
- reader 目录 Resource:"已发布文章目录(slug + 标题列表),用于发现可读文章。无需令牌。"
- `writing_style`:"本博客品牌写作风格指南(匿名可读)。写作前注入以保持文风一致。"
- `polish_draft`:"按本博客风格润色指定草稿。注入草稿全文+风格指南;仅可润色自己的草稿。需 posts:read 权限。"

措辞统一说"已发布文章",不说"他人文章"(单作者博客语境,"他人"不成立)。

**层次 2 — `ServerOptions.Instructions`(协议原生,server 选型层)**

go-sdk 的 `ServerOptions.Instructions` 进 initialize 响应、入 agent context,是"instructions are context"的官方落点。现状三个 server 都是 `NewServer(meta, nil)`,第二参空着未用。给每个 server 写一段 Instructions,成本极低。reader 示例:

> 本 server 是博客的公开只读通道:匿名访问,仅暴露已发布文章(Resources)与写作风格指南(Prompts)。不含草稿、公告、评论。草稿访问与写操作请用 violet server(需 PAT)。

可选:给 reader server `Implementation.Title` 设"Violet 公开阅读"(面向 client UI 展示)。**不引入**自定义 capability 元信息(YAGNI——Instructions 是协议该用的字段不用才可惜,自定义元信息才是 YAGNI 反对的)。

**层次 3 — 文档沉淀(面向人)**

- **CONTEXT.md 新增 MCP 章**(词条体,非功能列表):新增"公开通道(Public Channel)"等词条,定义三 server + 公开/私有线 + "已发布双通道有意冗余"。
- **ADR-0008**(引用 ADR-0007 扩展,非从零论证):reader 命中的是 0007 "安全边界"触发条件的新形态(信任域从"风险高低"变"匿名 vs 鉴权");记录匿名通道引入、独立 server 理由、reader 进 `MCP_SERVERS` 而非独立区块(见前端节)、**"已发布双通道重叠有意为之"**——这条不写下来,未来维护者会当冗余合并掉。

### 前端接入页:reader 进 MCP_SERVERS + anonymous 维度

现状 `web/src/features/admin-mcp/model/types.ts` 的 `MCP_SERVERS` 数组驱动整个接入页,核心假设是**每个 server 绑 PAT scope**。reader 匿名打破这个隐含假设——治本是给 server 模型加**显式鉴权维度**,而非三处各打补丁。

**模型层(`types.ts`)**:`MCPServerSpec` 加 `anonymous?: boolean`;追加 reader 条目(`scopes: []`, `anonymous: true`);`serversForScopes` 语义改为 `s.anonymous || s.scopes.some(...)`(注释同步)。

```ts
export interface MCPServerSpec {
    key: string; label: string; endpoint: string; description: string;
    scopes: string[];
    /** 匿名可读:不进 PAT 对话框、配置不带 Authorization、任何 scope 上下文均可见 */
    anonymous?: boolean;
}

export const MCP_SERVERS: MCPServerSpec[] = [
    { key: "violet", label: "文章", endpoint: "/api/v1/mcp", /* ... */ },
    { key: "violet-scraper", label: "抓取", endpoint: "/api/v1/mcp/scraper", /* ... */ },
    {
        key: "violet-reader", label: "公开阅读", endpoint: "/api/v1/mcp/reader",
        description: "已发布文章 Resources + 写作风格 Prompts,匿名只读",
        scopes: [], anonymous: true,
    },
];
```

**三处冲突的收敛**:
- `CreatePATDialog`:`MCP_SERVERS.filter((s) => !s.anonymous)` 后再 map(PAT 对话语境是"令牌能访问什么",匿名 server 天然不属)。
- `serversForScopes`:**恒并入 reader**(语义 = scope 命中 ∪ 匿名)。反推不并入的后果:用户主路径("创建 PAT → 复制配置"或"点已有 PAT 接入")下 `activeScopes` 恒非 null,reader 只在初始占位态出现,等于主路径永远看不到 reader,公开通道推广落空。
- `clients.ts`:`headersOf(ctx)` → `headersOf(ctx, s)`,匿名时返回无 headers 的 entry;JSON snippet 系(cursor/vscode/gemini/opencode/oh-my-pi/generic/claude fallback)的 `{url, headers}` 退化为 `{url}`;命令行系(claude-code/gemini primary)`--header` 条件拼接;codex 不加 `--bearer-token-env-var`、TOML 不生成 `http_headers` 行、首条 `export VIOLET_TOKEN` 仅当启用集中含 PAT server 时输出;claude-desktop 的 mcp-remote args 去掉 `--header`+值;cursor deeplink 的 btoa config 无 headers。
- `ClientConnectPanel`:server 开关项加"公开·无需令牌"badge(globe icon + muted 文案)消解"用户误以为 reader 受 PAT 保护"的顾虑——混排反成告知入口。

**类型形态用 `anonymous?: boolean` 而非判别联合**(`{auth:"pat";scopes} | {auth:"anonymous"}`):贴合仓库朴素风格,非法态("匿名却有 scope")用测试防;判别联合需 type predicate,啰嗦,收益不抵成本。

**不选"独立区块/独立卡片"的理由**:reader 移出 `MCP_SERVERS` 单开区块看似概念最干净,但(1)配置流割裂——用户复制两段、手动合并 JSON,易错;(2)可达性差——reader 是 S2 主交付物,该零成本混进一次配置,不该藏在另一区块;(3)ClientConnectPanel 复用代价高(参数化或写两套 panel,都比加 boolean 贵)。

### 鉴权装配

reader server **不套 `RequireBearerToken`**,直接 `StreamableHandler`(匿名端点就是匿名,不伪装):

```go
// app/mcp_container.go
PublicHandler: appmcp.StreamableHandler(publicServer),  // 无 auth 包裹
// cmd/server/main.go
r.With(middleware.RateLimit("mcp-reader", redisClient, time.Minute, 120)).
    Handle("/api/v1/mcp/reader", mcpContainer.PublicHandler)
```

限流独立维度(`mcp-reader`),与 PAT 限流分离。

## Testing Decisions

只测外部行为,复用现有 seam,不新建测试设施。

- **reader Resources seam**:沿用 `tools_test.go` 的 fake service 模式。覆盖匿名读取已发布文章、草稿/归档返回 NotFound、目录列表分页、不存在的 slug 报错。
- **Service 层 seam**:沿用 `service_slug_test.go` 模式。覆盖 `GetPublishedBySlug` 的状态过滤(published 通过、draft/archived 返回 NotFound、不存在返回 NotFound)。
- **Prompts seam**:覆盖 `writing_style` 静态 messages 内容、`polish_draft` 的 2-message 结构、草稿 embed URI 为 `blog://drafts/{slug}`、草稿不存在/无权限返回 `-32602`、embed 内容与草稿一致。
- **前端 `clients.test.ts`**:契约断言更新(`serversForScopes([])` 现返回 `[violet-reader]`;默认 servers 配置快照含 reader entry);新增匿名 entry 无 Authorization、混合启用时 PAT server 有 reader 无 的契约测试。

不测:go-sdk 序列化、MCP SDK 的 resources/prompts 协议本身。

## Out of Scope

- **站点级总闸**(端点级 403 开关):归 issue #51,与 S2 正交。S2 默认 reader 开放,#51 日后给所有 MCP 端点加急停。
- **公告/评论/批注的 Resource**:公告归前台需求驱动;评论/批注检索归 S3。
- **风格指南可配置化**(后台编辑):S2 硬编码;站长自定义需求真实出现时归 S4。
- **通用写作能力**(摘要/SEO/续写):agent 自带,归 S4 LLM 辅助。
- **Cursor deeplink 全匿名可免 token**:当前无真实 token 退化为 snippet;全匿名启用集时其实可 deeplink,作为后续改进,不阻塞 S2。

## Further Notes

### 系列版图定位

本 PRD 是 PRD-0006 系列版图的 **S2**(原标注"Resources+Prompts,待立项")。完成后系列状态:

| 子项目 | 内容 | 状态 |
|---|---|---|
| S1 检索核心 | search_posts / search_formulas / search_code_blocks | ✅ 已合并(PR #59) |
| **S2 Resources+Prompts** | **公开 reader server + writing_style + polish_draft** | **本 PRD** |
| S3 批注检索回路 | search_comments + list_recent_comments | 待立项 |
| S5 跨域杂项 | 音乐/订阅条目/版本历史检索 | 待立项 |
| S4 质量守门 | lint_post + LLM 写作辅助 | 待立项 |

### 难逆决策

- **匿名公开通道的引入**(决定博客 MCP 体系从此有 PAT/匿名两种信任域)。
- **独立第三 server**(匿名端点物理隔离,为限流/急停/监控留接入点)。
- **reader 进 MCP_SERVERS 而非独立区块**(接入页 UX 路径,影响所有未来匿名 server 的呈现方式)。
- **`blog://drafts/{slug}` 草稿 URI 区分**(URI 路径段编码状态,与公开/私有线同构)。
- **已发布双通道有意冗余**(匿名可达性的必要代价,非待消除)。

### 改动拆分(遵守 AGENTS.md 原子提交规则)

1. `docs(prd): 沉淀 PRD-0007`(本文件)+ `docs(adr): 沉淀 ADR-0008 公开只读通道`(可与本文件同 commit 或分开)。
2. `feat(post): Service 新增 GetPublishedBySlug 状态过滤`(service + 单测;独立可 revert)。
3. `feat(mcp): 新增 violet-reader 匿名公开 server`(server 装配 + Resources handler + Instructions + 单测)。
4. `feat(mcp): 新增 writing_style 与 polish_draft Prompts`(writing_style 挂 reader,polish_draft 挂文章 server + 草稿 URI 回修 + 单测)。
5. `feat(web): 接入页 MCP_SERVERS 支持 anonymous 维度`(types + clients.ts headersOf 下沉 + ClientConnectPanel badge + 契约测试)。
6. `docs(domain): CONTEXT.md 新增 MCP 公开通道词条`。

2 独立;3 依赖 2;4 依赖 3(reader 注册 writing_style);5 前端独立;6 文档独立。

### 业界参考

- **MCP Resources 规范**(2025-11-25):Resources 是 application-driven,`resourceTemplate` 不被 `resources/list` 自动展开(目录需独立 Resource 的依据);安全章节"Resource permissions SHOULD be checked before operations"(status 过滤下沉的依据)。
- **MCP Prompts 规范**(2025-06-18):Prompts 是 user-controlled,`EmbeddedResource` 含可寻址 URI(草稿 URI 回修的依据);messages 支持 content 数组(2-message 结构的依据)。
- **go-sdk v1.4.0**:`AddResource`/`AddResourceTemplate`/`AddPrompt`/`EmbeddedResource`/`ServerOptions.Instructions` 全部支持。
- **Server 拆分 / 信任域隔离**:[Descope](https://www.descope.com/blog/post/mcp-server-security-best-practices)、[Stytch](https://stytch.com/blog/mcp-authentication-and-authorization-guide/)、[Kapa.ai](https://www.kapa.ai/blog/remote-mcp-servers-hosting-authentication-best-practices) 倾向按信任域分离。
- **数据层过滤防泄露**:[Checkmarx](https://checkmarx.com/learn/mcp-security-risks-real-world-incidents-and-security-controls/)、[AuthZed Breaches Timeline](https://authzed.com/blog/timeline-mcp-breaches)、[Trend Micro](https://www.trendmicro.com/vinfo/us/security/news/vulnerabilities-and-exploits/update-on-exposed-mcp-servers-the-threat-widens-to-the-cloud)。
- **Prompt 内容管理**:SDK 主流是静态模板,数据库驱动属企业级特性([Dev.to AWS Heroes](https://dev.to/aws-heroes/mcp-prompts-and-resources-the-primitives-youre-not-using-3oo1))。
- **命名惯例**:[zazencodes](https://zazencodes.com/blog/mcp-server-naming-conventions)"名称描述 server 做什么(能力),不是怎么访问(级别)"——`reader` 优于 `public`。
