// Package app 提供 DDD 装配。本文件定义 permission checker 的 wire provider
// 与事件订阅注册，使运行时检查面与管理面共享同一事件总线单例。
package app

import (
	"context"

	"github.com/rs/zerolog/log"

	appperm "blog-api/internal/application/permission"
	appshared "blog-api/internal/application/shared"
	infraeventbus "blog-api/internal/infrastructure/eventbus"

	domainrole "blog-api/internal/domain/role"
	"blog-api/internal/domain/shared"
)

// eventRolePermissionsChanged 角色权限变更事件名，与 domain/role 的 NewRolePermissionsChanged 一致。
const eventRolePermissionsChanged = "role.permissions_changed"

// NewPermissionCheckerWithSubscription 构造 ttl=5min 的权限检查器，
// 并在总线上注册其对角色权限变更事件的订阅（改权限 → 立即清缓存，
// 同时吊销全部短时运维授权：授权签发时依据的权限集可能已不成立）。
func NewPermissionCheckerWithSubscription(roleRepo domainrole.RoleRepository, bus *infraeventbus.InMemory, grants appshared.OpsGrantStore) *appperm.Checker {
	checker := appperm.NewChecker(roleRepo, 0)
	bus.Subscribe(eventRolePermissionsChanged, checker.HandleRolePermissionsChanged)
	bus.Subscribe(eventRolePermissionsChanged, func(context.Context, shared.DomainEvent) error {
		if err := grants.RevokeAll(context.Background()); err != nil {
			log.Warn().Err(err).Msg("角色权限变更后吊销运维授权失败")
		}
		return nil
	})
	return checker
}
