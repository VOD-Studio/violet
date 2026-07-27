package subscription_entry

import (
	"context"

	"blog-api/internal/domain/shared"
)

// EntryRepository 订阅条目仓储端口。
//
// FetchOne 编排用它做去重（FindPendingByGUID）+ 状态回写（Save）。
type EntryRepository interface {
	// Save 创建或更新条目（按 (subscription_id, guid) upsert 语义，由调用方先查再写）。
	Save(ctx context.Context, e *SubscriptionEntry) error
	// FindBySubAndGUID 按 (subscription_id, guid) 查单条。无匹配返回 nil, nil（非 error）。
	FindBySubAndGUID(ctx context.Context, subscriptionID shared.ID, guid string) (*SubscriptionEntry, error)
}
