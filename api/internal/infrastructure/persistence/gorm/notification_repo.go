package gorm

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"

	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	domainnotification "blog-api/internal/domain/notification"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// NotificationRepository 通知 GORM 实现。
type NotificationRepository struct {
	db *gorm.DB
}

// NewNotificationRepository 构造仓储。
func NewNotificationRepository(db *gorm.DB) *NotificationRepository {
	return &NotificationRepository{db: db}
}

// Save 创建通知（只新增）。
//
// (event_id, user_id) 冲突时静默跳过——同一领域事件重复分发/重放时
// 不产生重复通知（幂等）。GORM Create 走 INSERT ... ON CONFLICT DO NOTHING。
func (r *NotificationRepository) Save(ctx context.Context, n *domainnotification.Notification) error {
	po := notificationToPO(n)
	if err := r.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&po).Error; err != nil {
		return domainshared.Internal("保存通知失败", err)
	}
	n.SetID(domainshared.MustParseID(po.ID.String()))
	return nil
}

// FindByID 按 ID + userID 双键查（防跨用户读他人通知）。
func (r *NotificationRepository) FindByID(ctx context.Context, id, userID domainshared.ID) (*domainnotification.Notification, error) {
	var po model.Notification
	err := r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id.UUID(), userID.UUID()).
		First(&po).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domainnotification.ErrNotFound
		}
		return nil, domainshared.Internal("查询通知失败", err)
	}
	return notificationToDomain(po)
}

// FindPage 分页列出某用户的通知（created_at DESC + id DESC tiebreaker）。
func (r *NotificationRepository) FindPage(ctx context.Context, filter domainnotification.ListFilter, q domainshared.PageQuery) (domainshared.PageResult[*domainnotification.Notification], error) {
	q = q.Normalize()
	query := r.db.WithContext(ctx).Model(&model.Notification{}).
		Where("user_id = ?", filter.UserID.UUID())
	var pos []model.Notification
	total, err := countAndFind(query.Order("created_at DESC, id DESC"), q, &pos, "通知")
	if err != nil {
		return domainshared.PageResult[*domainnotification.Notification]{}, err
	}
	result := make([]*domainnotification.Notification, 0, len(pos))
	for _, po := range pos {
		n, err := notificationToDomain(po)
		if err != nil {
			return domainshared.PageResult[*domainnotification.Notification]{}, err
		}
		result = append(result, n)
	}
	return domainshared.NewPageResult(q, result, total), nil
}

// CountUnread 统计未读数。
func (r *NotificationRepository) CountUnread(ctx context.Context, userID domainshared.ID) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&model.Notification{}).
		Where("user_id = ? AND read_at IS NULL", userID.UUID()).
		Count(&count).Error; err != nil {
		return 0, domainshared.Internal("统计未读通知失败", err)
	}
	return count, nil
}

// MarkAsRead 标记单条已读（校验 userID 所有权）。
func (r *NotificationRepository) MarkAsRead(ctx context.Context, id, userID domainshared.ID, now time.Time) error {
	result := r.db.WithContext(ctx).Model(&model.Notification{}).
		Where("id = ? AND user_id = ? AND read_at IS NULL", id.UUID(), userID.UUID()).
		Update("read_at", now)
	if result.Error != nil {
		return domainshared.Internal("标记通知已读失败", result.Error)
	}
	if result.RowsAffected == 0 {
		// 可能不存在 / 不属于该用户 / 已读
		var exists bool
		err := r.db.WithContext(ctx).Model(&model.Notification{}).
			Select("1").
			Where("id = ? AND user_id = ?", id.UUID(), userID.UUID()).
			Limit(1).
			Find(&exists).Error
		if err != nil || !exists {
			return domainnotification.ErrNotFound
		}
		return domainnotification.ErrAlreadyRead
	}
	return nil
}

// MarkAllAsRead 标记某用户全部未读通知为已读。
func (r *NotificationRepository) MarkAllAsRead(ctx context.Context, userID domainshared.ID, now time.Time) error {
	err := r.db.WithContext(ctx).Model(&model.Notification{}).
		Where("user_id = ? AND read_at IS NULL", userID.UUID()).
		Update("read_at", now).Error
	if err != nil {
		return domainshared.Internal("全部标记已读失败", err)
	}
	return nil
}

// MarkUnreadBySourceAsRead 把某用户某来源对象的未读通知批量置已读。
func (r *NotificationRepository) MarkUnreadBySourceAsRead(ctx context.Context, userID domainshared.ID, sourceType domainnotification.SourceType, sourceID domainshared.ID, now time.Time) error {
	err := r.db.WithContext(ctx).Model(&model.Notification{}).
		Where("user_id = ? AND source_type = ? AND source_id = ? AND read_at IS NULL", userID.UUID(), string(sourceType), sourceID.UUID()).
		Update("read_at", now).Error
	if err != nil {
		return domainshared.Internal("按来源标记已读失败", err)
	}
	return nil
}

// FindAfterID 查某用户在指定 ID 之后的通知（SSE 断连补发用）。
func (r *NotificationRepository) FindAfterID(ctx context.Context, userID domainshared.ID, afterID domainshared.ID, limit int) ([]*domainnotification.Notification, error) {
	var pos []model.Notification
	if err := r.db.WithContext(ctx).
		Where("user_id = ? AND id > ?", userID.UUID(), afterID.UUID()).
		Order("created_at ASC").
		Limit(limit).
		Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("查询补发通知失败", err)
	}
	result := make([]*domainnotification.Notification, 0, len(pos))
	for _, po := range pos {
		n, err := notificationToDomain(po)
		if err != nil {
			return nil, err
		}
		result = append(result, n)
	}
	return result, nil
}

func notificationToPO(n *domainnotification.Notification) model.Notification {
	po := model.Notification{
		UserID:     n.UserID().UUID(),
		EventID:    n.EventID().UUID(),
		SourceType: string(n.SourceType()),
		SourceID:   n.SourceID().UUID(),
		Title:      n.Title(),
		Body:       n.Body(),
		ReadAt:     n.ReadAt(),
	}
	if id := n.GetID(); !id.IsZero() {
		po.ID = id.UUID()
	} else {
		po.ID = uuid.New()
	}
	// payload → JSONB
	if p := n.Payload(); len(p) > 0 {
		if b, err := json.Marshal(p); err == nil {
			po.Payload = datatypes.JSON(b)
		}
	}
	if c := n.CreatedAt(); !c.IsZero() {
		po.CreatedAt = c
	} else {
		po.CreatedAt = time.Now()
	}
	return po
}

// notificationToDomain 持久化模型 → 领域实体。
func notificationToDomain(po model.Notification) (*domainnotification.Notification, error) {
	var payload map[string]any
	if len(po.Payload) > 0 {
		_ = json.Unmarshal(po.Payload, &payload)
	}
	return domainnotification.Reconstruct(
		domainshared.MustParseID(po.ID.String()),
		domainshared.MustParseID(po.UserID.String()),
		domainshared.MustParseID(po.EventID.String()),
		domainnotification.SourceType(po.SourceType),
		domainshared.MustParseID(po.SourceID.String()),
		po.Title, po.Body, payload,
		po.ReadAt, po.CreatedAt,
	), nil
}

// 编译期断言：仓储实现满足领域接口。
var _ domainnotification.NotificationRepository = (*NotificationRepository)(nil)
