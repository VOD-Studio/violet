package app

import (
	"gorm.io/gorm"

	authcmd "blog-api/internal/application/auth/command"
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
// 审计由 issue #55（useradmin 聚合根事件接入）通过 EventBus 驱动，
// 不再手工注入 AuditLogger。
func NewUserAdminContainer(db *gorm.DB, hasher authcmd.PasswordHasher) *UserAdminContainer {
	store := gormrepo.NewAdminUserStore(db)
	svc := appuseradmin.NewService(store, hasher)
	return &UserAdminContainer{UserAdminHandler: useradminhttp.NewHandler(svc)}
}
