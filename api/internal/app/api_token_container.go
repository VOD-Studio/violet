package app

import (
	"gorm.io/gorm"

	appapitoken "blog-api/internal/application/api_token"
	domainapitoken "blog-api/internal/domain/api_token"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	apitokenhttp "blog-api/internal/interfaces/http/handler/api_token"
)

// APITokenContainer PAT 模块容器。
//
// TokenLookup 供 main.go 挂载 TokenAuth 中间件（MCP 路由用）。
type APITokenContainer struct {
	APITokenHandler *apitokenhttp.Handler
	TokenLookup     domainapitoken.TokenLookup
}

// NewAPITokenContainer 装配 PAT 模块（领域 + 应用 + 接口 + 中间件依赖）。
func NewAPITokenContainer(db *gorm.DB) *APITokenContainer {
	repo := gormrepo.NewAPITokenRepository(db)
	svc := appapitoken.NewService(repo)
	return &APITokenContainer{
		APITokenHandler: apitokenhttp.NewHandler(svc),
		TokenLookup:     repo,
	}
}
