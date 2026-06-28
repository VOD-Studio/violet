// Package query 提供 role 聚合的读操作用例（CQRS Query 侧）。
//
// 读侧直接查询 repository 返回 DTO，不经过聚合根（提升读性能）。
package query

import (
	"context"
	"time"

	approle "blog-api/internal/application/role"
	"blog-api/internal/domain/permission"
	"blog-api/internal/domain/role"
)

// ============================================================
// ListRoles 查询所有角色（含用户数）
// ============================================================

// ListRolesHandler 查询角色列表用例
type ListRolesHandler struct {
	roleRepo role.RoleRepository
}

// NewListRolesHandler 构造查询角色列表用例
func NewListRolesHandler(repo role.RoleRepository) *ListRolesHandler {
	return &ListRolesHandler{roleRepo: repo}
}

// Handle 执行查询角色列表
func (h *ListRolesHandler) Handle(ctx context.Context) ([]approle.RoleDTO, error) {
	roles, err := h.roleRepo.FindAll(ctx)
	if err != nil {
		return nil, err
	}

	dtos := make([]approle.RoleDTO, 0, len(roles))
	for _, rl := range roles {
		dtos = append(dtos, toRoleDTO(rl))
	}
	return dtos, nil
}

// ============================================================
// ListRolesWithUserCount 查询角色列表（含每角色用户数）
// ============================================================

// ListRolesWithUserCountHandler 查询角色列表含用户数用例
type ListRolesWithUserCountHandler struct {
	roleRepo role.RoleRepository
}

// NewListRolesWithUserCountHandler 构造
func NewListRolesWithUserCountHandler(repo role.RoleRepository) *ListRolesWithUserCountHandler {
	return &ListRolesWithUserCountHandler{roleRepo: repo}
}

// Handle 执行查询
func (h *ListRolesWithUserCountHandler) Handle(ctx context.Context) ([]approle.RoleDTO, error) {
	roles, err := h.roleRepo.FindAll(ctx)
	if err != nil {
		return nil, err
	}

	dtos := make([]approle.RoleDTO, 0, len(roles))
	for _, rl := range roles {
		dto := toRoleDTO(rl)
		// 逐角色查询用户数（角色数量通常很少，N+1 可接受）
		count, err := h.roleRepo.CountUsers(ctx, rl.RoleID())
		if err != nil {
			return nil, err
		}
		dto.UserCount = count
		dtos = append(dtos, dto)
	}
	return dtos, nil
}

// ============================================================
// GetRoleWithPermissions 查询角色详情（含权限）
// ============================================================

// GetRoleWithPermissionsInput 查询角色详情入参
type GetRoleWithPermissionsInput struct {
	ID int32
}

// GetRoleWithPermissionsHandler 查询角色详情用例
type GetRoleWithPermissionsHandler struct {
	roleRepo role.RoleRepository
	permRepo permission.PermissionRepository
}

// NewGetRoleWithPermissionsHandler 构造
func NewGetRoleWithPermissionsHandler(roleRepo role.RoleRepository, permRepo permission.PermissionRepository) *GetRoleWithPermissionsHandler {
	return &GetRoleWithPermissionsHandler{roleRepo: roleRepo, permRepo: permRepo}
}

// Handle 执行查询角色详情
func (h *GetRoleWithPermissionsHandler) Handle(ctx context.Context, in GetRoleWithPermissionsInput) (approle.RoleWithPermissionsDTO, error) {
	rl, err := h.roleRepo.FindByID(ctx, in.ID)
	if err != nil {
		return approle.RoleWithPermissionsDTO{}, err
	}

	// 查询角色拥有的权限点详情
	codes := rl.PermissionCodes()
	permDtos := make([]approle.PermissionDTO, 0, len(codes))
	for _, code := range codes {
		c, _ := permission.ParseCode(code)
		p, err := h.permRepo.FindByCode(ctx, c)
		if err != nil {
			continue // 权限可能已被删除（脏数据容错）
		}
		permDtos = append(permDtos, toPermissionDTO(p))
	}

	return approle.RoleWithPermissionsDTO{
		RoleDTO: approle.RoleDTO{
			ID:              rl.RoleID(),
			Name:            rl.Name().String(),
			Description:     rl.Description(),
			PermissionCodes: codes,
			CreatedAt:       rl.CreatedAt().Format(time.RFC3339),
		},
		Permissions: permDtos,
	}, nil
}

// ============================================================
// 辅助：领域对象 → DTO 转换
// ============================================================

func toRoleDTO(rl *role.Role) approle.RoleDTO {
	return approle.RoleDTO{
		ID:              rl.RoleID(),
		Name:            rl.Name().String(),
		Description:     rl.Description(),
		IsBuiltin:       rl.Name().IsBuiltin(),
		PermissionCodes: rl.PermissionCodes(),
		CreatedAt:       rl.CreatedAt().Format(time.RFC3339),
	}
}

func toPermissionDTO(p *permission.Permission) approle.PermissionDTO {
	return approle.PermissionDTO{
		ID:          p.ID(),
		Code:        p.Code().String(),
		Name:        p.Name(),
		Description: p.Description(),
	}
}
