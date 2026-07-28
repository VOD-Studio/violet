package gorm

import (
	"context"
	"errors"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"

	domainsubscription "blog-api/internal/domain/subscription"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// SubscriptionRepository 订阅源 GORM 实现。
type SubscriptionRepository struct {
	db *gorm.DB
}

// NewSubscriptionRepository 构造仓储。
func NewSubscriptionRepository(db *gorm.DB) *SubscriptionRepository {
	return &SubscriptionRepository{db: db}
}

// Save 创建或更新订阅（按主键 upsert）。
func (r *SubscriptionRepository) Save(ctx context.Context, s *domainsubscription.Subscription) error {
	po := subscriptionToPO(s)
	// FullSaveAssociations=false：tags 是 JSONB 列不是关联，无需级联
	if err := r.db.WithContext(ctx).Save(&po).Error; err != nil {
		return domainshared.Internal("保存订阅失败", err)
	}
	return nil
}

// FindByID 按 ID + userID 双键查（防跨用户）。
func (r *SubscriptionRepository) FindByID(ctx context.Context, id, userID domainshared.ID) (*domainsubscription.Subscription, error) {
	var po model.Subscription
	err := r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id.UUID(), userID.UUID()).
		First(&po).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domainsubscription.ErrNotFound
		}
		return nil, domainshared.Internal("查询订阅失败", err)
	}
	return subscriptionToDomain(po)
}

// FindByIDForSchedule 按 ID 查订阅，不做所有权校验。仅供调度器（系统行为）使用。
func (r *SubscriptionRepository) FindByIDForSchedule(ctx context.Context, id domainshared.ID) (*domainsubscription.Subscription, error) {
	var po model.Subscription
	err := r.db.WithContext(ctx).First(&po, "id = ?", id.UUID()).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domainsubscription.ErrNotFound
		}
		return nil, domainshared.Internal("查询订阅失败", err)
	}
	return subscriptionToDomain(po)
}

// FindDue 查所有 due 订阅（active + next_fetch_at<=now + retry_after_until 已过或为空）。
// 注：当前未用 FOR UPDATE SKIP LOCKED——单进程调度器无竞争。
// 未来水平扩展（多 pod）时需加 SKIP LOCKED 防重复抓取（业界 Postgres job queue 共识）。
// 走 migration 061 的 idx_subscriptions_due 部分索引（WHERE status='active'）。
func (r *SubscriptionRepository) FindDue(ctx context.Context, now time.Time, limit int) ([]*domainsubscription.Subscription, error) {
	query := r.db.WithContext(ctx).
		Where("status = ? AND next_fetch_at <= ?", domainsubscription.StatusActive, now).
		Where("retry_after_until IS NULL OR retry_after_until <= ?", now).
		Order("next_fetch_at ASC").
		Limit(limit)
	var pos []model.Subscription
	if err := query.Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("查询 due 订阅失败", err)
	}
	result := make([]*domainsubscription.Subscription, 0, len(pos))
	for _, po := range pos {
		s, err := subscriptionToDomain(po)
		if err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, nil
}

// FindByUser 列出某用户的订阅（可选 status 过滤，分页）。
func (r *SubscriptionRepository) FindByUser(ctx context.Context, userID domainshared.ID, status string, page, limit int) ([]*domainsubscription.Subscription, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.Subscription{}).Where("user_id = ?", userID.UUID())
	if status != "" {
		query = query.Where("status = ?", status)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, domainshared.Internal("统计订阅失败", err)
	}
	var pos []model.Subscription
	offset := (page - 1) * limit
	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&pos).Error; err != nil {
		return nil, 0, domainshared.Internal("查询订阅列表失败", err)
	}
	result := make([]*domainsubscription.Subscription, 0, len(pos))
	for _, po := range pos {
		s, err := subscriptionToDomain(po)
		if err != nil {
			return nil, 0, err
		}
		result = append(result, s)
	}
	return result, total, nil
}

// FindAll 列出全站订阅（admin 后台用，跨用户）。可选 status 过滤，分页。
func (r *SubscriptionRepository) FindAll(ctx context.Context, status string, page, limit int) ([]*domainsubscription.Subscription, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.Subscription{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, domainshared.Internal("统计订阅失败", err)
	}
	var pos []model.Subscription
	offset := (page - 1) * limit
	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&pos).Error; err != nil {
		return nil, 0, domainshared.Internal("查询订阅列表失败", err)
	}
	result := make([]*domainsubscription.Subscription, 0, len(pos))
	for _, po := range pos {
		s, err := subscriptionToDomain(po)
		if err != nil {
			return nil, 0, err
		}
		result = append(result, s)
	}
	return result, total, nil
}

// Delete 按 (id, userID) 双键删（防跨用户）。
func (r *SubscriptionRepository) Delete(ctx context.Context, id, userID domainshared.ID) error {
	res := r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id.UUID(), userID.UUID()).
		Delete(&model.Subscription{})
	if res.Error != nil {
		return domainshared.Internal("删除订阅失败", res.Error)
	}
	if res.RowsAffected == 0 {
		return domainsubscription.ErrNotFound
	}
	return nil
}

// subscriptionToPO 领域实体 → 持久化模型。
func subscriptionToPO(s *domainsubscription.Subscription) model.Subscription {
	po := model.Subscription{
		ID:                  s.ID().UUID(),
		UserID:              s.UserID().UUID(),
		SourceType:          s.SourceType(),
		FeedURL:             s.FeedURL(),
		Title:               s.Title(),
		Interval:            s.Interval(),
		AutoPublish:         s.AutoPublish(),
		CanonicalOverride:   s.CanonicalOverride(),
		Tags:                datatypes.JSONSlice[string](s.Tags()),
		Status:              s.Status(),
		ConsecutiveFailures: s.ConsecutiveFailures(),
		LastError:           s.LastError(),
		LastFetchedAt:       s.LastFetchedAt(),
		NextFetchAt:         s.NextFetchAt(),
		RetryAfterUntil:     s.RetryAfterUntil(),
	}
	if c := s.CreatedAt(); !c.IsZero() {
		po.CreatedAt = c
		po.UpdatedAt = s.UpdatedAt()
	} else {
		po.CreatedAt = time.Now()
		po.UpdatedAt = time.Now()
	}
	return po
}

// subscriptionToDomain 持久化模型 → 领域实体。
func subscriptionToDomain(po model.Subscription) (*domainsubscription.Subscription, error) {
	tags := []string(po.Tags)
	return domainsubscription.Reconstruct(
		domainshared.MustParseID(po.ID.String()),
		domainshared.MustParseID(po.UserID.String()),
		po.SourceType, po.FeedURL, po.Title, po.Interval,
		po.AutoPublish, po.CanonicalOverride, tags,
		po.Status, po.ConsecutiveFailures, po.LastError,
		po.LastFetchedAt, po.NextFetchAt, po.RetryAfterUntil,
		po.CreatedAt, po.UpdatedAt,
	), nil
}

// 编译期断言：仓储实现满足领域接口。
var (
	_ domainsubscription.SubscriptionRepository = (*SubscriptionRepository)(nil)
)
