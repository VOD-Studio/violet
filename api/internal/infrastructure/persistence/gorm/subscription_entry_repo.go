package gorm

import (
	"context"
	"errors"

	"gorm.io/gorm"

	domainentry "blog-api/internal/domain/subscription_entry"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// SubscriptionEntryRepository 订阅条目 GORM 实现。
type SubscriptionEntryRepository struct {
	db *gorm.DB
}

// NewSubscriptionEntryRepository 构造仓储。
func NewSubscriptionEntryRepository(db *gorm.DB) *SubscriptionEntryRepository {
	return &SubscriptionEntryRepository{db: db}
}

// Save 创建或更新条目。按主键 upsert（id=0 时创建，非 0 时更新）。
// 首次创建后回写自增 id 到领域对象，避免后续 Save 误当新建撞 UNIQUE(subscription_id, guid)。
func (r *SubscriptionEntryRepository) Save(ctx context.Context, e *domainentry.SubscriptionEntry) error {
	po := entryToPO(e)
	if err := r.db.WithContext(ctx).Save(&po).Error; err != nil {
		return domainshared.Internal("保存订阅条目失败", err)
	}
	// 回写 DB 分配的自增 id（首次创建，领域对象 id=0 → po.ID 非 0）
	if e.ID() == 0 && po.ID != 0 {
		e.SetID(po.ID)
	}
	return nil
}

// FindBySubAndGUID 按 (subscription_id, guid) 查单条。无匹配返回 nil, nil。
func (r *SubscriptionEntryRepository) FindBySubAndGUID(ctx context.Context, subscriptionID domainshared.ID, guid string) (*domainentry.SubscriptionEntry, error) {
	var po model.SubscriptionEntry
	err := r.db.WithContext(ctx).
		Where("subscription_id = ? AND guid = ?", subscriptionID.UUID(), guid).
		First(&po).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil // 无匹配是正常情况，非 error
		}
		return nil, domainshared.Internal("查询订阅条目失败", err)
	}
	return entryToDomain(po), nil
}

// entryToPO 领域 → PO。
func entryToPO(e *domainentry.SubscriptionEntry) model.SubscriptionEntry {
	po := model.SubscriptionEntry{
		ID:             e.ID(),
		SubscriptionID: e.SubscriptionID().UUID(),
		GUID:           e.GUID(),
		EntryURL:       e.EntryURL(),
		Title:          e.Title(),
		Status:         e.Status(),
		FailCount:      e.FailCount(),
		LastError:      e.LastError(),
		PublishedAt:    e.PublishedAt(),
	}
	if e.PostID() != nil {
		pid := e.PostID().UUID()
		po.PostID = &pid
	}
	return po
}

// entryToDomain PO → 领域。
func entryToDomain(po model.SubscriptionEntry) *domainentry.SubscriptionEntry {
	var postID *domainshared.ID
	if po.PostID != nil {
		pid := domainshared.MustParseID(po.PostID.String())
		postID = &pid
	}
	subID := domainshared.MustParseID(po.SubscriptionID.String())
	return domainentry.Reconstruct(
		po.ID, subID, po.GUID, po.EntryURL, po.Title,
		postID, po.Status, po.FailCount, po.LastError,
		po.PublishedAt, po.CreatedAt,
	)
}

// 编译期断言。
var _ domainentry.EntryRepository = (*SubscriptionEntryRepository)(nil)
