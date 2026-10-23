package app

import (
	"net/http"

	"gorm.io/gorm"

	appusage "blog-api/internal/application/omp_usage"
	domainapitoken "blog-api/internal/domain/api_token"
	inframcp "blog-api/internal/infrastructure/mcp"
	persist "blog-api/internal/infrastructure/persistence/gorm"
	usagehttp "blog-api/internal/interfaces/http/handler/omp_usage"
	"blog-api/internal/middleware"
)

type OMPUsageContainer struct {
	Handler *usagehttp.Handler
	PATAuth func(http.Handler) http.Handler
}

func NewOMPUsageContainer(db *gorm.DB, lookup domainapitoken.TokenLookup) *OMPUsageContainer {
	return &OMPUsageContainer{
		Handler: usagehttp.NewHandler(appusage.NewService(persist.NewOMPUsageRepository(db))),
		PATAuth: middleware.PATAuth(inframcp.NewPATVerifier(lookup)),
	}
}
