// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/rs/zerolog/log"

	"blog-api/internal/repository/generated"
)

// 角色管理相关错误定义
var (
	// ErrRoleNotFound 角色不存在
	ErrRoleNotFound = errors.New("角色不存在")
	// ErrRoleNameExists 角色名称已存在
	ErrRoleNameExists = errors.New("角色名称已存在")
	// ErrRoleInUse 角色正在被用户使用
	ErrRoleInUse = errors.New("角色正在被用户使用，无法删除")
	// ErrInvalidPermission 无效的权限代码
	ErrInvalidPermission = errors.New("无效的权限代码")
)

// RoleService 角色管理业务服务
type RoleService struct {
	queries            *generated.Queries
	permissionService  *PermissionService
}

// NewRoleService 创建角色管理服务实例
func NewRoleService(queries *generated.Queries, permissionService *PermissionService) *RoleService {
	return &RoleService{
		queries:           queries,
		permissionService: permissionService,
	}
}

// RoleWithPermissions 角色及其权限信息
type RoleWithPermissions struct {
	ID          int32    `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	CreatedAt   string   `json:"created_at"`
	Permissions []PermissionInfo `json:"permissions"`
}

// PermissionInfo 权限信息
type PermissionInfo struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

// ListRoles 获取角色列表
func (s *RoleService) ListRoles(ctx context.Context) ([]*generated.Role, error) {
	log.Info().Str("service", "RoleService").Str("operation", "ListRoles").Msg("查询角色列表")

	roles, err := s.queries.ListRoles(ctx)
	if err != nil {
		log.Error().Err(err).Msg("查询角色列表失败")
		return nil, fmt.Errorf("查询角色列表失败: %w", err)
	}

	log.Info().Int("count", len(roles)).Msg("角色列表查询成功")
	return roles, nil
}

// CreateRole 创建角色
func (s *RoleService) CreateRole(ctx context.Context, name, description string) (*generated.Role, error) {
	log.Info().Str("service", "RoleService").Str("operation", "CreateRole").
		Str("name", name).Msg("开始创建角色")

	// 检查角色名称是否已存在
	_, err := s.queries.GetRoleByName(ctx, name)
	if err == nil {
		log.Warn().Str("name", name).Msg("角色名称已存在")
		return nil, ErrRoleNameExists
	}
	if !errors.Is(err, sql.ErrNoRows) {
		log.Error().Err(err).Msg("检查角色名称失败")
		return nil, fmt.Errorf("检查角色名称失败: %w", err)
	}

	// 创建角色
	role, err := s.queries.CreateRole(ctx, generated.CreateRoleParams{
		Name:        name,
		Description: sql.NullString{String: description, Valid: description != ""},
	})
	if err != nil {
		log.Error().Err(err).Msg("创建角色失败")
		return nil, fmt.Errorf("创建角色失败: %w", err)
	}

	log.Info().Int32("role_id", role.ID).Str("name", name).Msg("角色创建成功")
	return role, nil
}

// UpdateRole 更新角色
func (s *RoleService) UpdateRole(ctx context.Context, id int32, name, description string) (*generated.Role, error) {
	log.Info().Str("service", "RoleService").Str("operation", "UpdateRole").
		Int32("role_id", id).Str("name", name).Msg("开始更新角色")

	// 检查角色是否存在
	_, err := s.queries.GetRoleByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Warn().Int32("role_id", id).Msg("角色不存在")
			return nil, ErrRoleNotFound
		}
		log.Error().Err(err).Msg("查询角色失败")
		return nil, fmt.Errorf("查询角色失败: %w", err)
	}

	// 如果要更新名称，检查新名称是否已被其他角色使用
	if name != "" {
		existingRole, err := s.queries.GetRoleByName(ctx, name)
		if err == nil && existingRole.ID != id {
			log.Warn().Str("name", name).Msg("角色名称已被其他角色使用")
			return nil, ErrRoleNameExists
		}
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			log.Error().Err(err).Msg("检查角色名称失败")
			return nil, fmt.Errorf("检查角色名称失败: %w", err)
		}
	}

	// 更新角色
	role, err := s.queries.UpdateRole(ctx, generated.UpdateRoleParams{
		ID:          id,
		Name:        name,
		Description: sql.NullString{String: description, Valid: description != ""},
	})
	if err != nil {
		log.Error().Err(err).Msg("更新角色失败")
		return nil, fmt.Errorf("更新角色失败: %w", err)
	}

	log.Info().Int32("role_id", id).Msg("角色更新成功")
	return role, nil
}

// DeleteRole 删除角色
func (s *RoleService) DeleteRole(ctx context.Context, id int32) error {
	log.Info().Str("service", "RoleService").Str("operation", "DeleteRole").
		Int32("role_id", id).Msg("开始删除角色")

	// 检查角色是否存在
	_, err := s.queries.GetRoleByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Warn().Int32("role_id", id).Msg("角色不存在")
			return ErrRoleNotFound
		}
		log.Error().Err(err).Msg("查询角色失败")
		return fmt.Errorf("查询角色失败: %w", err)
	}

	// 检查是否有用户正在使用该角色
	count, err := s.queries.CountUsersByRoleID(ctx, sql.NullInt32{Int32: id, Valid: true})
	if err != nil {
		log.Error().Err(err).Msg("检查角色使用情况失败")
		return fmt.Errorf("检查角色使用情况失败: %w", err)
	}
	if count > 0 {
		log.Warn().Int32("role_id", id).Int64("user_count", count).Msg("角色正在被用户使用")
		return ErrRoleInUse
	}

	// 删除角色（级联删除会自动删除 role_permissions）
	err = s.queries.DeleteRole(ctx, id)
	if err != nil {
		log.Error().Err(err).Msg("删除角色失败")
		return fmt.Errorf("删除角色失败: %w", err)
	}

	log.Info().Int32("role_id", id).Msg("角色删除成功")
	return nil
}

// GetRoleWithPermissions 获取角色详情及其权限列表
func (s *RoleService) GetRoleWithPermissions(ctx context.Context, id int32) (*RoleWithPermissions, error) {
	log.Info().Str("service", "RoleService").Str("operation", "GetRoleWithPermissions").
		Int32("role_id", id).Msg("查询角色详情")

	rows, err := s.queries.GetRoleWithPermissions(ctx, id)
	if err != nil {
		log.Error().Err(err).Msg("查询角色详情失败")
		return nil, fmt.Errorf("查询角色详情失败: %w", err)
	}
	if len(rows) == 0 {
		log.Warn().Int32("role_id", id).Msg("角色不存在")
		return nil, ErrRoleNotFound
	}

	// 第一行包含角色信息
	row := rows[0]
	result := &RoleWithPermissions{
		ID:          row.ID,
		Name:        row.Name,
		Description: row.Description.String,
		CreatedAt:   row.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		Permissions: []PermissionInfo{},
	}

	// 收集所有权限
	for _, r := range rows {
		if r.PermissionCode.Valid {
			result.Permissions = append(result.Permissions, PermissionInfo{
				Code: r.PermissionCode.String,
				Name: r.PermissionName.String,
			})
		}
	}

	log.Info().Int32("role_id", id).Int("permission_count", len(result.Permissions)).Msg("角色详情查询成功")
	return result, nil
}

// UpdateRolePermissions 更新角色权限
func (s *RoleService) UpdateRolePermissions(ctx context.Context, roleID int32, permissionCodes []string) error {
	log.Info().Str("service", "RoleService").Str("operation", "UpdateRolePermissions").
		Int32("role_id", roleID).Strs("permissions", permissionCodes).Msg("开始更新角色权限")

	// 检查角色是否存在
	_, err := s.queries.GetRoleByID(ctx, roleID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Warn().Int32("role_id", roleID).Msg("角色不存在")
			return ErrRoleNotFound
		}
		log.Error().Err(err).Msg("查询角色失败")
		return fmt.Errorf("查询角色失败: %w", err)
	}

	// 验证所有权限代码是否有效
	allPermissions := s.permissionService.GetAllPermissions()
	for _, code := range permissionCodes {
		if _, ok := allPermissions[code]; !ok {
			log.Warn().Str("code", code).Msg("无效的权限代码")
			return fmt.Errorf("%w: %s", ErrInvalidPermission, code)
		}
	}

	// 删除现有权限
	err = s.queries.UpdateRolePermissions(ctx, roleID)
	if err != nil {
		log.Error().Err(err).Msg("删除现有权限失败")
		return fmt.Errorf("删除现有权限失败: %w", err)
	}

	// 添加新权限
	for _, code := range permissionCodes {
		perm, err := s.queries.GetPermissionByCode(ctx, code)
		if err != nil {
			log.Error().Err(err).Str("code", code).Msg("查询权限失败")
			continue
		}
		err = s.queries.AddRolePermission(ctx, generated.AddRolePermissionParams{
			RoleID:       roleID,
			PermissionID: perm.ID,
		})
		if err != nil {
			log.Error().Err(err).Int32("role_id", roleID).Int32("permission_id", perm.ID).Msg("添加角色权限失败")
		}
	}

	// 重新加载权限缓存
	if err := s.permissionService.Reload(ctx); err != nil {
		log.Error().Err(err).Msg("重新加载权限缓存失败")
	}

	log.Info().Int32("role_id", roleID).Int("permission_count", len(permissionCodes)).Msg("角色权限更新成功")
	return nil
}