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

// NewPermissionCheckerWithSubscription 构造默认 ttl（5min）的权限检查器，
// 并在总线上注册其对角色权限变更事件的订阅。
//
// 合并构造与订阅注册为单一 provider，避免 wire 图中出现同一类型的多个 binding。
// ttl 在装配期固定为 5 分钟（与历史实现一致）——wire 无法自动注入 time.Duration，
// 故不暴露为参数。
//
// wire 单例保证此处的 bus 与 ReplaceRolePermissionsHandler 发布事件所用的 bus 是同一实例，
// 从而接通「改角色权限 → 立即清缓存」的事件链（此前该链断裂，变更最长 5 分钟才生效）。
func NewPermissionCheckerWithSubscription(roleRepo domainrole.RoleRepository, bus *infraeventbus.InMemory) *appperm.Checker {
	checker := appperm.NewChecker(roleRepo, 0)
	bus.Subscribe(eventRolePermissionsChanged, checker.HandleRolePermissionsChanged)
	return checker
}
