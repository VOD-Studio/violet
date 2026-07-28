package app

import (
	"net/http"

	mcpauth "github.com/modelcontextprotocol/go-sdk/auth"

	appmcp "blog-api/internal/application/mcp"
	domainapitoken "blog-api/internal/domain/api_token"
	apppost "blog-api/internal/application/post"
	appsub "blog-api/internal/application/subscription"
	inframcp "blog-api/internal/infrastructure/mcp"
)

// MCPContainer MCP 服务器容器（ADR-0007：文章 + 抓取两个独立 server）。
//
// PostHandler 挂 /api/v1/mcp（文章 CRUD，低风险），
// ScraperHandler 挂 /api/v1/mcp/scraper（抓取 + 订阅，高风险，可独立限流）。
// 两个 handler 都用 auth.RequireBearerToken 包裹 PAT 鉴权。
type MCPContainer struct {
	PostHandler    http.Handler
	ScraperHandler http.Handler
}

// NewMCPContainer 装配两个 MCP 服务器。
//
// tokenLookup 来自 PAT 模块（apiTokenContainer.TokenLookup），
// postSvc 来自文章模块，subSvc 来自订阅模块。
func NewMCPContainer(tokenLookup domainapitoken.TokenLookup, postSvc *apppost.Service, subSvc *appsub.Service) *MCPContainer {
	verifier := inframcp.NewPATVerifier(tokenLookup)
	robots := inframcp.NewRobotsChecker()

	// 文章 server（5 个 post CRUD tool）
	postTools := appmcp.NewPostTools(postSvc)
	postServer := appmcp.NewPostServer(postTools)
	// 抓取 server（scrape_url + 7 个 subscription tool）
	scraperTools := appmcp.NewScraperTools(postSvc, robots, subSvc)
	scraperServer := appmcp.NewScraperServer(scraperTools)

	auth := mcpauth.RequireBearerToken(verifier.Verify, nil)
	return &MCPContainer{
		PostHandler:    auth(appmcp.StreamableHandler(postServer)),
		ScraperHandler: auth(appmcp.StreamableHandler(scraperServer)),
	}
}
