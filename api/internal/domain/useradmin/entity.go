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

// ListFilter 用户列表筛选条件（FindPage 入参，维度正交组合）。
type ListFilter struct {
	// Role 按角色精确筛选，空串 = 不过滤
	Role string
	// IsActive 按启用状态筛选，nil = 不过滤
	IsActive *bool
	// Keyword 用户名/邮箱模糊搜索关键词，空串 = 不过滤
	Keyword string
}

// AdminUserStore 用户管理存储端口（admin 专用查询）
type AdminUserStore interface {
	// FindPage 分页查询用户（筛选维度由 ListFilter 正交组合），
	// 排序 created_at DESC, id DESC tiebreaker 防翻页漂移。
	FindPage(ctx context.Context, filter ListFilter, q shared.PageQuery) (shared.PageResult[user.User], error)
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
