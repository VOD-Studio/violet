package mcp

import (
	"net/http"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"blog-api/internal/brand"
)

// ServerMeta 服务器实现元信息（MCP initialize 响应里的 name/version）。
var ServerMeta = &mcp.Implementation{
	Name:    brand.MCPServerName,
	Version: "1.0.0",
}

// ScraperServerMeta 抓取 server 元信息（与文章 server 区分，便于客户端识别）。
var ScraperServerMeta = &mcp.Implementation{
	Name:    brand.MCPScraperServerName,
	Version: "1.0.0",
}

// ReaderServerMeta 公开只读 server 元信息（匿名，仅已发布文章）。
var ReaderServerMeta = &mcp.Implementation{
	Name:    brand.MCPReaderServerName,
	Title:   "Violet 公开阅读",
	Version: "1.0.0",
}

// readerInstructions 进 initialize 响应、入 agent context（PRD-0007 边界表达层次 2）。
// server 选型层（比 tool/resource 描述高一层）即告知公开只读定位。
const readerInstructions = `本 server 是博客的公开只读通道：匿名访问，仅暴露已发布文章（Resources）与写作风格指南（Prompts）。不含草稿、公告、评论。草稿访问与写操作请用 violet server（需 PAT）。`

// CommentsServerMeta 评论检索 server 元信息（评论独立 bounded context，PAT）。
var CommentsServerMeta = &mcp.Implementation{
	Name:    brand.MCPCommentsServerName,
	Version: "1.0.0",
}

// commentsInstructions 进 initialize 响应、入 agent context。
// server 选型层告知评论检索定位，与文章域区分。
const commentsInstructions = `本 server 检索读者评论/批注反馈，仅已审核通过（approved）；用于「读者批注→写作改进」闭环。文章本身（读全文/写文章）用 violet-posts server。批注带 anchor.selected_text 标注读者划中的原文。`

// NewPostServer 构造文章 MCP 服务器（/api/v1/mcp），注册 5 个文章 CRUD tool + 3 个检索 tool + 2 个标签 tool + 1 个编排 prompt。
// 低风险域：只写自己的草稿/发布自己的文章，无 SSRF。检索为私有视角（PAT 持有人全部文章）。
// tools 提供具体 handler；AddTool 从参数结构体推导 JSON Schema。
// prompts 提供 polish_draft 编排 prompt（PAT posts:read）。
func NewPostServer(tools *PostTools, search *SearchTools, prompts *PromptTools, tagTools *TagTools, seriesTools *SeriesTools) *mcp.Server {
	s := mcp.NewServer(ServerMeta, nil)

	mcp.AddTool(s, &mcp.Tool{
		Name:        "create_post",
		Description: "为当前用户创建一篇草稿文章。需 posts:write 权限。",
	}, tools.CreatePost)

	mcp.AddTool(s, &mcp.Tool{
		Name:        "update_post",
		Description: "更新已有文章的内容。仅能改自己名下的文章。需 posts:write 权限。",
	}, tools.UpdatePost)

	mcp.AddTool(s, &mcp.Tool{
		Name:        "publish_post",
		Description: "将一篇草稿文章发布。需 posts:publish 权限（与 write 独立）。",
	}, tools.PublishPost)

	mcp.AddTool(s, &mcp.Tool{
		Name:        "get_post",
		Description: "按 ID 读取一篇文章（含正文）。需 posts:read 权限。",
	}, tools.GetPost)

	mcp.AddTool(s, &mcp.Tool{
		Name:        "list_drafts",
		Description: "列出草稿状态的文章（分页）。需 posts:read 权限。",
	}, tools.ListDrafts)

	mcp.AddTool(s, &mcp.Tool{
		Name:        "create_tag",
		Description: "为当前用户创建标签（幂等：同名已存在则返回已存在）。需 posts:write 权限。抓取带标签文章时先用此 tool 建标签，再 create_post 带 tags。",
	}, tagTools.CreateTag)

	mcp.AddTool(s, &mcp.Tool{
		Name:        "list_tags",
		Description: "列出所有标签。需 posts:read 权限。create_post 前可先查现有标签。",
	}, tagTools.ListTags)

	mcp.AddTool(s, &mcp.Tool{
		Name: "search_posts",
		Description: "全文检索自己的文章（含草稿），返回标题与命中上下文片段而非全文。" +
			"写作前查重、找可引用旧文时使用；需要全文时再用 get_post。需 posts:read 权限。",
	}, search.SearchPosts)

	mcp.AddTool(s, &mcp.Tool{
		Name: "search_formulas",
		Description: "按 LaTeX 源码片段检索自己文章中的数学/化学公式，返回公式所在文章、源码与展示模式。" +
			"找「哪篇文章用过某表达式」时使用。需 posts:read 权限。",
	}, search.SearchFormulas)

	mcp.AddTool(s, &mcp.Tool{
		Name: "search_code_blocks",
		Description: "按语言/内容检索自己文章中的代码块，可只看可运行块（runnable）。" +
			"写作时复用旧代码使用。需 posts:read 权限。",
	}, search.SearchCodeBlocks)

	// 书籍管理（#272）：书是文章的组织形态，挂本 server；owner=PAT 持有人
	mcp.AddTool(s, &mcp.Tool{
		Name:        "list_series",
		Description: "列出自己的系列书（含草稿）。需 posts:read 权限。",
	}, seriesTools.ListSeries)

	mcp.AddTool(s, &mcp.Tool{
		Name: "get_series",
		Description: "按 slug 读取自己的一本书：两层目录（卷/部/章），各章含文章 ID 与 slug——" +
			"attach_chapters 的协作入口。需 posts:read 权限。",
	}, seriesTools.GetSeries)

	mcp.AddTool(s, &mcp.Tool{
		Name:        "create_series",
		Description: "创建一本书（draft 起步）。需 posts:write 权限。连载文章发完后把同主题系列挂成书。",
	}, seriesTools.CreateSeries)

	mcp.AddTool(s, &mcp.Tool{
		Name: "attach_chapters",
		Description: "把文章批量挂入自己的书。post_ids 来自 list_drafts / search_posts 的结果；" +
			"已挂其他书的文章按 PAT 交互偏好处理（默认返回候选由你转述用户决策）。需 posts:write 权限。",
	}, seriesTools.AttachChapters)

	// polish_draft 编排 prompt：读草稿 + 注入风格 + 触发润色（PAT posts:read）
	s.AddPrompt(&mcp.Prompt{
		Name:        "polish_draft",
		Title:       "润色草稿",
		Description: "按本博客风格润色指定草稿。注入草稿全文+风格指南；仅可润色自己的草稿。需 posts:read 权限。",
		Arguments: []*mcp.PromptArgument{{
			Name:        "slug",
			Description: "要润色的草稿 slug",
			Required:    true,
		}},
	}, prompts.PolishDraft)

	return s
}

// NewScraperServer 构造抓取 MCP 服务器（/api/v1/mcp/scraper），注册 8 个抓取 tool。
// 高风险域：scrape_url 任意 URL 抓取（SSRF）+ 订阅抓取外部 feed。
// 与文章 server 分离以便独立限流/监控/回收（ADR-0007）。
func NewScraperServer(tools *ScraperTools) *mcp.Server {
	s := mcp.NewServer(ScraperServerMeta, nil)

	mcp.AddTool(s, &mcp.Tool{
		Name:        "scrape_url",
		Description: "抓取外站文章并返回结构化数据（标题/正文 Markdown+HTML/excerpt/canonical_url/cover/SEO）。需 posts:scrape 权限。返回数据供审阅后再调 create_post 建草稿。",
	}, tools.ScrapeURL)

	mcp.AddTool(s, &mcp.Tool{
		Name:        "create_subscription",
		Description: "创建 RSS 订阅源（feed URL + 抓取频率 + 转载标记）。需 subscriptions:write 权限。",
	}, tools.CreateSubscription)
	mcp.AddTool(s, &mcp.Tool{
		Name:        "list_subscriptions",
		Description: "列出当前用户的订阅源（含状态/失败计数/最近抓取）。需 subscriptions:read 权限。",
	}, tools.ListSubscriptions)
	mcp.AddTool(s, &mcp.Tool{
		Name:        "get_subscription",
		Description: "查单个订阅详情。需 subscriptions:read 权限。",
	}, tools.GetSubscription)
	mcp.AddTool(s, &mcp.Tool{
		Name:        "update_subscription",
		Description: "更新订阅配置（feed URL/频率/转载标记/标签）。需 subscriptions:write 权限。",
	}, tools.UpdateSubscription)
	mcp.AddTool(s, &mcp.Tool{
		Name:        "pause_subscription",
		Description: "手动暂停订阅（停止定时抓取）。需 subscriptions:write 权限。",
	}, tools.PauseSubscription)
	mcp.AddTool(s, &mcp.Tool{
		Name:        "resume_subscription",
		Description: "手动恢复订阅，清零失败计数回 active。需 subscriptions:write 权限。",
	}, tools.ResumeSubscription)
	mcp.AddTool(s, &mcp.Tool{
		Name:        "delete_subscription",
		Description: "删除订阅（连带其抓取记录）。需 subscriptions:write 权限。",
	}, tools.DeleteSubscription)

	return s
}

// NewPublicServer 构造公开只读 MCP 服务器（/api/v1/mcp/reader），注册 2 个 Resource。
// 匿名访问：不套 auth.RequireBearerToken（由 mcp_container 装配保证），
// 仅暴露已发布文章；草稿/公告/评论均不在此域。信任域与两个 PAT server 物理隔离
// （PRD-0007 / ADR-0008：匿名 vs 鉴权是新形态的信任域边界）。
//
// resources/list 不自动展开 ResourceTemplate 实例，故目录用独立静态 Resource。
func NewPublicServer(tools *PublicTools, prompts *PromptTools) *mcp.Server {
	s := mcp.NewServer(ReaderServerMeta, &mcp.ServerOptions{
		Instructions: readerInstructions,
	})

	// writing_style 写作风格指南（匿名静态，无参数）
	s.AddPrompt(&mcp.Prompt{
		Name:        "writing_style",
		Title:       "写作风格指南",
		Description: "本博客品牌写作风格指南（匿名可读）。写作前注入以保持文风一致。",
	}, prompts.WritingStyle)

	// 单篇已发布文章：blog://posts/{slug}
	s.AddResourceTemplate(&mcp.ResourceTemplate{
		Name:        "post",
		Title:       "已发布文章",
		Description: "按 slug 读取已发布文章的完整 Markdown 源码（含公式 LaTeX 与代码块）。仅已发布；读草稿用 violet server 的 get_post（需 PAT）。",
		MIMEType:    "text/markdown",
		URITemplate: "blog://posts/{slug}",
	}, tools.ReadPost)

	// 已发布文章目录：blog://posts（slug + 标题列表，供发现）
	s.AddResource(&mcp.Resource{
		Name:        "posts-index",
		Title:       "已发布文章目录",
		Description: "已发布文章目录（slug + 标题列表），用于发现可读文章。无需令牌。",
		MIMEType:    "text/markdown",
	}, tools.ListPosts)

	// 单本已发布书：blog://series/{slug}（完整目录树，各章链向 posts Resource）
	s.AddResourceTemplate(&mcp.ResourceTemplate{
		Name:        "series",
		Title:       "已发布系列书",
		Description: "按 slug 读取书的完整目录树（卷/部/章），各章带 slug 可经 blog://posts/{slug} 读正文。仅已发布的书。",
		MIMEType:    "text/markdown",
		URITemplate: "blog://series/{slug}",
	}, tools.ReadSeries)

	// 已发布书目录：blog://series（与 posts-index 同构，供发现）
	s.AddResource(&mcp.Resource{
		Name:        "series-index",
		Title:       "已发布系列书目录",
		Description: "已发布系列书目录（slug + 书名 + 章数），用于发现可读的书。无需令牌。",
		MIMEType:    "text/markdown",
	}, tools.ListSeries)

	return s
}

// NewCommentsServer 构造评论检索 MCP 服务器（/api/v1/mcp/comments），注册 3 个检索 tool。
// 评论与文章是独立 bounded context（AWS DDD MCP 实践：each server owns one domain），
// 故评论检索独立 server，不挂文章 server。PAT comments:read 私有视角，仅 approved。
func NewCommentsServer(tools *CommentTools) *mcp.Server {
	s := mcp.NewServer(CommentsServerMeta, &mcp.ServerOptions{
		Instructions: commentsInstructions,
	})

	mcp.AddTool(s, &mcp.Tool{
		Name: "search_comments",
		Description: "按关键词检索已审核评论/批注，返回正文 + 所属文章。" +
			"批注带锚点选区原文（读者划中的文字）。找「读者提过某类反馈」时使用。需 comments:read 权限。",
	}, tools.SearchComments)

	mcp.AddTool(s, &mcp.Tool{
		Name: "list_recent_comments",
		Description: "按时间倒序浏览最新已审核评论/批注（无关键词，看最近反馈动态）。" +
			"了解「最近读者有什么反馈」时使用。需 comments:read 权限。",
	}, tools.ListRecentComments)

	mcp.AddTool(s, &mcp.Tool{
		Name: "comment_stats",
		Description: "按文章聚合评论/批注统计，返回全局汇总 + 每篇文章批注密度。" +
			"判断「哪些文章反馈最密集、最该先改进」时使用。需 comments:read 权限。",
	}, tools.CommentStats)

	return s
}

// StreamableHandler 构造 streamable-HTTP handler，挂到 chi 路由上。
//
// 单实例 server 服务所有请求（PAT 鉴权由外层 auth.RequireBearerToken 中间件 +
// handler 内部的 scope 门禁共同完成，不依赖 per-request server）。
func StreamableHandler(s *mcp.Server) http.Handler {
	return mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return s }, nil)
}
