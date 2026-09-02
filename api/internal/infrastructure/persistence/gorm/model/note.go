package model

import (
	"time"

	"github.com/google/uuid"
)

// Note 笔记表持久化模型
type Note struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey"`
	AuthorID    uuid.UUID  `gorm:"type:uuid;column:author_id;not null"`
	Title       string     `gorm:"type:varchar(120);not null;default:''"`
	ContentMD   string     `gorm:"type:text;column:content_md;not null"`
	ContentHTML string     `gorm:"type:text;column:content_html;not null;default:''"`
	Status      string     `gorm:"type:varchar(16);not null;default:'draft'"`
	PublishedAt *time.Time `gorm:"column:published_at"`
	CreatedAt   time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP"`
	UpdatedAt   time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP"`
	// 多对多关联标签（note_tags）
	Tags []Tag `gorm:"many2many:note_tags;"`
}

func (Note) TableName() string { return "notes" }
