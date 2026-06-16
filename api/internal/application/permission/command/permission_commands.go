// Package command 提供 permission 聚合的写操作用例（CQRS Command 侧）。
package command

import (
	"context"

	"blog-api/internal/domain/permission"
)

// ============================================================
// CreatePermission 创建权限点
// ============================================================

// CreatePermissionInput 创建权限点入参
type CreatePermissionInput struct {
	Code        string
	Name        string
	Description string
}

// CreatePermissionOutput 创建权限点出参
type CreatePermissionOutput struct {
	ID int32
}

// CreatePermissionHandler 创建权限点用例
type CreatePermissionHandler struct {
	permRepo permission.PermissionRepository
}

// NewCreatePermissionHandler 构造创建权限点用例
func NewCreatePermissionHandler(repo permission.PermissionRepository) *CreatePermissionHandler {
	return &CreatePermissionHandler{permRepo: repo}
}

// Handle 执行创建权限点
func (h *CreatePermissionHandler) Handle(ctx context.Context, in CreatePermissionInput) (CreatePermissionOutput, error) {
	// 1. 值对象校验
	code, err := permission.ParseCode(in.Code)
	if err != nil {
		return CreatePermissionOutput{}, err
	}

	// 2. 代码查重
	exists, err := h.permRepo.ExistsByCode(ctx, code)
	if err != nil {
		return CreatePermissionOutput{}, err
	}
	if exists {
		return CreatePermissionOutput{}, permission.ErrCodeExists
	}

	// 3. 构造 + 持久化
	p := permission.NewPermission(0, code, in.Name, in.Description)
	id, err := h.permRepo.Save(ctx, p)
	if err != nil {
		return CreatePermissionOutput{}, err
	}

	return CreatePermissionOutput{ID: id}, nil
}

// ============================================================
// UpdatePermission 更新权限点
// ============================================================

// UpdatePermissionInput 更新权限点入参
type UpdatePermissionInput struct {
	Code        string
	Name        string
	Description string
}

// UpdatePermissionHandler 更新权限点用例
type UpdatePermissionHandler struct {
	permRepo permission.PermissionRepository
}

// NewUpdatePermissionHandler 构造更新权限点用例
func NewUpdatePermissionHandler(repo permission.PermissionRepository) *UpdatePermissionHandler {
	return &UpdatePermissionHandler{permRepo: repo}
}

// Handle 执行更新权限点
func (h *UpdatePermissionHandler) Handle(ctx context.Context, in UpdatePermissionInput) error {
	code, err := permission.ParseCode(in.Code)
	if err != nil {
		return err
	}

	// 1. 加载现有权限
	p, err := h.permRepo.FindByCode(ctx, code)
	if err != nil {
		return err
	}

	// 2. 更新字段
	if in.Name != "" {
		p.UpdateName(in.Name)
	}
	if in.Description != "" {
		p.UpdateDescription(in.Description)
	}

	// 3. 持久化
	_, err = h.permRepo.Save(ctx, p)
	return err
}

// ============================================================
// DeletePermission 删除权限点
// ============================================================

// DeletePermissionInput 删除权限点入参
type DeletePermissionInput struct {
	Code string
}

// DeletePermissionHandler 删除权限点用例
//
// 业务规则：正在被角色使用的权限点不可删除。
type DeletePermissionHandler struct {
	permRepo permission.PermissionRepository
}

// NewDeletePermissionHandler 构造删除权限点用例
func NewDeletePermissionHandler(repo permission.PermissionRepository) *DeletePermissionHandler {
	return &DeletePermissionHandler{permRepo: repo}
}

// Handle 执行删除权限点
func (h *DeletePermissionHandler) Handle(ctx context.Context, in DeletePermissionInput) error {
	code, err := permission.ParseCode(in.Code)
	if err != nil {
		return err
	}

	// 1. 使用中检查
	count, err := h.permRepo.CountRoles(ctx, code)
	if err != nil {
		return err
	}
	if count > 0 {
		return permission.ErrInUse
	}

	// 2. 删除
	return h.permRepo.Delete(ctx, code)
}
