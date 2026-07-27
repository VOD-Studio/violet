package mcp

import (
	"net/http"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// ServerMeta 服务器实现元信息（MCP initialize 响应里的 name/version）。
var ServerMeta = &mcp.Implementation{
	Name:    "mimo-blog",
	Version: "1.0.0",
}

// ScraperServerMeta 抓取 server 元信息（与文章 server 区分，便于客户端识别）。
var ScraperServerMeta = &mcp.Implementation{
	Name:    "mimo-blog-scraper",
	Version: "1.0.0",
}

// NewPostServer 构造文章 MCP 服务器（/api/v1/mcp），注册 5 个文章 CRUD tool。
// 低风险域：只写自己的草稿/发布自己的文章，无 SSRF。
// tools 提供具体 handler；AddTool 从参数结构体推导 JSON Schema。
func NewPostServer(tools *PostTools) *mcp.Server {
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

// StreamableHandler 构造 streamable-HTTP handler，挂到 chi 路由上。
//
// 单实例 server 服务所有请求（PAT 鉴权由外层 auth.RequireBearerToken 中间件 +
// handler 内部的 scope 门禁共同完成，不依赖 per-request server）。
func StreamableHandler(s *mcp.Server) http.Handler {
	return mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return s }, nil)
}
