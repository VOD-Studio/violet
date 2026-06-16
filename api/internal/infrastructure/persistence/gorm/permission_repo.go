package gorm

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"blog-api/internal/domain/permission"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// PermissionRepository GORM 实现的权限点仓储
type PermissionRepository struct {
	db *gorm.DB
}

// NewPermissionRepository 创建权限点仓储
func NewPermissionRepository(db *gorm.DB) *PermissionRepository {
	return &PermissionRepository{db: db}
}

// permissionToPO 将权限实体转换为持久化模型
func permissionToPO(p *permission.Permission) model.Permission {
	return model.Permission{
		ID:          p.ID(),
		Code:        p.Code().String(),
		Name:        p.Name(),
		Description: p.Description(),
	}
}

// permissionToDomain 将持久化模型重建为权限实体
func permissionToDomain(po model.Permission) (*permission.Permission, error) {
	code, err := permission.ParseCode(po.Code)
	if err != nil {
		return nil, err
	}
	return permission.NewPermission(po.ID, code, po.Name, po.Description), nil
}

// FindByCode 按代码查找权限点
func (r *PermissionRepository) FindByCode(ctx context.Context, code permission.Code) (*permission.Permission, error) {
	var po model.Permission
	err := r.db.WithContext(ctx).Where("code = ?", code.String()).First(&po).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, permission.ErrNotFound
		}
		return nil, domainshared.Internal("查询权限失败", err)
	}
	return permissionToDomain(po)
}

// FindAll 查找所有权限点
func (r *PermissionRepository) FindAll(ctx context.Context) ([]*permission.Permission, error) {
	var pos []model.Permission
	err := r.db.WithContext(ctx).Order("code ASC").Find(&pos).Error
	if err != nil {
		return nil, domainshared.Internal("查询权限列表失败", err)
	}
	perms := make([]*permission.Permission, 0, len(pos))
	for _, po := range pos {
		p, err := permissionToDomain(po)
		if err != nil {
			return nil, err
		}
		perms = append(perms, p)
	}
	return perms, nil
}

// ExistsByCode 代码是否已存在
func (r *PermissionRepository) ExistsByCode(ctx context.Context, code permission.Code) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.Permission{}).
		Where("code = ?", code.String()).Count(&count).Error
	if err != nil {
		return false, domainshared.Internal("查询权限代码存在性失败", err)
	}
	return count > 0, nil
}

// Save 保存权限点（新增或更新）
// 返回数据库生成的 ID
func (r *PermissionRepository) Save(ctx context.Context, p *permission.Permission) (int32, error) {
	po := permissionToPO(p)
	if po.ID == 0 {
		if err := r.db.WithContext(ctx).Create(&po).Error; err != nil {
			return 0, domainshared.Internal("创建权限失败", err)
		}
	} else {
		if err := r.db.WithContext(ctx).Save(&po).Error; err != nil {
			return 0, domainshared.Internal("保存权限失败", err)
		}
	}
	return po.ID, nil
}

// Delete 删除权限点（级联删除 role_permissions 关联，由数据库 ON DELETE CASCADE 保证）
func (r *PermissionRepository) Delete(ctx context.Context, code permission.Code) error {
	result := r.db.WithContext(ctx).Where("code = ?", code.String()).Delete(&model.Permission{})
	if result.Error != nil {
		return domainshared.Internal("删除权限失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return permission.ErrNotFound
	}
	return nil
}

// CountRoles 统计使用该权限点的角色数
func (r *PermissionRepository) CountRoles(ctx context.Context, code permission.Code) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Table("role_permissions").
		Joins("JOIN permissions ON permissions.id = role_permissions.permission_id").
		Where("permissions.code = ?", code.String()).
		Count(&count).Error
	if err != nil {
		return 0, domainshared.Internal("统计权限使用数失败", err)
	}
	return count, nil
}

// 编译期断言：PermissionRepository 实现领域端口
var _ permission.PermissionRepository = (*PermissionRepository)(nil)
