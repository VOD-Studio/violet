// Package model 定义 GORM 数据模型
package model

import (
	"time"

	"github.com/google/uuid"
)

// Comment 评论模型
type Comment struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	PostID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"post_id"`
	ParentID    *uuid.UUID     `gorm:"type:uuid;index" json:"parent_id"`
	Path        string         `gorm:"type:text;not null;index" json:"path"`
	Depth       int16          `gorm:"type:smallint;not null;default:0" json:"depth"`
	AuthorName  string         `gorm:"type:varchar(100);not null" json:"author_name"`
	AuthorEmail *string        `gorm:"type:varchar(255)" json:"author_email,omitempty"`
	AuthorURL   *string        `gorm:"type:text" json:"author_url,omitempty"`
	AvatarURL   *string        `gorm:"type:varchar(512)" json:"avatar_url,omitempty"`
	Body        string    `gorm:"type:text;not null" json:"body"`
	Pictures    []byte    `gorm:"type:jsonb;default:'[]'::jsonb" json:"pictures"`
	Status      string    `gorm:"type:varchar(20);not null;default:'pending';check:status IN ('pending','approved','spam','deleted')" json:"status"`
	IPHash      *string        `gorm:"type:varchar(64)" json:"-"`
	UserAgent   *string        `gorm:"type:text" json:"-"`
	CreatedAt   time.Time      `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt   time.Time      `gorm:"not null;default:now()" json:"updated_at"`
}

// TableName 指定表名
func (Comment) TableName() string {
	return "comments"
}

// CommentPicture 评论图片信息
type CommentPicture struct {
	URL    string  `json:"url"`
	Width  int     `json:"width"`
	Height int     `json:"height"`
	Size   float64 `json:"size"`
}
