//go:build wireinject
// +build wireinject

// Package app 提供应用层依赖注入装配（基于 google/wire）。
package app

import (
	"github.com/google/wire"
	"gorm.io/gorm"

	appperm "blog-api/internal/application/permission"
	"blog-api/internal/application/permission/command"
	permquery "blog-api/internal/application/permission/query"
	rolecmd "blog-api/internal/application/role/command"
	rolequery "blog-api/internal/application/role/query"
	"blog-api/internal/application/shared"
	"blog-api/internal/domain/permission"
	"blog-api/internal/domain/role"
	infraeventbus "blog-api/internal/infrastructure/eventbus"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	rolehttp "blog-api/internal/interfaces/http/handler/role"
)

// InfrastructureSet 基础设施层
var InfrastructureSet = wire.NewSet(
	infraeventbus.NewInMemory,
	wire.Bind(new(shared.EventBus), new(*infraeventbus.InMemory)),
)

// RoleDomainSet role/permission 聚合 repository
var RoleDomainSet = wire.NewSet(
	gormrepo.NewRoleRepository,
	wire.Bind(new(role.RoleRepository), new(*gormrepo.RoleRepository)),
	gormrepo.NewPermissionRepository,
	wire.Bind(new(permission.PermissionRepository), new(*gormrepo.PermissionRepository)),
)

// RoleApplicationSet role/permission 用例层（CQRS）
var RoleApplicationSet = wire.NewSet(
	rolecmd.NewCreateRoleHandler,
	rolecmd.NewUpdateRoleHandler,
	rolecmd.NewDeleteRoleHandler,
	rolecmd.NewReplaceRolePermissionsHandler,
	rolequery.NewListRolesWithUserCountHandler,
	rolequery.NewGetRoleWithPermissionsHandler,
	command.NewCreatePermissionHandler,
	command.NewUpdatePermissionHandler,
	command.NewDeletePermissionHandler,
	permquery.NewListPermissionsHandler,
)

// RoleInterfacesSet role/permission HTTP handler
var RoleInterfacesSet = wire.NewSet(rolehttp.NewHandler)

// PermissionCheckerSet 运行时权限检查器装配
//
// NewPermissionCheckerWithSubscription 是 *appperm.Checker 的唯一 provider，
// 内部同时完成构造与事件订阅注册。它依赖 wire 单例 *InMemory——
// 该单例同时被 RoleApplicationSet 注入给 ReplaceRolePermissionsHandler，
// 因此订阅方与发布方共享同一总线实例，事件链在此闭合。
var PermissionCheckerSet = wire.NewSet(
	NewPermissionCheckerWithSubscription,
)

// RoleContainer role/permission 模块容器
type RoleContainer struct {
	RoleHandler       *rolehttp.Handler
	PermissionChecker *appperm.Checker
}

// InitializeRoleContainer 装配 role/permission 模块依赖图
func InitializeRoleContainer(db *gorm.DB) (*RoleContainer, func(), error) {
	wire.Build(
		InfrastructureSet,
		RoleDomainSet,
		RoleApplicationSet,
		RoleInterfacesSet,
		PermissionCheckerSet,
		newRoleContainer,
	)
	return nil, nil, nil
}

func newRoleContainer(roleHandler *rolehttp.Handler, checker *appperm.Checker) *RoleContainer {
	return &RoleContainer{RoleHandler: roleHandler, PermissionChecker: checker}
}
