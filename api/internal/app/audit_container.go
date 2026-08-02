package app

import (
	"gorm.io/gorm"

	appaudit "blog-api/internal/application/audit"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	audithttp "blog-api/internal/interfaces/http/handler/audit"
)

// AuditContainer 操作日志模块容器（读侧：订阅者写入，Query 读取）
type AuditContainer struct {
	AuditHandler *audithttp.Handler
}

// NewAuditContainer 装配操作日志模块
func NewAuditContainer(db *gorm.DB) *AuditContainer {
	store := gormrepo.NewEventStore(db)
	query := appaudit.NewQuery(store)
	return &AuditContainer{
		AuditHandler: audithttp.NewHandler(query),
	}
}
