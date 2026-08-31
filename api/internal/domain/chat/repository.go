package chat

import (
	"context"
	"time"

	"blog-api/internal/domain/shared"
)

// ConversationCursor 会话列表游标。
type ConversationCursor struct {
	// UpdatedAt 上一页末会话更新时间。
	UpdatedAt time.Time
	// ID 上一页末会话 ID，用于同一时间戳下稳定排序。
	ID shared.ID
}

// MessageCursor 消息历史游标。
type MessageCursor struct {
	// CreatedAt 上一页末消息创建时间。
	CreatedAt time.Time
	// ID 上一页末消息 ID，用于同一时间戳下稳定排序。
	ID shared.ID
}

// ConversationRepository 聊天持久化端口。
type ConversationRepository interface {
	// FindByIDForMember 按会话 ID 查找当前有效成员可见的会话。
	FindByIDForMember(ctx context.Context, conversationID, userID shared.ID) (*Conversation, error)
	// FindDirect 查找两个用户之间已存在的一对一会话。
	FindDirect(ctx context.Context, userA, userB shared.ID) (*Conversation, error)
	// ListForMember 列出当前有效成员加入的会话。
	ListForMember(ctx context.Context, userID shared.ID, cursor *ConversationCursor, limit int) ([]*Conversation, error)
	// SaveConversation 保存新会话。
	SaveConversation(ctx context.Context, conversation *Conversation, members []*Member) error
	// RenameConversation 修改房间名称并更新时间。
	RenameConversation(ctx context.Context, conversation *Conversation) error
	// DeleteConversation 删除已无成员的私有房间。
	DeleteConversation(ctx context.Context, conversationID shared.ID) error
	// ListMembers 列出会话成员；includeInactive 控制是否包含已离开成员。
	ListMembers(ctx context.Context, conversationID shared.ID, includeInactive bool) ([]*Member, error)
	// FindMember 查找会话成员记录。
	FindMember(ctx context.Context, conversationID, userID shared.ID) (*Member, error)
	// SaveMember 新增或重新激活成员。
	SaveMember(ctx context.Context, member *Member) error
	// LeaveMember 标记成员离开。
	LeaveMember(ctx context.Context, conversationID, userID shared.ID, now time.Time) error
	// RemoveMember 标记成员被房主移除。
	RemoveMember(ctx context.Context, conversationID, userID shared.ID, now time.Time) error
	// TransferOwnership 原子更新会话房主及成员角色。
	TransferOwnership(ctx context.Context, conversationID, previousOwnerID, nextOwnerID shared.ID, now time.Time) error
	// SetMemberMuted 更新当前成员的会话通知静音状态。
	SetMemberMuted(ctx context.Context, conversationID, userID shared.ID, muted bool) error

	// SaveEvent 为指定用户追加聊天事件并返回持久化序号。
	SaveEvent(ctx context.Context, userIDs []shared.ID, eventType ChatEventType, payload map[string]any) ([]Event, error)
	FindMessageByIdempotency(ctx context.Context, conversationID, senderID shared.ID, key string) (*Message, error)
	// SaveMessage 保存消息、更新时间和成员事件。
	SaveMessage(ctx context.Context, message *Message, recipientIDs []shared.ID, payload map[string]any) ([]Event, error)
	// ListMessages 按创建时间倒序列出会话历史。
	ListMessages(ctx context.Context, conversationID shared.ID, cursor *MessageCursor, limit int) ([]*Message, error)
	// FindMessage 查找当前会话中的消息。
	FindMessage(ctx context.Context, conversationID, messageID shared.ID) (*Message, error)
	// DeleteMessage 标记管理员删除消息。
	DeleteMessage(ctx context.Context, message *Message) error
	// UpdateMessage 保存发送者的消息编辑结果（正文、编辑时间与媒体关联）。
	UpdateMessage(ctx context.Context, message *Message) error

	// SaveReadPosition 保存用户在会话中的阅读位置。
	SaveReadPosition(ctx context.Context, position *ReadPosition) error
	// CountUnread 统计用户在指定会话中的未读消息数。
	CountUnread(ctx context.Context, conversationID, userID shared.ID) (int64, error)
	// CountAllUnread 统计用户全部会话的未读消息数。
	CountAllUnread(ctx context.Context, userID shared.ID) (int64, error)

	// FindReadPosition 查找用户在会话中的阅读位置；从未标记过时返回 (nil, nil)。
	FindReadPosition(ctx context.Context, conversationID, userID shared.ID) (*ReadPosition, error)
	// ListMemberReadStates 列出会话当前有效成员的已读水位（含从未标记的成员）。
	ListMemberReadStates(ctx context.Context, conversationID shared.ID) ([]MemberReadState, error)

	// FindEventsAfter 查找用户事件流中指定序号之后的事件。
	FindEventsAfter(ctx context.Context, userID shared.ID, afterSequence int64, limit int) ([]Event, error)
	// SavePushSubscription 保存或更新浏览器推送订阅。
	SavePushSubscription(ctx context.Context, subscription *PushSubscription) error
	// DeletePushSubscription 删除失效的推送订阅。
	DeletePushSubscription(ctx context.Context, userID shared.ID, endpoint string) error
	// ListPushSubscriptions 列出用户全部推送订阅。
	ListPushSubscriptions(ctx context.Context, userID shared.ID) ([]*PushSubscription, error)
}

var (
	// ErrConversationNotFound 会话不存在或当前用户不可见。
	ErrConversationNotFound = shared.NotFound("会话")
	// ErrMemberNotFound 成员不存在或已离开。
	ErrMemberNotFound = shared.NotFound("会话成员")
	// ErrMessageNotFound 消息不存在或不属于会话。
	ErrMessageNotFound = shared.NotFound("消息")
	// ErrDirectConversationExists 私聊已存在时由应用层转为返回既有会话。
	ErrDirectConversationExists = shared.Conflict("私聊已存在")
)
