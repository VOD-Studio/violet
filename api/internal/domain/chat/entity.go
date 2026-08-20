// Package chat 定义站内集中式聊天的领域模型。
package chat

import (
	"strings"
	"time"

	"blog-api/internal/domain/shared"
)

// ConversationKind 会话形态。
type ConversationKind string

const (
	// ConversationDirect 一对一私聊。
	ConversationDirect ConversationKind = "direct"
	// ConversationRoom 私有多人房间。
	ConversationRoom ConversationKind = "room"
)

// IsValid 判断会话形态是否合法。
func (k ConversationKind) IsValid() bool { return k == ConversationDirect || k == ConversationRoom }

// MemberRole 会话成员角色。
type MemberRole string

const (
	// MemberOwner 房主，可管理房间成员与名称。
	MemberOwner MemberRole = "owner"
	// MemberMember 普通成员。
	MemberMember MemberRole = "member"
)

// MessageType 消息载体类型。
type MessageType string

const (
	// MessageText 文本消息。
	MessageText MessageType = "text"
	// MessageImage 图片消息。
	MessageImage MessageType = "image"
)

// ChatEventType 聊天事件类型。
type ChatEventType string

const (
	// EventMessageCreated 新消息事件。
	EventMessageCreated ChatEventType = "message.created"
	// EventRoomInvited 房间邀请事件。
	EventRoomInvited ChatEventType = "room.invited"
	// EventMemberChanged 成员变更事件。
	EventMemberChanged ChatEventType = "member.changed"
	// EventMessageDeleted 消息被管理员删除事件。
	EventMessageDeleted ChatEventType = "message.deleted"
)

// RoomInvited 私有房间成员邀请事实。
type RoomInvited struct {
	shared.BaseEvent
	// InviteeID 被邀请用户 ID。
	InviteeID shared.ID
	// Title 房间名称快照。
	Title string
}

// NewRoomInvited 创建房间邀请事件。
func NewRoomInvited(conversationID, inviteeID shared.ID, title string) RoomInvited {
	return RoomInvited{BaseEvent: shared.NewBaseEvent("chat.room.invited", conversationID), InviteeID: inviteeID, Title: title}
}

const (
	// MaxRoomTitleLength 房间名称最大字符数。
	MaxRoomTitleLength = 80
	// MaxMessageContentLength 文本消息最大字符数。
	MaxMessageContentLength = 10_000
	// MaxIdempotencyKeyLength 幂等键最大字节数。
	MaxIdempotencyKeyLength = 128
)

// Conversation 会话聚合根。
//
// direct 会话的 ownerID 仅记录创建者；room 会话的 ownerID 具有房主管理语义。
type Conversation struct {
	shared.AggregateRoot
	// kind 会话形态：direct 或 room。
	kind ConversationKind
	// ownerID 创建者；room 会话中同时是房主。
	ownerID shared.ID
	// title 房间名称；direct 会话为空。
	title string
	// lastMessageAt 最近一条消息时间；空值表示尚未发送消息。
	lastMessageAt *time.Time
	// timestamps 会话创建与更新时间。
	shared.Timestamps
}

// NewConversation 创建会话。
func NewConversation(kind ConversationKind, ownerID shared.ID, title string, now time.Time) (*Conversation, error) {
	if !kind.IsValid() {
		return nil, shared.BadRequest("非法会话类型")
	}
	if ownerID.IsZero() {
		return nil, shared.BadRequest("会话创建者不能为空")
	}
	if kind == ConversationDirect {
		title = ""
	} else {
		title = strings.TrimSpace(title)
		if title == "" {
			return nil, shared.BadRequest("房间名称不能为空")
		}
		if len([]rune(title)) > MaxRoomTitleLength {
			return nil, shared.BadRequest("房间名称过长")
		}
	}
	conversation := &Conversation{
		kind: kind, ownerID: ownerID, title: title,
		Timestamps: shared.Timestamps{CreatedAt: now, UpdatedAt: now},
	}
	conversation.SetID(shared.NewID())
	return conversation, nil
}

// ReconstructConversation 从持久化数据重建会话。
func ReconstructConversation(id, ownerID shared.ID, kind ConversationKind, title string, lastMessageAt *time.Time, createdAt, updatedAt time.Time) *Conversation {
	c := &Conversation{
		kind: kind, ownerID: ownerID, title: title, lastMessageAt: lastMessageAt,
		Timestamps: shared.Timestamps{CreatedAt: createdAt, UpdatedAt: updatedAt},
	}
	c.SetID(id)
	return c
}

// Rename 更新房间名称。
func (c *Conversation) Rename(title string, now time.Time) error {
	if c.kind != ConversationRoom {
		return shared.BadRequest("私聊不能修改房间名称")
	}
	title = strings.TrimSpace(title)
	if title == "" || len([]rune(title)) > MaxRoomTitleLength {
		return shared.BadRequest("房间名称无效")
	}
	c.title = title
	c.UpdatedAt = now
	return nil
}

// TransferOwnership 将房主职责转给当前有效成员。
func (c *Conversation) TransferOwnership(userID shared.ID, now time.Time) error {
	if c.kind != ConversationRoom {
		return shared.BadRequest("私聊不能转移房主")
	}
	if userID.IsZero() {
		return shared.BadRequest("房主不能为空")
	}
	c.ownerID = userID
	c.UpdatedAt = now
	return nil
}

// TouchMessage 更新会话最近消息时间。
func (c *Conversation) TouchMessage(at time.Time) {
	c.lastMessageAt = &at
	c.UpdatedAt = at
}

// ID 返回会话 ID。
func (c *Conversation) ID() shared.ID { return c.GetID() }

// Kind 返回会话形态。
func (c *Conversation) Kind() ConversationKind { return c.kind }

// OwnerID 返回创建者/房主 ID。
func (c *Conversation) OwnerID() shared.ID { return c.ownerID }

// Title 返回房间名称。
func (c *Conversation) Title() string { return c.title }

// LastMessageAt 返回最近消息时间。
func (c *Conversation) LastMessageAt() *time.Time { return c.lastMessageAt }

// Member 会话成员实体。
type Member struct {
	// conversationID 所属会话 ID。
	conversationID shared.ID
	// userID 成员用户 ID。
	userID shared.ID
	// role 成员角色。
	role MemberRole
	// joinedAt 首次加入时间。
	joinedAt time.Time
	// leftAt 离开时间；非空表示当前不在会话中。
	leftAt *time.Time
	// muted 是否静音该会话的系统通知。
	muted bool
}

// NewMember 创建成员。
func NewMember(conversationID, userID shared.ID, role MemberRole, joinedAt time.Time) (*Member, error) {
	if conversationID.IsZero() || userID.IsZero() {
		return nil, shared.BadRequest("成员归属不能为空")
	}
	if role != MemberOwner && role != MemberMember {
		return nil, shared.BadRequest("非法成员角色")
	}
	return &Member{conversationID: conversationID, userID: userID, role: role, joinedAt: joinedAt}, nil
}

// ReconstructMember 从持久化数据重建成员。
func ReconstructMember(conversationID, userID shared.ID, role MemberRole, joinedAt time.Time, leftAt *time.Time, muted bool) *Member {
	return &Member{conversationID: conversationID, userID: userID, role: role, joinedAt: joinedAt, leftAt: leftAt, muted: muted}
}

// Leave 标记成员离开。
func (m *Member) Leave(now time.Time) { m.leftAt = &now }

// Reactivate 重新加入会话。
func (m *Member) Reactivate(now time.Time) { m.leftAt = nil; m.joinedAt = now }

// ConversationID 返回会话 ID。
func (m *Member) ConversationID() shared.ID { return m.conversationID }

// UserID 返回用户 ID。
func (m *Member) UserID() shared.ID { return m.userID }

// Role 返回成员角色。
func (m *Member) Role() MemberRole { return m.role }

// PromoteToOwner 将成员提升为房主。
func (m *Member) PromoteToOwner() { m.role = MemberOwner }

// DemoteToMember 将房主降为普通成员。
func (m *Member) DemoteToMember() { m.role = MemberMember }

// JoinedAt 返回加入时间。
func (m *Member) JoinedAt() time.Time { return m.joinedAt }

// LeftAt 返回离开时间。
func (m *Member) LeftAt() *time.Time { return m.leftAt }

// IsActive 判断成员是否仍在会话中。
func (m *Member) IsActive() bool { return m.leftAt == nil }

// SetMuted 设置当前成员的系统通知静音状态。
func (m *Member) SetMuted(muted bool) { m.muted = muted }

// IsMuted 判断当前成员是否静音会话通知。
func (m *Member) IsMuted() bool { return m.muted }

// Message 会话消息实体。
type Message struct {
	shared.AggregateRoot
	// conversationID 所属会话 ID。
	conversationID shared.ID
	// senderID 发送者 ID，创建后不可变。
	senderID shared.ID
	// messageType 消息类型：text 或 image。
	messageType MessageType
	// content 文本内容；图片消息为空。
	content string
	// mediaID 图片消息引用的上传文件 ID。
	mediaID *shared.ID
	// idempotencyKey 客户端发送幂等键。
	idempotencyKey string
	// deletedAt 管理员删除时间；非空表示内容已删除。
	deletedAt *time.Time
	// deletedBy 执行删除的管理员 ID。
	deletedBy *shared.ID
	// timestamps 消息创建与更新时间。
	shared.Timestamps
}

// NewTextMessage 创建文本消息。
func NewTextMessage(conversationID, senderID shared.ID, content, idempotencyKey string, now time.Time) (*Message, error) {
	content = strings.TrimSpace(content)
	if conversationID.IsZero() || senderID.IsZero() {
		return nil, shared.BadRequest("消息归属不能为空")
	}
	if content == "" || len([]rune(content)) > MaxMessageContentLength {
		return nil, shared.BadRequest("文本消息无效")
	}
	if err := validateIdempotencyKey(idempotencyKey); err != nil {
		return nil, err
	}
	return newMessage(conversationID, senderID, MessageText, content, nil, idempotencyKey, now), nil
}

// NewImageMessage 创建图片消息。
func NewImageMessage(conversationID, senderID, mediaID shared.ID, idempotencyKey string, now time.Time) (*Message, error) {
	if conversationID.IsZero() || senderID.IsZero() || mediaID.IsZero() {
		return nil, shared.BadRequest("图片消息参数不完整")
	}
	if err := validateIdempotencyKey(idempotencyKey); err != nil {
		return nil, err
	}
	return newMessage(conversationID, senderID, MessageImage, "", &mediaID, idempotencyKey, now), nil
}

func newMessage(conversationID, senderID shared.ID, messageType MessageType, content string, mediaID *shared.ID, idempotencyKey string, now time.Time) *Message {
	m := &Message{
		conversationID: conversationID, senderID: senderID, messageType: messageType,
		content: content, mediaID: mediaID, idempotencyKey: idempotencyKey,
		Timestamps: shared.Timestamps{CreatedAt: now, UpdatedAt: now},
	}
	m.SetID(shared.NewID())
	return m
}

func validateIdempotencyKey(key string) error {
	key = strings.TrimSpace(key)
	if key == "" || len(key) > MaxIdempotencyKeyLength {
		return shared.BadRequest("Idempotency-Key 无效")
	}
	return nil
}

// ReconstructMessage 从持久化数据重建消息。
func ReconstructMessage(id, conversationID, senderID shared.ID, messageType MessageType, content string, mediaID *shared.ID, idempotencyKey string, deletedAt *time.Time, deletedBy *shared.ID, createdAt, updatedAt time.Time) *Message {
	m := &Message{
		conversationID: conversationID, senderID: senderID, messageType: messageType,
		content: content, mediaID: mediaID, idempotencyKey: idempotencyKey,
		deletedAt: deletedAt, deletedBy: deletedBy,
		Timestamps: shared.Timestamps{CreatedAt: createdAt, UpdatedAt: updatedAt},
	}
	m.SetID(id)
	return m
}

// Delete 标记消息已被管理员删除。
func (m *Message) Delete(adminID shared.ID, now time.Time) error {
	if adminID.IsZero() {
		return shared.BadRequest("删除者不能为空")
	}
	if m.deletedAt != nil {
		return shared.Conflict("消息已删除")
	}
	m.deletedAt = &now
	m.deletedBy = &adminID
	m.UpdatedAt = now
	return nil
}

// ID 返回消息 ID。
func (m *Message) ID() shared.ID { return m.GetID() }

// ConversationID 返回会话 ID。
func (m *Message) ConversationID() shared.ID { return m.conversationID }

// SenderID 返回发送者 ID。
func (m *Message) SenderID() shared.ID { return m.senderID }

// Type 返回消息类型。
func (m *Message) Type() MessageType { return m.messageType }

// Content 返回文本内容。
func (m *Message) Content() string { return m.content }

// MediaID 返回图片媒体 ID。
func (m *Message) MediaID() *shared.ID { return m.mediaID }

// IdempotencyKey 返回客户端幂等键。
func (m *Message) IdempotencyKey() string { return m.idempotencyKey }

// DeletedAt 返回删除时间。
func (m *Message) DeletedAt() *time.Time { return m.deletedAt }

// DeletedBy 返回删除者 ID。
func (m *Message) DeletedBy() *shared.ID { return m.deletedBy }

// CreatedAt 返回创建时间。
func (m *Message) CreatedAt() time.Time { return m.Timestamps.CreatedAt }

// ReadPosition 用户在会话中的阅读位置。
type ReadPosition struct {
	// conversationID 会话 ID。
	conversationID shared.ID
	// userID 用户 ID。
	userID shared.ID
	// lastMessageID 用户读到的最后一条消息 ID。
	lastMessageID *shared.ID
	// readAt 最近标记阅读位置的时间。
	readAt *time.Time
}

// ReconstructReadPosition 从持久化数据重建阅读位置。
func ReconstructReadPosition(conversationID, userID shared.ID, lastMessageID *shared.ID, readAt *time.Time) *ReadPosition {
	return &ReadPosition{conversationID: conversationID, userID: userID, lastMessageID: lastMessageID, readAt: readAt}
}

// ConversationID 返回会话 ID。
func (p *ReadPosition) ConversationID() shared.ID { return p.conversationID }

// UserID 返回用户 ID。
func (p *ReadPosition) UserID() shared.ID { return p.userID }

// LastMessageID 返回最后阅读消息 ID。
func (p *ReadPosition) LastMessageID() *shared.ID { return p.lastMessageID }

// ReadAt 返回阅读时间。
func (p *ReadPosition) ReadAt() *time.Time { return p.readAt }

// Event 持久化的用户聊天事件，用于 SSE 补发。
type Event struct {
	// Sequence 全局单调递增事件序号。
	Sequence int64
	// UserID 事件接收者。
	UserID shared.ID
	// Type 事件类型。
	Type ChatEventType
	// Payload 事件结构化数据。
	Payload map[string]any
	// CreatedAt 事件创建时间。
	CreatedAt time.Time
}

// PushSubscription 浏览器 Web Push 订阅。
type PushSubscription struct {
	// UserID 订阅所属用户。
	UserID shared.ID
	// Endpoint 推送服务 endpoint。
	Endpoint string
	// P256DH 浏览器公钥。
	P256DH string
	// Auth 浏览器认证密钥。
	Auth string
	// UserAgent 订阅设备标识，可空。
	UserAgent string
	// ShowPreview 是否允许系统通知显示消息摘要。
	ShowPreview bool
	// CreatedAt 首次注册时间。
	CreatedAt time.Time
	// UpdatedAt 最近更新时间。
	UpdatedAt time.Time
}
