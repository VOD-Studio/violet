package user

import (
	"context"

	"blog-api/internal/domain/shared"
)

// UserRepository 用户仓储接口（端口）
//
// 由领域层定义，基础设施层（infrastructure/persistence/gorm/user_repo.go）实现。
// 应用层依赖此接口而非具体实现，保证可测试性（mock）与可替换性。
//
// 接口设计原则：
//   - 只暴露应用层需要的方法，不照搬 CRUD
//   - 方法以领域语义命名（FindByEmail 而非 GetByEmail）
//   - 唯一性约束通过专门的 ExistsByEmail/ExistsByUsername 方法表达
type UserRepository interface {
	// FindByID 按 ID 查找用户
	FindByID(ctx context.Context, id shared.ID) (*User, error)
	// FindByEmail 按邮箱查找用户（用于登录、注册查重）
	FindByEmail(ctx context.Context, email Email) (*User, error)
	// FindByUsername 按用户名查找用户（用于注册查重）
	FindByUsername(ctx context.Context, username Username) (*User, error)

	// ExistsByEmail 邮箱是否已存在（注册查重，比 FindByEmail 更轻量）
	ExistsByEmail(ctx context.Context, email Email) (bool, error)
	// ExistsByUsername 用户名是否已存在
	ExistsByUsername(ctx context.Context, username Username) (bool, error)

	// Save 保存用户（新增或更新）
	// 实现应基于 ID 判断 upsert：ID 为零值则插入，否则更新
	Save(ctx context.Context, u *User) error
	// Delete 删除用户（硬删除）
	Delete(ctx context.Context, id shared.ID) error

	// Count 统计用户总数（管理后台仪表盘）
	Count(ctx context.Context) (int64, error)
}

// 预定义领域错误（用户聚合特定）
//
// 集中定义在本包内，供应用层 import 使用，
// 避免散落在各 service 文件中。
var (
	// ErrNotFound 用户不存在
	ErrNotFound = shared.NotFound("用户")
	// ErrEmailExists 邮箱已被注册
	ErrEmailExists = shared.Conflict("邮箱已被注册")
	// ErrUsernameExists 用户名已被占用
	ErrUsernameExists = shared.Conflict("用户名已被占用")
	// ErrInvalidCredentials 凭证无效（登录失败通用错误，不暴露具体是邮箱还是密码错）
	ErrInvalidCredentials = shared.Unauthorized("邮箱或密码错误")
	// ErrEmailNotVerified 邮箱未验证
	ErrEmailNotVerified = shared.Forbidden("邮箱未验证")
	// ErrAccountDisabled 账户已被禁用
	ErrAccountDisabled = shared.Forbidden("账户已被禁用")
)
