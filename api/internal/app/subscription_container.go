package app

import (
	"gorm.io/gorm"

	apppost "blog-api/internal/application/post"
	appsub "blog-api/internal/application/subscription"
	infrafeed "blog-api/internal/infrastructure/feed"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
)

// SubscriptionContainer 订阅模块容器。
//
// SubscriptionService 供 MCP 模块的订阅 tool 复用；FetchOne 依赖（PostImporter + FeedParser）
// 在 NewSubscriptionContainer 里通过 SetFetchDeps 注入，依赖 post 模块的 Service。
type SubscriptionContainer struct {
	SubscriptionService *appsub.Service
}

// NewSubscriptionContainer 装配订阅模块（领域 + 应用 + 抓取依赖）。
// postSvc 供 FetchOne 抓正文建草稿（实现 PostImporter 端口）。可为 nil（仅 CRUD 场景）。
func NewSubscriptionContainer(db *gorm.DB, postSvc *apppost.Service) *SubscriptionContainer {
	subRepo := gormrepo.NewSubscriptionRepository(db)
	entryRepo := gormrepo.NewSubscriptionEntryRepository(db)
	svc := appsub.NewService(subRepo, nil)
	// 注入 FetchOne 依赖：post.Service 满足 PostImporter 端口（结构化类型）
	if postSvc != nil {
		svc.SetFetchDeps(entryRepo, postSvc, infrafeed.NewGoFeedParser())
	}
	return &SubscriptionContainer{SubscriptionService: svc}
}
