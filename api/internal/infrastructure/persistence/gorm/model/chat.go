package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// ChatConversation 聊天会话持久化模型。
type ChatConversation struct {
	ID            uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	Kind          string     `gorm:"type:varchar(16);not null" json:"kind"`
	OwnerID       uuid.UUID  `gorm:"type:uuid;column:owner_id;not null" json:"owner_id"`
	Title         string     `gorm:"type:varchar(80);not null;default:''" json:"title"`
	LastMessageAt *time.Time `gorm:"column:last_message_at" json:"last_message_at,omitempty"`
	CreatedAt     time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt     time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

// TableName 显式指定表名。
func (ChatConversation) TableName() string { return "chat_conversations" }

// ChatConversationMember 会话成员持久化模型。
type ChatConversationMember struct {
	ConversationID uuid.UUID  `gorm:"type:uuid;column:conversation_id;primaryKey" json:"conversation_id"`
	UserID         uuid.UUID  `gorm:"type:uuid;column:user_id;primaryKey" json:"user_id"`
	Role           string     `gorm:"type:varchar(16);not null" json:"role"`
	JoinedAt       time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"joined_at"`
	LeftAt         *time.Time `gorm:"column:left_at" json:"left_at,omitempty"`
	IsMuted        bool       `gorm:"column:is_muted;not null;default:false" json:"is_muted"`
}

// TableName 显式指定表名。
func (ChatConversationMember) TableName() string { return "chat_conversation_members" }

// ChatDirectPair 一对一会话唯一配对持久化模型。
type ChatDirectPair struct {
	ConversationID uuid.UUID `gorm:"type:uuid;column:conversation_id;primaryKey" json:"conversation_id"`
	UserAID        uuid.UUID `gorm:"type:uuid;column:user_a_id;not null" json:"user_a_id"`
	UserBID        uuid.UUID `gorm:"type:uuid;column:user_b_id;not null" json:"user_b_id"`
}

// TableName 显式指定表名。
func (ChatDirectPair) TableName() string { return "chat_direct_pairs" }

// ChatMessage 聊天消息持久化模型。
type ChatMessage struct {
	ID             uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	ConversationID uuid.UUID  `gorm:"type:uuid;column:conversation_id;not null" json:"conversation_id"`
	SenderID       uuid.UUID  `gorm:"type:uuid;column:sender_id;not null" json:"sender_id"`
	MessageType    string     `gorm:"type:varchar(16);column:message_type;not null" json:"message_type"`
	Content        string     `gorm:"type:text;not null;default:''" json:"content"`
	MediaID        *uuid.UUID `gorm:"type:uuid;column:media_id" json:"media_id,omitempty"`
	SharedTweetID  *uuid.UUID `gorm:"type:uuid;column:shared_tweet_id" json:"shared_tweet_id,omitempty"`
	ReplyToID      *uuid.UUID `gorm:"type:uuid;column:reply_to_id" json:"reply_to_id,omitempty"`
	IdempotencyKey string     `gorm:"type:varchar(128);column:idempotency_key;not null" json:"-"`
	DeletedAt      *time.Time `gorm:"column:deleted_at" json:"deleted_at,omitempty"`
	DeletedBy      *uuid.UUID `gorm:"type:uuid;column:deleted_by" json:"deleted_by,omitempty"`
	CreatedAt      time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt      time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

// TableName 显式指定表名。
func (ChatMessage) TableName() string { return "chat_messages" }

// ChatMessageReaction 聊天消息反应持久化模型。
type ChatMessageReaction struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	MessageID uuid.UUID `gorm:"type:uuid;column:message_id;not null" json:"message_id"`
	EmojiID   int32     `gorm:"column:emoji_id;not null" json:"emoji_id"`
	UserID    uuid.UUID `gorm:"type:uuid;column:user_id;not null" json:"user_id"`
	CreatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}

// TableName 显式指定表名。
func (ChatMessageReaction) TableName() string { return "chat_message_reactions" }

// ChatReadPosition 用户阅读位置持久化模型。
type ChatReadPosition struct {
	ConversationID uuid.UUID  `gorm:"type:uuid;column:conversation_id;primaryKey" json:"conversation_id"`
	UserID         uuid.UUID  `gorm:"type:uuid;column:user_id;primaryKey" json:"user_id"`
	LastMessageID  *uuid.UUID `gorm:"type:uuid;column:last_message_id" json:"last_message_id,omitempty"`
	ReadAt         *time.Time `gorm:"column:read_at" json:"read_at,omitempty"`
}

// TableName 显式指定表名。
func (ChatReadPosition) TableName() string { return "chat_read_positions" }

// ChatEvent 用户聊天事件持久化模型。
type ChatEvent struct {
	Sequence  int64          `gorm:"primaryKey;autoIncrement" json:"sequence"`
	UserID    uuid.UUID      `gorm:"type:uuid;column:user_id;not null;index" json:"user_id"`
	EventType string         `gorm:"type:varchar(40);column:event_type;not null" json:"event_type"`
	Payload   datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"payload"`
	CreatedAt time.Time      `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}

// TableName 显式指定表名。
func (ChatEvent) TableName() string { return "chat_events" }

// ChatPushSubscription 浏览器推送订阅持久化模型。
type ChatPushSubscription struct {
	UserID      uuid.UUID `gorm:"type:uuid;column:user_id;not null;index" json:"user_id"`
	Endpoint    string    `gorm:"type:text;primaryKey" json:"endpoint"`
	P256DH      string    `gorm:"type:text;column:p256dh;not null" json:"p256dh"`
	Auth        string    `gorm:"type:text;not null" json:"auth"`
	UserAgent   string    `gorm:"type:text;column:user_agent;not null;default:''" json:"user_agent"`
	ShowPreview bool      `gorm:"column:show_preview;not null;default:false" json:"show_preview"`
	CreatedAt   time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt   time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

// TableName 显式指定表名。
func (ChatPushSubscription) TableName() string { return "chat_push_subscriptions" }
