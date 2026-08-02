// Package query 提供 permission 聚合的读操作用例（CQRS Query 侧）。
package query

import (
	"context"
	"sort"

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

// Handle 执行查询所有权限点，返回 menu→action 两层树
func (h *ListPermissionsHandler) Handle(ctx context.Context) ([]approle.PermissionDTO, error) {
	perms, err := h.permRepo.FindAll(ctx)
	if err != nil {
		return nil, err
	}

	// 1. 全部转 DTO，按 sort 升序、id 升序排
	dtos := make([]approle.PermissionDTO, 0, len(perms))
	byID := make(map[int32]*approle.PermissionDTO, len(perms))
	for _, p := range perms {
		dtos = append(dtos, approle.PermissionDTO{
			ID:          p.ID(),
			Code:        p.Code().String(),
			Name:        p.Name(),
			Description: p.Description(),
			Type:        p.Type(),
			ParentID:    p.ParentID(),
			Sort:        p.Sort(),
			IsBuiltin:   p.IsBuiltin(),
		})
	}
	// 排序：sort 升序，再 id 升序
	sort.Slice(dtos, func(i, j int) bool {
		if dtos[i].Sort != dtos[j].Sort {
			return dtos[i].Sort < dtos[j].Sort
		}
		return dtos[i].ID < dtos[j].ID
	})
	for i := range dtos {
		byID[dtos[i].ID] = &dtos[i]
	}

	// 2. 挂载 children：把 action 挂到父 menu 的 Children。
	//
	// 注意：必须先把所有 children 挂到 byID 中的 *dto（这是 dtos 切片里的同一块内存），
	// 再收集 roots 的拷贝——否则 root 拷贝取到的 Children 仍是 nil（slice append
	// 从 nil 扩容会分配新底层数组，roots 里的副本不会随之更新）。
	roots := make([]approle.PermissionDTO, 0)
	rootIdx := make([]int, 0)
	for i := range dtos {
		dto := &dtos[i]
		if dto.ParentID == nil {
			rootIdx = append(rootIdx, i)
			continue
		}
		if parent, ok := byID[*dto.ParentID]; ok {
			parent.Children = append(parent.Children, *dto)
		} else {
			// 孤立 action（父不存在），作为顶层兜底
			rootIdx = append(rootIdx, i)
		}
	}
	// 此时 dtos[i].Children 已挂载完毕，拷贝到 roots 保留完整子树。
	for _, i := range rootIdx {
		roots = append(roots, dtos[i])
	}
	return roots, nil
}
