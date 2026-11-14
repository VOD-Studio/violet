package gorm

import (
	"context"
	"time"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ChatUserSettingsRepository 聊天用户设置的 GORM 实现。
type ChatUserSettingsRepository struct {
	db *gorm.DB
}

var _ domainchat.UserSettingsRepository = (*ChatUserSettingsRepository)(nil)

func NewChatUserSettingsRepository(db *gorm.DB) *ChatUserSettingsRepository {
	return &ChatUserSettingsRepository{db: db}
}

// HiddenOnline 返回 ids 中选择隐身的用户。
func (r *ChatUserSettingsRepository) HiddenOnline(ctx context.Context, ids []domainshared.ID) (map[domainshared.ID]bool, error) {
	out := map[domainshared.ID]bool{}
	if len(ids) == 0 {
		return out, nil
	}
	uuids := make([]uuid.UUID, 0, len(ids))
	for _, id := range ids {
		uuids = append(uuids, id.UUID())
	}
	var rows []model.ChatUserSettings
	if err := r.db.WithContext(ctx).Where("hide_online AND user_id IN ?", uuids).Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		out[domainshared.IDFromUUID(row.UserID)] = true
	}
	return out, nil
}

// SetHideOnline 以 user_id 为键 upsert 隐身设置。
func (r *ChatUserSettingsRepository) SetHideOnline(ctx context.Context, userID domainshared.ID, hide bool) error {
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"hide_online", "updated_at"}),
	}).Create(&model.ChatUserSettings{UserID: userID.UUID(), HideOnline: hide, UpdatedAt: time.Now()}).Error
}
