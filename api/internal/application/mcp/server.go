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

// NewServer 构造 MCP 服务器并注册全部文章读写 tool。
//
// tools 提供具体 handler；AddTool 从参数结构体推导 JSON Schema。
func NewServer(tools *Tools) *mcp.Server {
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
		Name:        "scrape_url",
		Description: "抓取外站文章并返回结构化数据（标题/正文 Markdown+HTML/excerpt/canonical_url/cover/SEO）。需 posts:scrape 权限。返回数据供审阅后再调 create_post 建草稿。",
	}, tools.ScrapeURL)

	return s
}

// StreamableHandler 构造 streamable-HTTP handler，挂到 chi 路由上。
//
// 单实例 server 服务所有请求（PAT 鉴权由外层 auth.RequireBearerToken 中间件 +
// handler 内部的 scope 门禁共同完成，不依赖 per-request server）。
func StreamableHandler(s *mcp.Server) http.Handler {
	return mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return s }, nil)
}
