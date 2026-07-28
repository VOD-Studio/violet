package subscription

import (
	"context"
	"time"

	"blog-api/internal/domain/shared"
)

// ErrNotFound 订阅不存在。
var ErrNotFound = shared.NotFound("订阅")

// SubscriptionRepository 订阅源 CRUD 端口。
//
// 所有写方法都按 (id, userID) 双键校验，防止跨用户改动他人订阅。
// FindDue / FindByIDForSchedule 不带 userID 校验——供调度器（系统行为）使用。
type SubscriptionRepository interface {
	// Save 创建或更新（按 ID upsert）。
	Save(ctx context.Context, s *Subscription) error
	// FindByID 按 ID 查单个订阅。第二参数 userID 做所有权校验，不匹配返回 ErrNotFound。
	FindByID(ctx context.Context, id, userID shared.ID) (*Subscription, error)
	// FindByIDForSchedule 按 ID 查订阅，不做所有权校验。仅供调度器（系统行为）使用。
	FindByIDForSchedule(ctx context.Context, id shared.ID) (*Subscription, error)
	// FindDue 查所有 due 订阅（status=active 且 next_fetch_at<=now 且 retry_after_until 已过）。
	// 仅供调度器使用。limit 上限由调用方钳制（worker pool 大小）。
	FindDue(ctx context.Context, now time.Time, limit int) ([]*Subscription, error)
	// FindByUser 列出某用户的所有订阅（可选按 status 过滤，空串=不过滤）。
	// 分页：page 从 1 起，limit 上限由调用方钳制。
	FindByUser(ctx context.Context, userID shared.ID, status string, page, limit int) ([]*Subscription, int64, error)
	// FindAll 列出全站订阅（admin 后台用，跨用户）。可选 status 过滤，分页。
	FindAll(ctx context.Context, status string, page, limit int) ([]*Subscription, int64, error)
	// Delete 按 (id, userID) 双键删除（防跨用户）。返回 ErrNotFound 表示无匹配。
	Delete(ctx context.Context, id, userID shared.ID) error
}
