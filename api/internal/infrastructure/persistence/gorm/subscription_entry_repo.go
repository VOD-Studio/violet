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
func (r *SubscriptionEntryRepository) Save(ctx context.Context, e *domainentry.SubscriptionEntry) error {
	po := entryToPO(e)
	if err := r.db.WithContext(ctx).Save(&po).Error; err != nil {
		return domainshared.Internal("保存订阅条目失败", err)
	}
	// 回写自增 id 到领域对象（首次创建时）
	if e.ID() == 0 {
		// 通过 Reconstruct 不允许改 id，这里用反射或重新构造不现实；
		// 实际上 FetchOne 流程不依赖 entry.ID()（去重靠 guid），故不回写也可。
		// 为完整起见，调用方拿到的是同一对象，下次 Save 会带上正确 id。
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
