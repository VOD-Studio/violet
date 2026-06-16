package gorm

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	"blog-api/internal/domain/role"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// RoleRepository GORM 实现的角色仓储
type RoleRepository struct {
	db *gorm.DB
}

// NewRoleRepository 创建角色仓储
func NewRoleRepository(db *gorm.DB) *RoleRepository {
	return &RoleRepository{db: db}
}

// toPO 将角色聚合转换为持久化模型
func roleToPO(r *role.Role) model.Role {
	po := model.Role{
		ID:          r.RoleID(),
		Name:        r.Name().String(),
		Description: r.Description(),
		CreatedAt:   r.CreatedAt(),
	}
	// 时间戳零值时由数据库填充默认值
	if po.CreatedAt.IsZero() {
		po.CreatedAt = time.Now()
	}
	return po
}

// toDomain 将持久化模型重建为角色聚合（含权限列表）
func roleToDomain(po model.Role) (*role.Role, error) {
	name, err := role.ParseRoleName(po.Name)
	if err != nil {
		return nil, err
	}
	// 收集权限代码
	permCodes := make([]string, 0, len(po.Permissions))
	for _, p := range po.Permissions {
		permCodes = append(permCodes, p.Code)
	}
	return role.ReconstructRole(
		po.ID,
		name,
		po.Description,
		permCodes,
		po.CreatedAt,
		po.CreatedAt, // roles 表无 updated_at，用 created_at 占位
	), nil
}

// FindByID 按 ID 查找角色（Preload 权限列表）
func (r *RoleRepository) FindByID(ctx context.Context, id int32) (*role.Role, error) {
	var po model.Role
	err := r.db.WithContext(ctx).Preload("Permissions").First(&po, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, role.ErrNotFound
		}
		return nil, domainshared.Internal("查询角色失败", err)
	}
	return roleToDomain(po)
}

// FindByName 按名称查找角色
func (r *RoleRepository) FindByName(ctx context.Context, name role.RoleName) (*role.Role, error) {
	var po model.Role
	err := r.db.WithContext(ctx).Preload("Permissions").Where("name = ?", name.String()).First(&po).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, role.ErrNotFound
		}
		return nil, domainshared.Internal("查询角色失败", err)
	}
	return roleToDomain(po)
}

// FindAll 查找所有角色（含权限）
func (r *RoleRepository) FindAll(ctx context.Context) ([]*role.Role, error) {
	var pos []model.Role
	err := r.db.WithContext(ctx).Preload("Permissions").Order("id ASC").Find(&pos).Error
	if err != nil {
		return nil, domainshared.Internal("查询角色列表失败", err)
	}
	roles := make([]*role.Role, 0, len(pos))
	for _, po := range pos {
		rl, err := roleToDomain(po)
		if err != nil {
			return nil, err
		}
		roles = append(roles, rl)
	}
	return roles, nil
}

// ExistsByName 名称是否已存在
func (r *RoleRepository) ExistsByName(ctx context.Context, name role.RoleName) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.Role{}).
		Where("name = ?", name.String()).Count(&count).Error
	if err != nil {
		return false, domainshared.Internal("查询角色名称存在性失败", err)
	}
	return count > 0, nil
}

// Save 保存角色基本信息（不含权限，权限通过 ReplacePermissions 单独管理）
// 返回数据库生成的 ID（新角色 ID=0 时由 DB autoIncrement 生成并回写）
func (r *RoleRepository) Save(ctx context.Context, rl *role.Role) (int32, error) {
	po := roleToPO(rl)
	// 区分新增和更新：ID=0 用 Create（回写 ID），否则 Save
	if po.ID == 0 {
		if err := r.db.WithContext(ctx).Create(&po).Error; err != nil {
			return 0, domainshared.Internal("创建角色失败", err)
		}
	} else {
		if err := r.db.WithContext(ctx).Save(&po).Error; err != nil {
			return 0, domainshared.Internal("保存角色失败", err)
		}
	}
	return po.ID, nil
}

// SavePermissions 全量替换角色的权限关联（role_permissions 表）
//
// 实现：先删除该角色的所有关联，再根据 permissionCodes 查询权限 ID 重新插入。
// 直接操作中间表，避免 GORM Association 的 Preload 依赖（兼容性更好）。
// 调用方应在事务中调用（配合 UnitOfWork），保证与角色基本信息变更的一致性。
func (r *RoleRepository) SavePermissions(ctx context.Context, roleID int32, permissionCodes []string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 1. 校验角色存在
		var count int64
		if err := tx.Model(&model.Role{}).Where("id = ?", roleID).Count(&count).Error; err != nil {
			return domainshared.Internal("查询角色失败", err)
		}
		if count == 0 {
			return role.ErrNotFound
		}

		// 2. 删除该角色的所有权限关联
		if err := tx.Where("role_id = ?", roleID).Delete(&model.RolePermission{}).Error; err != nil {
			return domainshared.Internal("清除角色权限关联失败", err)
		}

		// 3. 查询权限代码对应的权限 ID，校验全部存在
		if len(permissionCodes) > 0 {
			var perms []model.Permission
			if err := tx.Where("code IN ?", permissionCodes).Find(&perms).Error; err != nil {
				return domainshared.Internal("查询权限失败", err)
			}
			if len(perms) != len(permissionCodes) {
				found := make(map[string]struct{}, len(perms))
				for _, p := range perms {
					found[p.Code] = struct{}{}
				}
				missing := []string{}
				for _, code := range permissionCodes {
					if _, ok := found[code]; !ok {
						missing = append(missing, code)
					}
				}
				return domainshared.BadRequest("权限代码不存在: " + strings.Join(missing, ", "))
			}

			// 4. 批量插入新的关联记录
			rps := make([]model.RolePermission, 0, len(perms))
			for _, p := range perms {
				rps = append(rps, model.RolePermission{RoleID: roleID, PermissionID: p.ID})
			}
			if err := tx.Create(&rps).Error; err != nil {
				return domainshared.Internal("创建角色权限关联失败", err)
			}
		}
		return nil
	})
}

// Delete 删除角色（硬删除，级联删除 role_permissions）
func (r *RoleRepository) Delete(ctx context.Context, id int32) error {
	result := r.db.WithContext(ctx).Delete(&model.Role{}, id)
	if result.Error != nil {
		return domainshared.Internal("删除角色失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return role.ErrNotFound
	}
	return nil
}

// CountUsers 统计使用该角色的用户数
func (r *RoleRepository) CountUsers(ctx context.Context, roleID int32) (int64, error) {
	var count int64
	// users 表通过 role_id 关联角色
	err := r.db.WithContext(ctx).
		Table("users").
		Where("role_id = ?", roleID).
		Count(&count).Error
	if err != nil {
		return 0, domainshared.Internal("统计角色用户数失败", err)
	}
	return count, nil
}

// 编译期断言：RoleRepository 实现领域端口
var _ role.RoleRepository = (*RoleRepository)(nil)
