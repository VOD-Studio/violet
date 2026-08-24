package gorm

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	domaincustomemoji "blog-api/internal/domain/customemoji"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// CustomEmojiRepository 自定义表情 GORM 仓储实现。
type CustomEmojiRepository struct {
	db *gorm.DB
}

// NewCustomEmojiRepository 构造自定义表情仓储。
func NewCustomEmojiRepository(db *gorm.DB) *CustomEmojiRepository {
	return &CustomEmojiRepository{db: db}
}

// Save 保存新创建的自定义表情。
func (r *CustomEmojiRepository) Save(ctx context.Context, e *domaincustomemoji.CustomEmoji) error {
	return r.db.WithContext(ctx).Create(customEmojiToPO(e)).Error
}

// FindByID 按 ID 查找单条（含已软删除；deleted_at 是普通列，非 gorm.DeletedAt，
// 故不受 GORM 自动软删除过滤影响，调用方按 IsUsable 判断可用性）。
func (r *CustomEmojiRepository) FindByID(ctx context.Context, id domainshared.ID) (*domaincustomemoji.CustomEmoji, error) {
	var po model.CustomEmoji
	if err := r.db.WithContext(ctx).Where("id = ?", id.UUID()).Take(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domaincustomemoji.ErrNotFound
		}
		return nil, err
	}
	return customEmojiToDomain(po), nil
}

// FindByIDs 批量按 ID 查找，仅返回未软删除的记录。
func (r *CustomEmojiRepository) FindByIDs(ctx context.Context, ids []domainshared.ID) ([]*domaincustomemoji.CustomEmoji, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	uuids := make([]interface{}, len(ids))
	for i, id := range ids {
		uuids[i] = id.UUID()
	}
	var rows []model.CustomEmoji
	if err := r.db.WithContext(ctx).Where("id IN ? AND deleted_at IS NULL", uuids).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]*domaincustomemoji.CustomEmoji, 0, len(rows))
	for _, po := range rows {
		out = append(out, customEmojiToDomain(po))
	}
	return out, nil
}

// ExistsByOwnerAndName 同一 ownerID 下是否已存在同名未软删除表情。
func (r *CustomEmojiRepository) ExistsByOwnerAndName(ctx context.Context, ownerID domainshared.ID, name string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.CustomEmoji{}).
		Where("owner_id = ? AND name = ? AND deleted_at IS NULL", ownerID.UUID(), name).
		Count(&count).Error
	return count > 0, err
}

// CountOwned 统计用户自传的未软删除表情数量。
func (r *CustomEmojiRepository) CountOwned(ctx context.Context, ownerID domainshared.ID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.CustomEmoji{}).
		Where("owner_id = ? AND deleted_at IS NULL", ownerID.UUID()).
		Count(&count).Error
	return count, err
}

// ListOwned 列出用户自传的未软删除表情，按创建时间倒序。
func (r *CustomEmojiRepository) ListOwned(ctx context.Context, ownerID domainshared.ID) ([]*domaincustomemoji.CustomEmoji, error) {
	var rows []model.CustomEmoji
	err := r.db.WithContext(ctx).
		Where("owner_id = ? AND deleted_at IS NULL", ownerID.UUID()).
		Order("created_at DESC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]*domaincustomemoji.CustomEmoji, 0, len(rows))
	for _, po := range rows {
		out = append(out, customEmojiToDomain(po))
	}
	return out, nil
}

// Delete 持久化软删除状态。
func (r *CustomEmojiRepository) Delete(ctx context.Context, e *domaincustomemoji.CustomEmoji) error {
	return r.db.WithContext(ctx).Model(&model.CustomEmoji{}).
		Where("id = ?", e.ID().UUID()).
		Update("deleted_at", e.DeletedAt()).Error
}

// AddFavorite 收藏一个表情（幂等：已收藏不报错，不产生重复行）。
func (r *CustomEmojiRepository) AddFavorite(ctx context.Context, userID, emojiID domainshared.ID) error {
	po := model.CustomEmojiFavorite{UserID: userID.UUID(), EmojiID: emojiID.UUID()}
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&po).Error
}

// RemoveFavorite 移出收藏（幂等：未收藏不报错）。
func (r *CustomEmojiRepository) RemoveFavorite(ctx context.Context, userID, emojiID domainshared.ID) error {
	return r.db.WithContext(ctx).
		Where("user_id = ? AND emoji_id = ?", userID.UUID(), emojiID.UUID()).
		Delete(&model.CustomEmojiFavorite{}).Error
}

// IsFavorited 用户是否收藏了指定表情。
func (r *CustomEmojiRepository) IsFavorited(ctx context.Context, userID, emojiID domainshared.ID) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.CustomEmojiFavorite{}).
		Where("user_id = ? AND emoji_id = ?", userID.UUID(), emojiID.UUID()).
		Count(&count).Error
	return count > 0, err
}

// CountFavorited 统计用户收藏的未软删除表情数量。
func (r *CustomEmojiRepository) CountFavorited(ctx context.Context, userID domainshared.ID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.CustomEmojiFavorite{}).
		Joins("JOIN custom_emojis ON custom_emojis.id = custom_emoji_favorites.emoji_id").
		Where("custom_emoji_favorites.user_id = ? AND custom_emojis.deleted_at IS NULL", userID.UUID()).
		Count(&count).Error
	return count, err
}

// ListFavorited 列出用户收藏的未软删除表情，按收藏时间倒序。
func (r *CustomEmojiRepository) ListFavorited(ctx context.Context, userID domainshared.ID) ([]*domaincustomemoji.CustomEmoji, error) {
	var rows []model.CustomEmoji
	err := r.db.WithContext(ctx).
		Joins("JOIN custom_emoji_favorites ON custom_emoji_favorites.emoji_id = custom_emojis.id").
		Where("custom_emoji_favorites.user_id = ? AND custom_emojis.deleted_at IS NULL", userID.UUID()).
		Order("custom_emoji_favorites.created_at DESC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]*domaincustomemoji.CustomEmoji, 0, len(rows))
	for _, po := range rows {
		out = append(out, customEmojiToDomain(po))
	}
	return out, nil
}

// FindFavoritedIDs 批量判断 userID 对 emojiIDs 中每个 ID 的收藏状态。
func (r *CustomEmojiRepository) FindFavoritedIDs(ctx context.Context, userID domainshared.ID, emojiIDs []domainshared.ID) (map[domainshared.ID]bool, error) {
	if len(emojiIDs) == 0 {
		return nil, nil
	}
	uuids := make([]interface{}, len(emojiIDs))
	for i, id := range emojiIDs {
		uuids[i] = id.UUID()
	}
	var rows []model.CustomEmojiFavorite
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND emoji_id IN ?", userID.UUID(), uuids).
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make(map[domainshared.ID]bool, len(rows))
	for _, po := range rows {
		out[domainshared.IDFromUUID(po.EmojiID)] = true
	}
	return out, nil
}

func customEmojiToPO(e *domaincustomemoji.CustomEmoji) *model.CustomEmoji {
	return &model.CustomEmoji{
		ID: e.ID().UUID(), OwnerID: e.OwnerID().UUID(), Name: e.Name(), URL: e.URL(),
		CreatedAt: e.CreatedAt(), DeletedAt: e.DeletedAt(),
	}
}

func customEmojiToDomain(po model.CustomEmoji) *domaincustomemoji.CustomEmoji {
	return domaincustomemoji.ReconstructCustomEmoji(
		domainshared.IDFromUUID(po.ID), domainshared.IDFromUUID(po.OwnerID), po.Name, po.URL, po.CreatedAt, po.DeletedAt,
	)
}

var _ domaincustomemoji.Repository = (*CustomEmojiRepository)(nil)
