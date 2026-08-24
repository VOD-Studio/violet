package chat

import (
	"context"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
	domainupload "blog-api/internal/domain/upload"
	domainuser "blog-api/internal/domain/user"
)

// UserRepository 聊天所需的用户查询端口。
type UserRepository interface {
	FindByID(ctx context.Context, id domainshared.ID) (*domainuser.User, error)
	FindByIDs(ctx context.Context, ids []domainshared.ID) ([]*domainuser.User, error)
	FindByUsername(ctx context.Context, username domainuser.Username) (*domainuser.User, error)
	ListContacts(ctx context.Context, query string, excludeID domainshared.ID, afterUsername string, afterID domainshared.ID, limit int) ([]*domainuser.User, error)
}

// FileRepository 聊天图片归属与引用计数端口。
type FileRepository interface {
	FindByID(ctx context.Context, id domainshared.ID) (*domainupload.File, error)
	UpdateRefCount(ctx context.Context, id domainshared.ID, delta int) error
}

// TweetRepository 聊天分享推文的查询端口（分享到聊天，只读）。
type TweetRepository interface {
	FindByID(ctx context.Context, id domainshared.ID) (*domaintweet.Tweet, error)
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

// CustomEmojiRefDTO 自定义表情解析结果（命名与含义镜像评论域 EmojiRef，仅取
// 渲染/菜单所需字段；聊天不复用评论/推文的 EmojiLookup——那是客户端全局 map
// 架构，聊天走本端口 + 共享 application/customemoji.Service 实现，见 PRD-0020）。
type CustomEmojiRefDTO struct {
	// URL 表情图片 URL；任意 viewer 均可见渲染结果，与 Relation 无关。
	URL string `json:"url"`
	// CustomEmojiID 表情 ID，供前端挂右键菜单操作目标（与 comment/tweet 域
	// EmojiRef.CustomEmojiID 同构，避免前端反解析 token key 提取 ID）。
	CustomEmojiID string `json:"custom_emoji_id"`
	// Relation viewer 与该表情的关系（owned/favorited/none），决定右键菜单项。
	Relation string `json:"relation"`
}

// CustomEmojiResolver 自定义表情批量解析端口（共享 application/customemoji.Service
// 实现，接口按域拆分避免直接依赖 customemoji 包）。
type CustomEmojiResolver interface {
	ResolveByIDs(ctx context.Context, ids []domainshared.ID, viewerID domainshared.ID) (map[domainshared.ID]CustomEmojiRefDTO, error)
}
