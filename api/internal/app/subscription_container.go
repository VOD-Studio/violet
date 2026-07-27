package app

import (
	"gorm.io/gorm"

	appsub "blog-api/internal/application/subscription"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
)

// SubscriptionContainer 订阅模块容器。
//
// SubscriptionService 供 MCP 模块的订阅 tool 复用。
// 后台 HTTP handler 留待 T9（前端管理页）接入。
type SubscriptionContainer struct {
	SubscriptionService *appsub.Service
}

// NewSubscriptionContainer 装配订阅模块（领域 + 应用）。now 传 nil 用 time.Now。
func NewSubscriptionContainer(db *gorm.DB) *SubscriptionContainer {
	repo := gormrepo.NewSubscriptionRepository(db)
	svc := appsub.NewService(repo, nil)
	return &SubscriptionContainer{SubscriptionService: svc}
}
