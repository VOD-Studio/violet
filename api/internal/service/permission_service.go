// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"context"
	"database/sql"
	"errors"
	"regexp"
	"sync"
	"time"

	"github.com/rs/zerolog/log"

	"blog-api/internal/repository/generated"
)

// 权限代码格式正则表达式：module:action
var permissionCodeRegex = regexp.MustCompile(`^[a-z]+:[a-z]+$`)

// 缓存刷新重试次数
const cacheReloadMaxRetries = 3
const cacheReloadRetryDelay = 100 * time.Millisecond

// 权限管理相关错误定义
var (
	// ErrPermissionNotFound 权限不存在
	ErrPermissionNotFound = errors.New("权限不存在")
	// ErrPermissionCodeExists 权限代码已存在
	ErrPermissionCodeExists = errors.New("权限代码已存在")
	// ErrPermissionInUse 权限正在被角色使用
	ErrPermissionInUse = errors.New("权限正在被角色使用，无法删除")
	// ErrInvalidPermissionCode 权限代码格式无效
	ErrInvalidPermissionCode = errors.New("权限代码格式无效，必须是 module:action 格式（如 post:create）")
	// ErrPermissionCodeTooLong 权限代码过长
	ErrPermissionCodeTooLong = errors.New("权限代码长度不能超过 50 字符")
)

// PermissionService 权限服务
// 启动时加载所有角色-权限映射到内存，提供快速权限查询
type PermissionService struct {
	queries *generated.Queries
	mu      sync.RWMutex
	// rolePermissions 角色 ID -> 权限代码列表
	rolePermissions map[int32][]string
	// allPermissions 所有权限代码 -> 名称
	allPermissions map[string]string
}

// NewPermissionService 创建权限服务实例并加载缓存
func NewPermissionService(queries *generated.Queries) *PermissionService {
	s := &PermissionService{
		queries:        queries,
		rolePermissions: make(map[int32][]string),
		allPermissions: make(map[string]string),
	}
	if err := s.Reload(context.Background()); err != nil {
		log.Printf("权限缓存加载失败: %v（将在首次请求时重试）", err)
	}
	return s
}

// Reload 从数据库重新加载权限缓存
func (s *PermissionService) Reload(ctx context.Context) error {
	log.Info().Str("service", "PermissionService").Str("operation", "Reload").Msg("开始重新加载权限缓存")

	log.Debug().Str("query", "ListRolePermissions").Msg("查询角色权限关联")
	rolePerms, err := s.queries.ListRolePermissions(ctx)
	if err != nil {
		log.Error().Err(err).Msg("查询角色权限关联失败")
		return err
	}

	log.Debug().Str("query", "ListPermissions").Msg("查询所有权限")
	perms, err := s.queries.ListPermissions(ctx)
	if err != nil {
		log.Error().Err(err).Msg("查询所有权限失败")
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	newRolePermissions := make(map[int32][]string)
	for _, rp := range rolePerms {
		newRolePermissions[rp.RoleID] = append(newRolePermissions[rp.RoleID], rp.PermissionCode)
	}

	newAllPermissions := make(map[string]string)
	for _, p := range perms {
		newAllPermissions[p.Code] = p.Name
	}

	s.rolePermissions = newRolePermissions
	s.allPermissions = newAllPermissions

	log.Info().Int("permissions", len(perms)).Int("role_mappings", len(rolePerms)).Msg("权限缓存加载成功")
	return nil
}

// ReloadWithRetry 从数据库重新加载权限缓存（带重试机制）
func (s *PermissionService) ReloadWithRetry(ctx context.Context) error {
	var lastErr error
	for i := 0; i < cacheReloadMaxRetries; i++ {
		err := s.Reload(ctx)
		if err == nil {
			return nil
		}
		lastErr = err
		log.Warn().Err(err).Int("attempt", i+1).Msg("缓存刷新失败，准备重试")
		time.Sleep(cacheReloadRetryDelay)
	}
	log.Error().Err(lastErr).Msg("缓存刷新多次重试后仍失败")
	return lastErr
}

// HasPermission 检查角色是否拥有指定权限
// superadmin 角色直接返回 true
func (s *PermissionService) HasPermission(roleName string, roleID *int32, codes ...string) bool {
	log.Debug().Str("service", "PermissionService").Str("operation", "HasPermission").
		Str("role_name", roleName).Strs("codes", codes).Msg("检查权限")

	if roleName == "superadmin" {
		log.Debug().Str("role_name", roleName).Msg("超级管理员，直接通过")
		return true
	}

	if roleID == nil {
		log.Debug().Msg("角色ID为空，权限检查失败")
		return false
	}

	s.mu.RLock()
	perms, ok := s.rolePermissions[*roleID]
	s.mu.RUnlock()

	if !ok {
		log.Debug().Int32("role_id", *roleID).Msg("角色无权限配置")
		return false
	}

	permSet := make(map[string]bool, len(perms))
	for _, p := range perms {
		permSet[p] = true
	}

	for _, code := range codes {
		if permSet[code] {
			log.Debug().Str("code", code).Msg("权限检查通过")
			return true
		}
	}
	log.Debug().Strs("codes", codes).Msg("权限检查失败")
	return false
}

// GetPermissionsByRoleID 获取角色的所有权限代码
func (s *PermissionService) GetPermissionsByRoleID(roleID int32) []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	perms, ok := s.rolePermissions[roleID]
	if !ok {
		return nil
	}
	result := make([]string, len(perms))
	copy(result, perms)
	return result
}

// GetAllPermissions 获取所有权限定义
func (s *PermissionService) GetAllPermissions() map[string]string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make(map[string]string, len(s.allPermissions))
	for k, v := range s.allPermissions {
		result[k] = v
	}
	return result
}

// CreatePermission 创建新权限
func (s *PermissionService) CreatePermission(ctx context.Context, code, name string) (*generated.Permission, error) {
	log.Info().Str("service", "PermissionService").Str("operation", "CreatePermission").
		Str("code", code).Str("name", name).Msg("开始创建权限")

	// 验证权限代码格式
	if len(code) > 50 {
		log.Warn().Str("code", code).Int("length", len(code)).Msg("权限代码过长")
		return nil, ErrPermissionCodeTooLong
	}
	if !permissionCodeRegex.MatchString(code) {
		log.Warn().Str("code", code).Msg("权限代码格式无效")
		return nil, ErrInvalidPermissionCode
	}

	// 检查权限代码是否已存在
	_, err := s.queries.GetPermissionByCode(ctx, code)
	if err == nil {
		log.Warn().Str("code", code).Msg("权限代码已存在")
		return nil, ErrPermissionCodeExists
	}
	if !errors.Is(err, sql.ErrNoRows) {
		log.Error().Err(err).Msg("检查权限代码失败")
		return nil, err
	}

	// 创建权限
	perm, err := s.queries.CreatePermission(ctx, generated.CreatePermissionParams{
		Code:        code,
		Name:        name,
		Description: sql.NullString{},
	})
	if err != nil {
		log.Error().Err(err).Msg("创建权限失败")
		return nil, err
	}

	// 重新加载缓存（带重试）
	if err := s.ReloadWithRetry(ctx); err != nil {
		log.Error().Err(err).Msg("重新加载权限缓存失败")
	}

	log.Info().Int32("permission_id", perm.ID).Str("code", code).Msg("权限创建成功")
	return perm, nil
}

// UpdatePermission 更新权限名称
func (s *PermissionService) UpdatePermission(ctx context.Context, code, name string) (*generated.Permission, error) {
	log.Info().Str("service", "PermissionService").Str("operation", "UpdatePermission").
		Str("code", code).Str("name", name).Msg("开始更新权限")

	// 检查权限是否存在
	_, err := s.queries.GetPermissionByCode(ctx, code)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Warn().Str("code", code).Msg("权限不存在")
			return nil, ErrPermissionNotFound
		}
		log.Error().Err(err).Msg("查询权限失败")
		return nil, err
	}

	// 更新权限
	perm, err := s.queries.UpdatePermission(ctx, generated.UpdatePermissionParams{
		Code:        code,
		Name:        name,
		Description: sql.NullString{},
	})
	if err != nil {
		log.Error().Err(err).Msg("更新权限失败")
		return nil, err
	}

	// 重新加载缓存（带重试）
	if err := s.ReloadWithRetry(ctx); err != nil {
		log.Error().Err(err).Msg("重新加载权限缓存失败")
	}

	log.Info().Int32("permission_id", perm.ID).Str("code", code).Msg("权限更新成功")
	return perm, nil
}

// DeletePermission 删除权限
func (s *PermissionService) DeletePermission(ctx context.Context, code string) error {
	log.Info().Str("service", "PermissionService").Str("operation", "DeletePermission").
		Str("code", code).Msg("开始删除权限")

	// 检查权限是否存在
	perm, err := s.queries.GetPermissionByCode(ctx, code)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Warn().Str("code", code).Msg("权限不存在")
			return ErrPermissionNotFound
		}
		log.Error().Err(err).Msg("查询权限失败")
		return err
	}

	// 检查是否有角色正在使用该权限
	rolePerms, err := s.queries.ListRolePermissions(ctx)
	if err != nil {
		log.Error().Err(err).Msg("查询角色权限关联失败")
		return err
	}
	for _, rp := range rolePerms {
		if rp.PermissionCode == code {
			log.Warn().Str("code", code).Msg("权限正在被角色使用")
			return ErrPermissionInUse
		}
	}

	// 删除权限
	err = s.queries.DeletePermission(ctx, code)
	if err != nil {
		log.Error().Err(err).Msg("删除权限失败")
		return err
	}

	// 重新加载缓存（带重试）
	if err := s.ReloadWithRetry(ctx); err != nil {
		log.Error().Err(err).Msg("重新加载权限缓存失败")
	}

	log.Info().Int32("permission_id", perm.ID).Str("code", code).Msg("权限删除成功")
	return nil
}
