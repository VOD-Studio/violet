// Package gorm 提供用户管理（后台）的 GORM 存储实现。
package gorm

import (
	"context"
	"errors"

	"gorm.io/gorm"

	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
	domainuseradmin "blog-api/internal/domain/useradmin"
	newmodel "blog-api/internal/infrastructure/persistence/gorm/model"
)

// AdminUserStore 实现领域 AdminUserStore 端口
type AdminUserStore struct{ db *gorm.DB }

// NewAdminUserStore 创建用户管理存储
func NewAdminUserStore(db *gorm.DB) *AdminUserStore {
	return &AdminUserStore{db: db}
}

// List 分页查询用户（支持筛选）
func (s *AdminUserStore) List(ctx context.Context, filter domainuseradmin.ListFilter, page, limit int) (domainuseradmin.ListResult, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit
	query := s.db.WithContext(ctx).Model(&newmodel.User{})
	if filter.Role != "" {
		query = query.Where("role = ?", filter.Role)
	}
	if filter.IsActive != nil {
		query = query.Where("is_active = ?", *filter.IsActive)
	}
	if filter.Keyword != "" {
		like := "%" + filter.Keyword + "%"
		query = query.Where("username LIKE ? OR email LIKE ?", like, like)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return domainuseradmin.ListResult{}, domainshared.Internal("用户计数失败", err)
	}
	var pos []newmodel.User
	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&pos).Error; err != nil {
		return domainuseradmin.ListResult{}, domainshared.Internal("查询用户列表失败", err)
	}
	users := make([]domainuser.User, 0, len(pos))
	for _, po := range pos {
		u, err := toDomain(po)
		if err != nil {
			return domainuseradmin.ListResult{}, domainshared.Internal("用户转换失败", err)
		}
		if u != nil {
			users = append(users, *u)
		}
	}
	return domainuseradmin.ListResult{Users: users, Total: total}, nil
}

// FindByID 按 ID 查找
func (s *AdminUserStore) FindByID(ctx context.Context, id domainshared.ID) (*domainuser.User, error) {
	var po newmodel.User
	if err := s.db.WithContext(ctx).First(&po, "id = ?", id.UUID()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domainuser.ErrNotFound
		}
		return nil, domainshared.Internal("查询用户失败", err)
	}
	return toDomain(po)
}

// FindByIDs 按 ID 批量查找（批量操作前的安全校验用）
func (s *AdminUserStore) FindByIDs(ctx context.Context, ids []domainshared.ID) ([]*domainuser.User, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	uuids := make([]string, 0, len(ids))
	for _, id := range ids {
		uuids = append(uuids, id.UUID().String())
	}
	var pos []newmodel.User
	if err := s.db.WithContext(ctx).Where("id IN ?", uuids).Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("批量查询用户失败", err)
	}
	users := make([]*domainuser.User, 0, len(pos))
	for i := range pos {
		u, err := toDomain(pos[i])
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

// Save 保存用户
func (s *AdminUserStore) Save(ctx context.Context, u *domainuser.User) error {
	po := toPO(u)
	return s.db.WithContext(ctx).Save(&po).Error
}

// Delete 删除用户
func (s *AdminUserStore) Delete(ctx context.Context, id domainshared.ID) error {
	result := s.db.WithContext(ctx).Where("id = ?", id.UUID()).Delete(&newmodel.User{})
	if result.Error != nil {
		return domainshared.Internal("删除用户失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return domainuser.ErrNotFound
	}
	return nil
}

// BatchUpdateStatus 批量启用/禁用
func (s *AdminUserStore) BatchUpdateStatus(ctx context.Context, ids []domainshared.ID, isActive bool) (int64, error) {
	uuids := make([]interface{}, len(ids))
	for i, id := range ids {
		uuids[i] = id.UUID()
	}
	result := s.db.WithContext(ctx).Model(&newmodel.User{}).
		Where("id IN ?", uuids).Update("is_active", isActive)
	if result.Error != nil {
		return 0, domainshared.Internal("批量更新用户状态失败", result.Error)
	}
	return result.RowsAffected, nil
}

// BatchUpdateRole 批量修改角色
func (s *AdminUserStore) BatchUpdateRole(ctx context.Context, ids []domainshared.ID, role string) (int64, error) {
	uuids := make([]interface{}, len(ids))
	for i, id := range ids {
		uuids[i] = id.UUID()
	}
	result := s.db.WithContext(ctx).Model(&newmodel.User{}).
		Where("id IN ?", uuids).Update("role", role)
	if result.Error != nil {
		return 0, domainshared.Internal("批量更新用户角色失败", result.Error)
	}
	return result.RowsAffected, nil
}

var _ domainuseradmin.AdminUserStore = (*AdminUserStore)(nil)
