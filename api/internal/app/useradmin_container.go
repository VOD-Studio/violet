package app

import (
	"gorm.io/gorm"

	authcmd "blog-api/internal/application/auth/command"
	appshared "blog-api/internal/application/shared"
	appuseradmin "blog-api/internal/application/useradmin"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	useradminhttp "blog-api/internal/interfaces/http/handler/useradmin"
)

// UserAdminContainer 用户管理模块容器
type UserAdminContainer struct {
	UserAdminHandler *useradminhttp.Handler
}

// NewUserAdminContainer 装配用户管理模块
//
// 审计由领域事件驱动（聚合根 RecordEvent → 应用层 Publish），
// 不再手工注入 AuditLogger。
func NewUserAdminContainer(db *gorm.DB, hasher authcmd.PasswordHasher, bus appshared.EventBus) *UserAdminContainer {
	store := gormrepo.NewAdminUserStore(db)
	svc := appuseradmin.NewService(store, hasher, bus)
	return &UserAdminContainer{UserAdminHandler: useradminhttp.NewHandler(svc)}
}
