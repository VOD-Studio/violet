package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// Tweet 推文持久化模型（对应 tweets 表，migration 066）。
//
// 多用户微博短内容（PRD-0013）：纯文本 + 最多 4 张图，即发即出、
// 不可编辑（无更新路径，updated_at 恒等于 created_at）、物理删除。
type Tweet struct {
	ID        uuid.UUID                   `gorm:"type:uuid;primaryKey" json:"id"`
	AuthorID  uuid.UUID                   `gorm:"type:uuid;column:author_id;not null" json:"author_id"`
	Content   string                      `gorm:"type:text;not null;default:''" json:"content"`
	Images    datatypes.JSONSlice[string] `gorm:"type:jsonb;not null;default:'[]'" json:"images"`
	LikeCount int                         `gorm:"column:like_count;not null;default:0" json:"like_count"`
	CreatedAt time.Time                   `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time                   `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

// TableName 显式指定表名
func (Tweet) TableName() string { return "tweets" }
