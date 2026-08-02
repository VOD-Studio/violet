// Package useradmin 提供用户管理（后台）的领域端口。
//
// 管理后台对用户的管理操作（列表/筛选/批量操作）需要 UserRepository
// 之外的查询能力，本包定义 AdminUserStore 端口解耦基础设施实现。
// 用户聚合根本身复用 domain/user.User。
package useradmin

import (
	"context"

	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
)

// ListFilter 用户列表筛选条件
type ListFilter struct {
	Role     string // 可选：按角色筛选
	IsActive *bool  // 可选：按状态筛选
	Keyword  string // 可选：用户名/邮箱模糊搜索
}

// ListResult 用户列表结果
type ListResult struct {
	// Users 当前页的用户列表
	Users []user.User
	// Total 符合筛选条件的用户总数（供分页计算总页数）
	Total int64
}

// AdminUserStore 用户管理存储端口（admin 专用查询）
type AdminUserStore interface {
	// List 分页查询用户（支持筛选）
	List(ctx context.Context, filter ListFilter, page, limit int) (ListResult, error)
	// FindByID 按 ID 查找（admin 不限条件）
	FindByID(ctx context.Context, id shared.ID) (*user.User, error)
	// FindByIDs 按 ID 批量查找（批量操作前的安全校验用）
	FindByIDs(ctx context.Context, ids []shared.ID) ([]*user.User, error)
	// Save 保存用户（upsert）
	Save(ctx context.Context, u *user.User) error
	// Delete 删除用户
	Delete(ctx context.Context, id shared.ID) error
	// BatchUpdateStatus 批量启用/禁用，返回受影响数
	BatchUpdateStatus(ctx context.Context, ids []shared.ID, isActive bool) (int64, error)
	// BatchUpdateRole 批量修改角色，返回受影响数
	BatchUpdateRole(ctx context.Context, ids []shared.ID, role string) (int64, error)
}
