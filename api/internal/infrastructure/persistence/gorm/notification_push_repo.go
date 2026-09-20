package gorm

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	domainnotification "blog-api/internal/domain/notification"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// NotificationPushRepository 站内通知推送订阅的 GORM 实现。
type NotificationPushRepository struct {
	db *gorm.DB
}

// NewNotificationPushRepository 构造仓储。
func NewNotificationPushRepository(db *gorm.DB) *NotificationPushRepository {
	return &NotificationPushRepository{db: db}
}

// Save 按 endpoint upsert（同一浏览器重复授权覆盖密钥，不产生重复行）。
func (r *NotificationPushRepository) Save(ctx context.Context, sub *domainnotification.PushSubscription) error {
	po := &model.NotificationPushSubscription{
		UserID:    sub.UserID.UUID(),
		Endpoint:  sub.Endpoint,
		P256DH:    sub.P256DH,
		Auth:      sub.Auth,
		UserAgent: sub.UserAgent,
		CreatedAt: sub.CreatedAt,
		UpdatedAt: sub.UpdatedAt,
	}
	err := r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "endpoint"}},
		DoUpdates: clause.AssignmentColumns([]string{"user_id", "p256dh", "auth", "user_agent", "updated_at"}),
	}).Create(po).Error
	if err != nil {
		return domainshared.Internal("保存通知推送订阅失败", err)
	}
	return nil
}

// Delete 删除指定用户的某个订阅。
func (r *NotificationPushRepository) Delete(ctx context.Context, userID domainshared.ID, endpoint string) error {
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND endpoint = ?", userID.UUID(), endpoint).
		Delete(&model.NotificationPushSubscription{}).Error
	if err != nil {
		return domainshared.Internal("删除通知推送订阅失败", err)
	}
	return nil
}

// ListByUser 列出某用户的全部订阅。
func (r *NotificationPushRepository) ListByUser(ctx context.Context, userID domainshared.ID) ([]*domainnotification.PushSubscription, error) {
	var rows []model.NotificationPushSubscription
	if err := r.db.WithContext(ctx).Where("user_id = ?", userID.UUID()).Find(&rows).Error; err != nil {
		return nil, domainshared.Internal("查询通知推送订阅失败", err)
	}
	subs := make([]*domainnotification.PushSubscription, 0, len(rows))
	for _, row := range rows {
		subs = append(subs, &domainnotification.PushSubscription{
			UserID:    domainshared.IDFromUUID(row.UserID),
			Endpoint:  row.Endpoint,
			P256DH:    row.P256DH,
			Auth:      row.Auth,
			UserAgent: row.UserAgent,
			CreatedAt: row.CreatedAt,
			UpdatedAt: row.UpdatedAt,
		})
	}
	return subs, nil
}

var _ domainnotification.PushSubscriptionRepository = (*NotificationPushRepository)(nil)
