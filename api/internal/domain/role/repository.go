package role

import (
	"context"

	"blog-api/internal/domain/shared"
)

// RoleRepository 角色仓储接口（端口）
//
// 由领域层定义，基础设施层（GORM）实现。
// 注意：角色用 int32 ID（SERIAL），区别于 user 等用 UUID 的聚合。
type RoleRepository interface {
	// FindByID 按 ID 查找角色（含权限列表）
	FindByID(ctx context.Context, id int32) (*Role, error)
	// FindByName 按名称查找角色
	FindByName(ctx context.Context, name RoleName) (*Role, error)
	// FindAll 查找所有角色
	FindAll(ctx context.Context) ([]*Role, error)
	// ExistsByName 名称是否已存在
	ExistsByName(ctx context.Context, name RoleName) (bool, error)

	// Save 保存角色（新增或更新基本信息，不含权限）
	Save(ctx context.Context, r *Role) error
	// Delete 删除角色（硬删除，级联删除 role_permissions）
	// 内置角色由领域层 CanDelete 守卫，repository 不重复校验
	Delete(ctx context.Context, id int32) error

	// CountUsers 统计使用该角色的用户数（判断角色是否可删除）
	CountUsers(ctx context.Context, roleID int32) (int64, error)
}

// 领域错误
var (
	// ErrNotFound 角色不存在
	ErrNotFound = shared.NotFound("角色")
	// ErrNameExists 角色名称已存在
	ErrNameExists = shared.Conflict("角色名称已存在")
	// ErrInUse 角色正在被用户使用，无法删除
	ErrInUse = shared.Conflict("角色正在被用户使用，无法删除")
	// ErrCannotModifyBuiltin 不能修改或删除内置角色
	ErrCannotModifyBuiltin = shared.Forbidden("不能修改或删除内置角色")
)
