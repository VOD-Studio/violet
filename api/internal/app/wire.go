//go:build wireinject
// +build wireinject

// Package app 提供应用层依赖注入装配（基于 google/wire）。
//
// P2.2d 装配 role/permission 模块的完整 DDD 依赖图，
// user 模块（P1）保留。旧代码（role/permission service/handler）仍在 main.go 手工装配，
// 待 P2.2d 路由切换完成后删除。
package app

import (
	"github.com/google/wire"
	"gorm.io/gorm"

	"blog-api/internal/application/permission/command"
	permquery "blog-api/internal/application/permission/query"
	rolecmd "blog-api/internal/application/role/command"
	rolequery "blog-api/internal/application/role/query"
	"blog-api/internal/application/shared"
	usercmd "blog-api/internal/application/user/command"
	"blog-api/internal/domain/permission"
	"blog-api/internal/domain/role"
	"blog-api/internal/domain/user"
	infraeventbus "blog-api/internal/infrastructure/eventbus"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	rolehttp "blog-api/internal/interfaces/http/handler/role"
	userhttp "blog-api/internal/interfaces/http/handler/user"
)

// ============================================================
// Provider Sets
// ============================================================

// InfrastructureSet 基础设施层
var InfrastructureSet = wire.NewSet(
	infraeventbus.NewInMemory,
	wire.Bind(new(shared.EventBus), new(*infraeventbus.InMemory)),

	usercmd.NewBcryptHasher,
	wire.Bind(new(usercmd.PasswordHasher), new(*usercmd.BcryptHasher)),
)

// UserDomainSet user 聚合 repository
var UserDomainSet = wire.NewSet(
	gormrepo.NewUserRepository,
	wire.Bind(new(user.UserRepository), new(*gormrepo.UserRepository)),
)

// RoleDomainSet role/permission 聚合 repository
var RoleDomainSet = wire.NewSet(
	gormrepo.NewRoleRepository,
	wire.Bind(new(role.RoleRepository), new(*gormrepo.RoleRepository)),
	gormrepo.NewPermissionRepository,
	wire.Bind(new(permission.PermissionRepository), new(*gormrepo.PermissionRepository)),
)

// UserApplicationSet
var UserApplicationSet = wire.NewSet(usercmd.NewRegisterUserHandler)

// RoleApplicationSet role/permission 用例层（CQRS）
var RoleApplicationSet = wire.NewSet(
	// role command
	rolecmd.NewCreateRoleHandler,
	rolecmd.NewUpdateRoleHandler,
	rolecmd.NewDeleteRoleHandler,
	rolecmd.NewReplaceRolePermissionsHandler,
	// role query
	rolequery.NewListRolesWithUserCountHandler,
	rolequery.NewGetRoleWithPermissionsHandler,
	// permission command
	command.NewCreatePermissionHandler,
	command.NewUpdatePermissionHandler,
	command.NewDeletePermissionHandler,
	// permission query
	permquery.NewListPermissionsHandler,
)

// UserInterfacesSet
var UserInterfacesSet = wire.NewSet(userhttp.NewHandler)

// RoleInterfacesSet role/permission HTTP handler
var RoleInterfacesSet = wire.NewSet(rolehttp.NewHandler)

// ============================================================
// 注入入口
// ============================================================

// UserContainer user 模块容器（P1，保留）
type UserContainer struct {
	RegisterHandler *usercmd.RegisterUserHandler
	UserHandler     *userhttp.Handler
}

// InitializeUserContainer 装配 user 模块
func InitializeUserContainer(db *gorm.DB) (*UserContainer, func(), error) {
	wire.Build(InfrastructureSet, UserDomainSet, UserApplicationSet, UserInterfacesSet, newUserContainer)
	return nil, nil, nil
}

func newUserContainer(registerHandler *usercmd.RegisterUserHandler, userHandler *userhttp.Handler) *UserContainer {
	return &UserContainer{RegisterHandler: registerHandler, UserHandler: userHandler}
}

// RoleContainer role/permission 模块容器（P2.2d）
type RoleContainer struct {
	RoleHandler *rolehttp.Handler
}

// InitializeRoleContainer 装配 role/permission 模块依赖图
func InitializeRoleContainer(db *gorm.DB) (*RoleContainer, func(), error) {
	wire.Build(
		InfrastructureSet,
		RoleDomainSet,
		RoleApplicationSet,
		RoleInterfacesSet,
		newRoleContainer,
	)
	return nil, nil, nil
}

func newRoleContainer(roleHandler *rolehttp.Handler) *RoleContainer {
	return &RoleContainer{RoleHandler: roleHandler}
}
