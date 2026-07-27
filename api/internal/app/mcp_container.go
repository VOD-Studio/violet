package app

import (
	"net/http"

	mcpauth "github.com/modelcontextprotocol/go-sdk/auth"

	appmcp "blog-api/internal/application/mcp"
	domainapitoken "blog-api/internal/domain/api_token"
	apppost "blog-api/internal/application/post"
	inframcp "blog-api/internal/infrastructure/mcp"
)

// MCPContainer MCP 服务器容器。
//
// Handler 是已用 auth.RequireBearerToken 包装的 streamable-HTTP handler，
// 供 main.go 直接挂到 /api/v1/mcp（外层再叠加限流）。
type MCPContainer struct {
	Handler http.Handler
}

// NewMCPContainer 装配 MCP 服务器。
//
// tokenLookup 来自 PAT 模块（apiTokenContainer.TokenLookup），
// postSvc 来自文章模块（postContainer.PostService）。
func NewMCPContainer(tokenLookup domainapitoken.TokenLookup, postSvc *apppost.Service) *MCPContainer {
	verifier := inframcp.NewPATVerifier(tokenLookup)
	robots := inframcp.NewRobotsChecker()
	tools := appmcp.NewTools(postSvc, robots)
	server := appmcp.NewServer(tools)
	handler := mcpauth.RequireBearerToken(verifier.Verify, nil)(appmcp.StreamableHandler(server))
	return &MCPContainer{Handler: handler}
}
