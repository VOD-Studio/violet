// Package permission 提供权限聚合的用例层（CRUD 管理面 + 运行时检查面）。
//
// 本文件承载运行时检查面：Checker 在请求路径上判断「某角色是否拥有指定权限码」，
// 供 middleware.PermissionChecker / post.PostPermissionChecker 两个消费方端口使用。
package permission

import (
	"context"
	"sync"
	"time"

	"github.com/rs/zerolog/log"

	domainrole "blog-api/internal/domain/role"
	domainshared "blog-api/internal/domain/shared"
)

// Checker 运行时权限检查器
//
// 实现 middleware.PermissionChecker 接口，供 RequirePermission 中间件使用。
//
// 设计要点：
//   - superadmin 通配放行（拥有所有权限，新增权限自动拥有，无需手动分配）
//   - 其他角色按 role_permissions 表查询，结果缓存在内存（角色权限变更不频繁）
//   - 缓存带 TTL（默认 5 分钟），过期后下次查询重新加载；变更角色权限后可调 Refresh 强制刷新
type Checker struct {
	roleRepo domainrole.RoleRepository
	ttl      time.Duration

	mu       sync.RWMutex
	cache    map[string]map[string]struct{} // role名 → 权限码集合
	loadedAt time.Time
}

// NewChecker 创建权限检查器
//
// ttl 为缓存有效期，传 0 表示用默认 5 分钟。
func NewChecker(roleRepo domainrole.RoleRepository, ttl time.Duration) *Checker {
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	return &Checker{
		roleRepo: roleRepo,
		ttl:      ttl,
	}
}

// HasPermission 判断角色是否拥有所有指定权限码。
//
// root 用户与 superadmin 角色通配放行，新增权限点自动拥有。
// 其他角色查缓存，任一权限码缺失即返回 false。
func (s *Checker) HasPermission(role string, isBuiltinSuperAdmin bool, codes ...string) bool {
	// root 用户与 superadmin 角色通配：拥有所有权限
	if isBuiltinSuperAdmin || role == domainrole.SuperadminRole {
		return true
	}
	// 无权限码要求视为通过（仅做角色层校验的场景）
	if len(codes) == 0 {
		return true
	}

	perms, ok := s.load(role)
	if !ok {
		return false // 角色不存在或加载失败
	}
	for _, code := range codes {
		if _, has := perms[code]; !has {
			return false
		}
	}
	return true
}

// Refresh 强制清空缓存，下次查询重新加载
//
// 在角色权限变更后调用，确保新权限立即生效（内置超管靠标志位短路，不受影响）。
func (s *Checker) Refresh() {
	s.mu.Lock()
	s.cache = nil
	s.loadedAt = time.Time{}
	s.mu.Unlock()
}

// HandleRolePermissionsChanged 处理「角色权限已变更」事件
//
// 作为 eventbus.Handler 注册到总线，事件名 "role.permissions_changed"。
// 角色权限变更后立即清缓存，使新权限在下一次请求即时生效（而非等 TTL 过期）。
// 不关心事件 payload——任何角色权限变更都使全量缓存失效，下次查询重新加载。
func (s *Checker) HandleRolePermissionsChanged(_ context.Context, _ domainshared.DomainEvent) error {
	s.Refresh()
	return nil
}

// load 获取指定角色的权限码集合（带 TTL 缓存）
//
// 缓存未命中或过期时全量重新加载所有角色权限（一次性查询，避免每角色查库）。
func (s *Checker) load(role string) (map[string]struct{}, bool) {
	// 快路径：读缓存
	s.mu.RLock()
	if s.cache != nil && time.Since(s.loadedAt) < s.ttl {
		perms, ok := s.cache[role]
		s.mu.RUnlock()
		return perms, ok
	}
	s.mu.RUnlock()

	// 慢路径：重新加载（加写锁后 double-check）
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.cache != nil && time.Since(s.loadedAt) < s.ttl {
		perms, ok := s.cache[role]
		return perms, ok
	}

	if err := s.reload(context.Background()); err != nil {
		log.Error().Err(err).Msg("权限缓存加载失败")
		// 加载失败时返回旧缓存（若有），否则该角色判定为无权限
		if s.cache != nil {
			perms, ok := s.cache[role]
			return perms, ok
		}
		return nil, false
	}

	perms, ok := s.cache[role]
	return perms, ok
}

// reload 全量加载所有角色及其权限码到缓存
func (s *Checker) reload(ctx context.Context) error {
	roles, err := s.roleRepo.FindAll(ctx)
	if err != nil {
		return err
	}
	cache := make(map[string]map[string]struct{}, len(roles))
	for _, r := range roles {
		perms := make(map[string]struct{})
		for _, code := range r.PermissionCodes() {
			perms[code] = struct{}{}
		}
		cache[r.Name().String()] = perms
	}
	s.cache = cache
	s.loadedAt = time.Now()
	return nil
}
