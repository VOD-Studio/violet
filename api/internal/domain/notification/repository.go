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

	// FindPage 分页列出某用户的通知（created_at DESC + id DESC tiebreaker）。
	FindPage(ctx context.Context, filter ListFilter, q domainshared.PageQuery) (domainshared.PageResult[*Notification], error)

	// CountUnread 统计未读数（服务端已读权威：read_at IS NULL 计数）。
	CountUnread(ctx context.Context, userID domainshared.ID) (int64, error)

	// MarkAsRead 标记单条已读（校验 userID 所有权）。
	MarkAsRead(ctx context.Context, id, userID domainshared.ID, now time.Time) error

	// MarkAllAsRead 标记某用户全部未读通知为已读。
	MarkAllAsRead(ctx context.Context, userID domainshared.ID, now time.Time) error

	// MarkUnreadBySourceAsRead 把某用户某来源对象的未读通知批量置已读。
	//
	// 用途：聊天消息通知的折叠（同会话新通知到达时旧未读置已读）与
	// 已读同步（用户在 /chat 读完会话后清掉铃铛里的对应未读）。
	MarkUnreadBySourceAsRead(ctx context.Context, userID domainshared.ID, sourceType SourceType, sourceID domainshared.ID, now time.Time) error

	// FindAfterID 查某用户在指定 ID 之后的通知（SSE 断连补发用）。
	FindAfterID(ctx context.Context, userID domainshared.ID, afterID domainshared.ID, limit int) ([]*Notification, error)
}

// ListFilter 通知列表筛选条件（FindPage 入参）。
//
// 通知是 per-user 的私有数据，UserID 为必填维度（无「全站通知」场景）。
type ListFilter struct {
	// UserID 所属用户 ID，必填（通知列表始终以用户为根）
	UserID domainshared.ID
}
