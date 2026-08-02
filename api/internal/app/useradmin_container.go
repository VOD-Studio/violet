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

func NewUserAdminContainer(db *gorm.DB, hasher authcmd.PasswordHasher, bus appshared.EventBus) *UserAdminContainer {
	store := gormrepo.NewAdminUserStore(db)
	svc := appuseradmin.NewService(store, hasher, bus)
	return &UserAdminContainer{UserAdminHandler: useradminhttp.NewHandler(svc)}
}
