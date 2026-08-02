// Package app 提供 DDD 装配。本文件定义 permission checker 的 wire provider
// 与事件订阅注册，使运行时检查面与管理面共享同一事件总线单例。
package app

import (
	appperm "blog-api/internal/application/permission"
	infraeventbus "blog-api/internal/infrastructure/eventbus"

	domainrole "blog-api/internal/domain/role"
)

// eventRolePermissionsChanged 角色权限变更事件名，与 domain/role 的 NewRolePermissionsChanged 一致。
const eventRolePermissionsChanged = "role.permissions_changed"

// NewPermissionCheckerWithSubscription 构造 ttl=5min 的权限检查器，
// 并在总线上注册其对角色权限变更事件的订阅（改权限 → 立即清缓存）。
func NewPermissionCheckerWithSubscription(roleRepo domainrole.RoleRepository, bus *infraeventbus.InMemory) *appperm.Checker {
	checker := appperm.NewChecker(roleRepo, 0)
	bus.Subscribe(eventRolePermissionsChanged, checker.HandleRolePermissionsChanged)
	return checker
}
