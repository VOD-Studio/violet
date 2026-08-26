package model

import (
	"time"

	"github.com/google/uuid"
)

// Series 系列书持久化模型（对应 series 表，migration 100）。
type Series struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	AuthorID    uuid.UUID `gorm:"type:uuid;column:author_id;not null" json:"author_id"`
	Title       string    `gorm:"type:varchar(255);not null" json:"title"`
	Slug        string    `gorm:"type:varchar(255);not null;unique" json:"slug"`
	Description string    `gorm:"type:text;not null;default:''" json:"description"`
	CoverImage  string    `gorm:"type:text;column:cover_image;not null;default:''" json:"cover_image"`
	Status      string    `gorm:"type:varchar(16);not null;default:'draft'" json:"status"`
	CreatedAt   time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt   time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

// TableName 显式指定表名
func (Series) TableName() string { return "series" }

// SeriesSection 书内卷/部持久化模型（对应 series_sections 表，migration 101）。
//
// sort_order 一书内唯一（部分由 uniq_series_sections_order 唯一索引约束）；
// 仓储两阶段写避开全量调序的中间态冲突。
type SeriesSection struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	SeriesID  uuid.UUID `gorm:"type:uuid;column:series_id;not null" json:"series_id"`
	Title     string    `gorm:"type:varchar(255);not null" json:"title"`
	SortOrder int       `gorm:"column:sort_order;not null;default:0" json:"sort_order"`
	CreatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}

// TableName 显式指定表名
func (SeriesSection) TableName() string { return "series_sections" }
