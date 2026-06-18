package app

import (
	"gorm.io/gorm"

	authcmd "blog-api/internal/application/auth/command"
	appaudit "blog-api/internal/application/audit"
	appuseradmin "blog-api/internal/application/useradmin"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	useradminhttp "blog-api/internal/interfaces/http/handler/useradmin"
)

// UserAdminContainer 用户管理模块容器
type UserAdminContainer struct {
	UserAdminHandler *useradminhttp.Handler
}

// NewUserAdminContainer 装配用户管理模块
func NewUserAdminContainer(db *gorm.DB, hasher authcmd.PasswordHasher, auditSvc *appaudit.Service) *UserAdminContainer {
	store := gormrepo.NewAdminUserStore(db)
	svc := appuseradmin.NewService(store, hasher, auditSvc)
	return &UserAdminContainer{UserAdminHandler: useradminhttp.NewHandler(svc)}
}
