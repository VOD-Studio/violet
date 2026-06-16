// Package query 提供 permission 聚合的读操作用例（CQRS Query 侧）。
package query

import (
	"context"

	approle "blog-api/internal/application/role"
	"blog-api/internal/domain/permission"
)

// ListPermissionsHandler 查询所有权限点用例
type ListPermissionsHandler struct {
	permRepo permission.PermissionRepository
}

// NewListPermissionsHandler 构造查询所有权限点用例
func NewListPermissionsHandler(repo permission.PermissionRepository) *ListPermissionsHandler {
	return &ListPermissionsHandler{permRepo: repo}
}

// Handle 执行查询所有权限点
func (h *ListPermissionsHandler) Handle(ctx context.Context) ([]approle.PermissionDTO, error) {
	perms, err := h.permRepo.FindAll(ctx)
	if err != nil {
		return nil, err
	}

	dtos := make([]approle.PermissionDTO, 0, len(perms))
	for _, p := range perms {
		dtos = append(dtos, approle.PermissionDTO{
			ID:          p.ID(),
			Code:        p.Code().String(),
			Name:        p.Name(),
			Description: p.Description(),
		})
	}
	return dtos, nil
}
