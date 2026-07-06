// Package service 提供跨领域的应用服务实现。
package service

import (
	"context"
	"sync"
	"time"

	"github.com/rs/zerolog/log"

	domainrole "blog-api/internal/domain/role"
)

// PermissionService 权限检查服务
//
// 实现 middleware.PermissionChecker 接口，供 RequirePermission 中间件使用。
//
// 设计要点：
//   - superadmin 通配放行（拥有所有权限，新增权限自动拥有，无需手动分配）
//   - 其他角色按 role_permissions 表查询，结果缓存在内存（角色权限变更不频繁）
//   - 缓存带 TTL（默认 5 分钟），过期后下次查询重新加载；变更角色权限后可调 Refresh 强制刷新
type PermissionService struct {
	roleRepo domainrole.RoleRepository
	ttl      time.Duration

	mu       sync.RWMutex
	cache    map[string]map[string]struct{} // role名 → 权限码集合
	loadedAt time.Time
}

// NewPermissionService 创建权限检查服务
//
// ttl 为缓存有效期，传 0 表示用默认 5 分钟。
func NewPermissionService(roleRepo domainrole.RoleRepository, ttl time.Duration) *PermissionService {
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	return &PermissionService{
		roleRepo: roleRepo,
		ttl:      ttl,
	}
}

// HasPermission 判断角色是否拥有所有指定权限码
//
// 内置超管（isBuiltinSuperAdmin=true）通配放行：拥有所有权限，新增权限自动拥有，无需手动分配。
// 其他角色（含被委派超管）查缓存（过期则重新加载全部角色权限）。
// 任一权限码缺失即返回 false。
func (s *PermissionService) HasPermission(role string, isBuiltinSuperAdmin bool, codes ...string) bool {
	// 内置超级管理员通配：拥有所有权限
	if isBuiltinSuperAdmin {
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
func (s *PermissionService) Refresh() {
	s.mu.Lock()
	s.cache = nil
	s.loadedAt = time.Time{}
	s.mu.Unlock()
}

// load 获取指定角色的权限码集合（带 TTL 缓存）
//
// 缓存未命中或过期时全量重新加载所有角色权限（一次性查询，避免每角色查库）。
func (s *PermissionService) load(role string) (map[string]struct{}, bool) {
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
func (s *PermissionService) reload(ctx context.Context) error {
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
