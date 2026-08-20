package chat

import (
	"context"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
	domainuser "blog-api/internal/domain/user"
)

// UserRepository 聊天所需的用户查询端口。
type UserRepository interface {
	FindByID(ctx context.Context, id domainshared.ID) (*domainuser.User, error)
	FindByIDs(ctx context.Context, ids []domainshared.ID) ([]*domainuser.User, error)
	FindByUsername(ctx context.Context, username domainuser.Username) (*domainuser.User, error)
}

// FileRepository 聊天图片归属与引用计数端口。
type FileRepository interface {
	FindByID(ctx context.Context, id domainshared.ID) (*domainupload.File, error)
	UpdateRefCount(ctx context.Context, id domainshared.ID, delta int) error
}

// EventNotifier 向在线聊天 SSE 连接广播事件。
type EventNotifier interface {
	Push(userID domainshared.ID, event EventDTO)
}

// PushSender 向浏览器推送系统通知。
type PushSender interface {
	Send(ctx context.Context, subscription *domainchat.PushSubscription, payload PushPayload) error
}

// PushPayload Web Push 载荷。
type PushPayload struct {
	// Title 系统通知标题。
	Title string `json:"title"`
	// Body 系统通知正文。
	Body string `json:"body"`
	// URL 点击通知后打开的路径。
	URL string `json:"url"`
	// Tag 浏览器通知聚合标签。
	Tag string `json:"tag"`
}

// NoopPushSender 测试用空推送发送器。
type NoopPushSender struct{}

// Send 丢弃推送请求。
func (NoopPushSender) Send(context.Context, *domainchat.PushSubscription, PushPayload) error {
	return nil
}
