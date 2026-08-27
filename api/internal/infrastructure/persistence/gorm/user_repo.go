package gorm

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// UserRepository GORM 实现的用户仓储
//
// 负责 domain/user.User（领域实体）与 model.User（持久化 PO）的互转，
// 隔离 GORM 细节，让应用层只依赖 domain/user.UserRepository 接口。
type UserRepository struct {
	db *gorm.DB
}

// NewUserRepository 创建用户仓储
//
// db 可以是普通连接（独立事务）或事务连接（来自 UnitOfWork.Do），
// 由调用方决定事务范围。
func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

// toPO 将领域实体转换为持久化模型
func toPO(u *user.User) model.User {
	return model.User{
		BaseModel: model.BaseModel{
			ID:        u.GetID().UUID(),
			CreatedAt: u.CreatedAt(),
			UpdatedAt: u.UpdatedAt(),
		},
		Username:            u.Username().String(),
		DisplayName:         u.DisplayName().String(),
		Email:               u.Email().String(),
		PasswordHash:        u.PasswordHash().String(),
		AvatarURL:           u.AvatarURL(),
		Bio:                 u.Bio(),
		Role:                string(u.Role()),
		GoogleID:            u.GoogleID(),
		GithubID:            u.GithubID(),
		IsRoot:              u.IsRoot(),
		EmailVerified:       u.EmailVerified(),
		IsActive:            u.IsActive(),
	}
}

// toDomain 将持久化模型重建为领域实体
//
// 使用 ReconstructUser 工厂（不触发事件、不设默认值），
// 完全按存储状态恢复。
func toDomain(po model.User) (*user.User, error) {
	email, err := user.ParseEmail(po.Email)
	if err != nil {
		return nil, err
	}
	username, err := user.ParseUsername(po.Username)
	if err != nil {
		return nil, err
	}
	displayName, err := user.ParseDisplayName(po.DisplayName)
	if err != nil {
		return nil, err
	}
	role := user.Role(po.Role)
	if !role.IsValid() {
		return nil, domainshared.BadRequest("数据库中存在非法角色: " + po.Role)
	}

	// 通过 UUID 重建 ID
	// 注意：shared.ID 的 value 是私有的，需通过 MustParseID 重建
	// 此处用 po.ID.String() 解析，保证 ID 重建一致性
	rebuiltID := domainshared.MustParseID(po.ID.String())
	id := rebuiltID

	return user.ReconstructUser(
		id,
		email,
		username,
		displayName,
		user.NewPasswordHash(po.PasswordHash),
		po.AvatarURL,
		po.Bio,
		role,
		po.GoogleID,
		po.GithubID,
		po.IsRoot,
		po.EmailVerified,
		po.IsActive,
		po.CreatedAt,
		po.UpdatedAt,
	), nil
}

// FindByID 按 ID 查找用户
func (r *UserRepository) FindByID(ctx context.Context, id domainshared.ID) (*user.User, error) {
	var po model.User
	err := r.db.WithContext(ctx).Where("id = ?", id.UUID()).First(&po).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, user.ErrNotFound
		}
		return nil, domainshared.Internal("查询用户失败", err)
	}
	return toDomain(po)
}

// FindByIDs 按 ID 批量查找用户（文章列表填充作者等）
//
// 空切片直接返回空结果；缺失的 ID 静默跳过，由调用方处理 author 缺失。
func (r *UserRepository) FindByIDs(ctx context.Context, ids []domainshared.ID) ([]*user.User, error) {
	if len(ids) == 0 {
		return []*user.User{}, nil
	}
	uuids := make([]uuid.UUID, 0, len(ids))
	for _, id := range ids {
		uuids = append(uuids, id.UUID())
	}
	var pos []model.User
	if err := r.db.WithContext(ctx).Where("id IN ?", uuids).Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("批量查询用户失败", err)
	}
	users := make([]*user.User, 0, len(pos))
	for i := range pos {
		u, err := toDomain(pos[i])
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

// FindByEmail 按邮箱查找用户
func (r *UserRepository) FindByEmail(ctx context.Context, email user.Email) (*user.User, error) {
	var po model.User
	err := r.db.WithContext(ctx).Where("email = ?", email.String()).First(&po).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, user.ErrNotFound
		}
		return nil, domainshared.Internal("查询用户失败", err)
	}
	return toDomain(po)
}

// FindByUsername 按用户名查找用户
func (r *UserRepository) FindByUsername(ctx context.Context, username user.Username) (*user.User, error) {
	var po model.User
	err := r.db.WithContext(ctx).Where("username = ?", username.String()).First(&po).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, user.ErrNotFound
		}
		return nil, domainshared.Internal("查询用户失败", err)
	}
	return toDomain(po)
}

// ListContacts 按用户名或展示名列出可聊天用户。
func (r *UserRepository) ListContacts(ctx context.Context, query string, excludeID domainshared.ID, afterUsername string, afterID domainshared.ID, limit int) ([]*user.User, error) {
	query = strings.TrimSpace(query)
	db := r.db.WithContext(ctx).
		Model(&model.User{}).
		Where("is_active = ?", true).
		Where("id <> ?", excludeID.UUID())
	if query != "" {
		like := "%" + query + "%"
		db = db.Where("(LOWER(username) LIKE LOWER(?) OR LOWER(display_name) LIKE LOWER(?))", like, like)
	}
	if afterUsername != "" && !afterID.IsZero() {
		db = db.Where("(username > ? OR (username = ? AND id > ?))", afterUsername, afterUsername, afterID.UUID())
	}
	var pos []model.User
	if err := db.Order("username ASC, id ASC").Limit(limit).Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("查询联系人失败", err)
	}
	users := make([]*user.User, 0, len(pos))
	for _, po := range pos {
		u, err := toDomain(po)
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

// ExistsByEmail 邮箱是否已存在
func (r *UserRepository) ExistsByEmail(ctx context.Context, email user.Email) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.User{}).
		Where("email = ?", email.String()).
		Count(&count).Error
	if err != nil {
		return false, domainshared.Internal("查询邮箱存在性失败", err)
	}
	return count > 0, nil
}

// ExistsByUsername 用户名是否已存在
func (r *UserRepository) ExistsByUsername(ctx context.Context, username user.Username) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.User{}).
		Where("username = ?", username.String()).
		Count(&count).Error
	if err != nil {
		return false, domainshared.Internal("查询用户名存在性失败", err)
	}
	return count > 0, nil
}

// Save 保存用户（新增或更新）
//
// 基于 ID 判断 upsert：ID 零值则插入（GORM 会生成新 UUID），否则更新。
// 当前实现使用 Save，GORM 会基于主键判断 insert/update。
func (r *UserRepository) Save(ctx context.Context, u *user.User) error {
	po := toPO(u)

	// 新用户（无 CreatedAt）由数据库填充默认时间
	if po.CreatedAt.IsZero() {
		po.CreatedAt = time.Now()
		po.UpdatedAt = time.Now()
	}

	if err := r.db.WithContext(ctx).Save(&po).Error; err != nil {
		return domainshared.Internal("保存用户失败", err)
	}
	return nil
}

// Delete 删除用户（硬删除）
func (r *UserRepository) Delete(ctx context.Context, id domainshared.ID) error {
	result := r.db.WithContext(ctx).Where("id = ?", id.UUID()).Delete(&model.User{})
	if result.Error != nil {
		return domainshared.Internal("删除用户失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return user.ErrNotFound
	}
	return nil
}

// Count 统计用户总数
func (r *UserRepository) Count(ctx context.Context) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&model.User{}).Count(&count).Error; err != nil {
		return 0, domainshared.Internal("统计用户总数失败", err)
	}
	return count, nil
}

// 编译期断言：UserRepository 实现领域端口
var _ user.UserRepository = (*UserRepository)(nil)
