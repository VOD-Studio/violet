package model

import (
	"time"

	"github.com/google/uuid"
)

// CustomEmoji 自定义表情持久化模型。
type CustomEmoji struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	OwnerID   uuid.UUID  `gorm:"type:uuid;column:owner_id;not null" json:"owner_id"`
	Name      string     `gorm:"type:varchar(50);not null" json:"name"`
	URL       string     `gorm:"type:varchar(512);not null" json:"url"`
	CreatedAt time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	DeletedAt *time.Time `gorm:"column:deleted_at" json:"deleted_at,omitempty"`
}

// TableName 显式指定表名。
func (CustomEmoji) TableName() string { return "custom_emojis" }

// CustomEmojiFavorite 自定义表情收藏关系持久化模型。
type CustomEmojiFavorite struct {
	UserID    uuid.UUID `gorm:"type:uuid;column:user_id;primaryKey" json:"user_id"`
	EmojiID   uuid.UUID `gorm:"type:uuid;column:emoji_id;primaryKey" json:"emoji_id"`
	CreatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}

// TableName 显式指定表名。
func (CustomEmojiFavorite) TableName() string { return "custom_emoji_favorites" }
