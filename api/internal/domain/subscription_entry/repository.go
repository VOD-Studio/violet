package subscription_entry

import (
	"context"

	"blog-api/internal/domain/shared"
)

// EntryRepository 订阅条目仓储端口。
//
// FetchOne 编排用它做去重（FindBySubAndGUID）+ 状态回写（Save）。
type EntryRepository interface {
	// Save 创建或更新条目。首次创建后回写自增 id（防重试撞 UNIQUE）。
	Save(ctx context.Context, e *SubscriptionEntry) error
	// FindBySubAndGUID 按 (subscription_id, guid) 查单条。无匹配返回 nil, nil（非 error）。
	FindBySubAndGUID(ctx context.Context, subscriptionID shared.ID, guid string) (*SubscriptionEntry, error)
}
