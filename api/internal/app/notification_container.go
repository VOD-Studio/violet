package app

import (
	"gorm.io/gorm"

	domainnotification "blog-api/internal/domain/notification"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
)

// NotificationContainer 通知模块容器。
//
// N1 只建基础层：仓储 + 领域模型。subscriber（N2）和 SSE 推送（N3）
// 在后续 issue 接入，届时扩展容器持有的依赖。
type NotificationContainer struct {
	NotificationRepository domainnotification.NotificationRepository
}

// NewNotificationContainer 装配通知模块基础层（领域 + 仓储）。
func NewNotificationContainer(db *gorm.DB) *NotificationContainer {
	return &NotificationContainer{
		NotificationRepository: gormrepo.NewNotificationRepository(db),
	}
}
