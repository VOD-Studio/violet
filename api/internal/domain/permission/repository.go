package permission

import (
	"context"

	"blog-api/internal/domain/shared"
)

// PermissionRepository 权限点仓储接口（端口）
type PermissionRepository interface {
	// FindByCode 按代码查找权限点
	FindByCode(ctx context.Context, code Code) (*Permission, error)
	// FindAll 查找所有权限点
	FindAll(ctx context.Context) ([]*Permission, error)
	// ExistsByCode 代码是否已存在
	ExistsByCode(ctx context.Context, code Code) (bool, error)

	// Save 保存权限点（新增或更新）
	Save(ctx context.Context, p *Permission) error
	// Delete 删除权限点（级联删除 role_permissions）
	Delete(ctx context.Context, code Code) error

	// CountRoles 统计使用该权限点的角色数（判断是否可删除）
	CountRoles(ctx context.Context, code Code) (int64, error)
}

// 领域错误
var (
	// ErrNotFound 权限不存在
	ErrNotFound = shared.NotFound("权限")
	// ErrCodeExists 权限代码已存在
	ErrCodeExists = shared.Conflict("权限代码已存在")
	// ErrInUse 权限正在被角色使用，无法删除
	ErrInUse = shared.Conflict("权限正在被角色使用，无法删除")
)
