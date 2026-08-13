package notification

import (
	"context"
	"time"

	domainshared "blog-api/internal/domain/shared"
)

// ErrNotFound 通知不存在。
var ErrNotFound = domainshared.NotFound("通知")

// NotificationRepository 通知仓储端口。
//
// 查询维度始终以 userID 为根（通知是 per-user 的私有数据）。
// 仓储接口供 application 层 subscriber + service 注入，infrastructure 层用 GORM 实现。
type NotificationRepository interface {
	// Save 创建通知（只新增，不更新——通知写入后不可变，只有 readAt 通过 MarkAsRead 改）。
	Save(ctx context.Context, n *Notification) error

	// FindByID 按 ID + userID 双键查（防跨用户读他人通知）。
	FindByID(ctx context.Context, id, userID domainshared.ID) (*Notification, error)

	// FindNotify 列出某用户的通知（分页，按 created_at 倒序）。
	FindNotify(ctx context.Context, userID domainshared.ID, page, limit int) ([]*Notification, int64, error)

	// CountUnread 统计未读数（服务端已读权威：read_at IS NULL 计数）。
	CountUnread(ctx context.Context, userID domainshared.ID) (int64, error)

	// MarkAsRead 标记单条已读（校验 userID 所有权）。
	MarkAsRead(ctx context.Context, id, userID domainshared.ID, now time.Time) error

	// MarkAllAsRead 标记某用户全部未读通知为已读。
	MarkAllAsRead(ctx context.Context, userID domainshared.ID, now time.Time) error

	// FindAfterID 查某用户在指定 ID 之后的通知（SSE 断连补发用）。
	FindAfterID(ctx context.Context, userID domainshared.ID, afterID domainshared.ID, limit int) ([]*Notification, error)
}
