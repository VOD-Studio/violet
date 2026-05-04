// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"context"
	"sync"

	"github.com/rs/zerolog/log"

	"blog-api/internal/repository/generated"
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
