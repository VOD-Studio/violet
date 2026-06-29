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
	Type        string // "menu" | "action"
	ParentID    *int32 // action 必填指向 menu；menu 为 nil
	Sort        int
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

	// 3. type 默认 action
	permType := in.Type
	if permType == "" {
		permType = "action"
	}

	// 4. 构造 + 持久化（新建一律 isBuiltin=false）
	p := permission.NewPermission(0, code, in.Name, in.Description, in.ParentID, permType, in.Sort, false)
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
	ID          int32
	Code        string  // 非空且与现有不同时尝试改 code（内置会报错）
	Name        string
	Description string
	ParentID    *int32
	Sort        *int
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
	// 1. 加载现有权限
	p, err := h.permRepo.FindByID(ctx, in.ID)
	if err != nil {
		return err
	}

	// 2. 改 code（非空且不同时；内置由实体 guard 拦截）
	if in.Code != "" {
		newCode, err := permission.ParseCode(in.Code)
		if err != nil {
			return err
		}
		if !newCode.Equal(p.Code()) {
			if err := p.UpdateCode(newCode); err != nil {
				return err
			}
		}
	}
	// 3. 其余字段（内置也允许）
	if in.Name != "" {
		p.UpdateName(in.Name)
	}
	if in.Description != "" {
		p.UpdateDescription(in.Description)
	}
	p.UpdateParent(in.ParentID)
	if in.Sort != nil {
		p.UpdateSort(*in.Sort)
	}

	// 4. 持久化
	_, err = h.permRepo.Save(ctx, p)
	return err
}

// ============================================================
// DeletePermission 删除权限点
// ============================================================

// DeletePermissionInput 删除权限点入参
type DeletePermissionInput struct {
	ID int32
}

// DeletePermissionHandler 删除权限点用例
//
// 业务规则：内置权限不可删除；正在被角色使用的权限点不可删除。
type DeletePermissionHandler struct {
	permRepo permission.PermissionRepository
}

// NewDeletePermissionHandler 构造删除权限点用例
func NewDeletePermissionHandler(repo permission.PermissionRepository) *DeletePermissionHandler {
	return &DeletePermissionHandler{permRepo: repo}
}

// Handle 执行删除权限点
func (h *DeletePermissionHandler) Handle(ctx context.Context, in DeletePermissionInput) error {
	// 1. 加载，内置 guard
	p, err := h.permRepo.FindByID(ctx, in.ID)
	if err != nil {
		return err
	}
	if p.IsBuiltin() {
		return permission.ErrCannotModifyBuiltin
	}

	// 2. 使用中检查
	count, err := h.permRepo.CountRoles(ctx, in.ID)
	if err != nil {
		return err
	}
	if count > 0 {
		return permission.ErrInUse
	}

	// 3. 删除
	return h.permRepo.Delete(ctx, in.ID)
}
