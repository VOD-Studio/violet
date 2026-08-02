// Package app 提供 role/permission 模块的手工 DI 装配。
//
// 此前 role 模块用 google/wire 装配（wire.go + wire_gen.go），但全仓仅此一处用 wire，
// 其余 20+ 模块全手工。为统一 DI 方式、消除 wire 孤岛，改回手工装配，删除 wire。
// 装配逻辑与原 wire_gen.go 生成的完全一致。
package app

import (
	"gorm.io/gorm"

	appperm "blog-api/internal/application/permission"
	permcmd "blog-api/internal/application/permission/command"
	permquery "blog-api/internal/application/permission/query"
	infraeventbus "blog-api/internal/infrastructure/eventbus"
	rolecmd "blog-api/internal/application/role/command"
	rolequery "blog-api/internal/application/role/query"
	role2 "blog-api/internal/domain/role"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	rolehttp "blog-api/internal/interfaces/http/handler/role"
)

// RoleContainer role/permission 模块容器
type RoleContainer struct {
	RoleHandler       *rolehttp.Handler
	PermissionChecker *appperm.Checker
}

// InitializeRoleContainer 手工装配 role/permission 模块依赖图。
// 返回 cleanup（当前无资源需释放，返回 no-op）以保持与旧 wire 签名兼容。
func InitializeRoleContainer(db *gorm.DB, bus *infraeventbus.InMemory) (*RoleContainer, func(), error) {
	roleRepo := gormrepo.NewRoleRepository(db)
	permRepo := gormrepo.NewPermissionRepository(db)

	// role CQRS handlers
	listRoles := rolequery.NewListRolesWithUserCountHandler(roleRepo)
	getRole := rolequery.NewGetRoleWithPermissionsHandler(roleRepo, permRepo)
	createRole := rolecmd.NewCreateRoleHandler(roleRepo, bus)
	updateRole := rolecmd.NewUpdateRoleHandler(roleRepo, bus)
	deleteRole := rolecmd.NewDeleteRoleHandler(roleRepo, bus)
	replaceRolePerms := rolecmd.NewReplaceRolePermissionsHandler(roleRepo, bus)

	// permission CQRS handlers
	listPerms := permquery.NewListPermissionsHandler(permRepo)
	createPerm := permcmd.NewCreatePermissionHandler(permRepo)
	updatePerm := permcmd.NewUpdatePermissionHandler(permRepo)
	deletePerm := permcmd.NewDeletePermissionHandler(permRepo)

	handler := rolehttp.NewHandler(
		listRoles, getRole, createRole, updateRole, deleteRole, replaceRolePerms,
		listPerms, createPerm, updatePerm, deletePerm,
	)

	// 权限检查器：构造 + 订阅角色权限变更事件（与 replaceRolePerms 共享同一 bus 实例）
	checker := NewPermissionCheckerWithSubscription(roleRepo, bus)

	return &RoleContainer{RoleHandler: handler, PermissionChecker: checker}, func() {}, nil
}

// 编译期断言：确保 role 域 repository 契约被 gorm 实现满足。
var _ role2.RoleRepository = (*gormrepo.RoleRepository)(nil)
