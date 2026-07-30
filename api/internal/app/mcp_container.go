package app

import (
	"net/http"

	mcpauth "github.com/modelcontextprotocol/go-sdk/auth"

	appmcp "blog-api/internal/application/mcp"
	apppost "blog-api/internal/application/post"
	appcomment "blog-api/internal/application/comment"
	appsub "blog-api/internal/application/subscription"
	domainapitoken "blog-api/internal/domain/api_token"
	inframcp "blog-api/internal/infrastructure/mcp"
)

// MCPContainer MCP 服务器容器（ADR-0007 + ADR-0008 + PRD-0008：四个独立 server）。
//
// PostHandler 挂 /api/v1/mcp（文章 CRUD + 检索，PAT 鉴权，低风险），
// ScraperHandler 挂 /api/v1/mcp/scraper（抓取 + 订阅，PAT 鉴权，高风险，可独立限流），
// PublicHandler 挂 /api/v1/mcp/reader（匿名只读已发布文章，不套 PAT 鉴权），
// CommentsHandler 挂 /api/v1/mcp/comments（评论检索，PAT comments:read，评论独立 bounded context）。
// 三个 PAT handler 用 auth.RequireBearerToken 包裹；PublicHandler 裸 handler（匿名）。
type MCPContainer struct {
	PostHandler     http.Handler
	ScraperHandler  http.Handler
	PublicHandler   http.Handler
	CommentsHandler http.Handler
}

// NewMCPContainer 装配三个 MCP 服务器。
//
// tokenLookup 来自 PAT 模块（apiTokenContainer.TokenLookup），
// postSvc/subSvc/commentSvc 来自各域模块。
func NewMCPContainer(tokenLookup domainapitoken.TokenLookup, postSvc *apppost.Service, subSvc *appsub.Service, commentSvc *appcomment.Service) *MCPContainer {
	verifier := inframcp.NewPATVerifier(tokenLookup)
	robots := inframcp.NewRobotsChecker()

	// 文章 server（5 个 post CRUD tool + 3 个检索 tool + 1 个编排 prompt）
	postTools := appmcp.NewPostTools(postSvc)
	searchTools := appmcp.NewSearchTools(postSvc)
	promptTools := appmcp.NewPromptTools(postSvc)
	postServer := appmcp.NewPostServer(postTools, searchTools, promptTools)
	// 抓取 server（scrape_url + 7 个 subscription tool）
	scraperTools := appmcp.NewScraperTools(postSvc, robots, subSvc)
	scraperServer := appmcp.NewScraperServer(scraperTools)
	// 公开只读 server（2 个 Resource + 1 个匿名 prompt，仅已发布文章）
	publicTools := appmcp.NewPublicTools(postSvc)
	publicServer := appmcp.NewPublicServer(publicTools, promptTools)
	// 评论检索 server（3 个 tool，评论独立 bounded context）
	commentTools := appmcp.NewCommentTools(commentSvc)
	commentsServer := appmcp.NewCommentsServer(commentTools)

	auth := mcpauth.RequireBearerToken(verifier.Verify, nil)
	return &MCPContainer{
		PostHandler:     auth(appmcp.StreamableHandler(postServer)),
		ScraperHandler:  auth(appmcp.StreamableHandler(scraperServer)),
		// PublicHandler 不套 auth：匿名端点就是匿名，不伪装（PRD-0007 鉴权装配）。
		PublicHandler:   appmcp.StreamableHandler(publicServer),
		CommentsHandler: auth(appmcp.StreamableHandler(commentsServer)),
	}
}
