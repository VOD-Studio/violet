package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// Notification 通知持久化模型（对应 notifications 表，migration 078）。
//
// 非规范化单表：每个接收者一行，零 JOIN 查询。
// nullable 语义：read_at NULL = 未读；非空 = 已读时间戳。
type Notification struct {
	ID         uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	UserID     uuid.UUID      `gorm:"type:uuid;column:user_id;not null" json:"user_id"`
	SourceType string         `gorm:"type:varchar(50);column:source_type;not null" json:"source_type"`
	SourceID   uuid.UUID      `gorm:"type:uuid;column:source_id;not null" json:"source_id"`
	Title      string         `gorm:"type:varchar(200);not null" json:"title"`
	Body       string         `gorm:"type:text;not null;default:''" json:"body"`
	Payload    datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"payload"`
	ReadAt     *time.Time     `gorm:"column:read_at" json:"read_at,omitempty"`
	CreatedAt  time.Time      `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}

// TableName 显式指定表名
func (Notification) TableName() string { return "notifications" }
