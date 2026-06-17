package app

import (
	"gorm.io/gorm"

	appaudit "blog-api/internal/application/audit"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	audithttp "blog-api/internal/interfaces/http/handler/audit"
)

// AuditContainer 操作日志模块容器
type AuditContainer struct {
	AuditHandler *audithttp.Handler
	Service      *appaudit.Service
}

// NewAuditContainer 装配操作日志模块
func NewAuditContainer(db *gorm.DB) *AuditContainer {
	store := gormrepo.NewAuditStore(db)
	svc := appaudit.NewService(store)
	return &AuditContainer{
		AuditHandler: audithttp.NewHandler(svc),
		Service:      svc,
	}
}
