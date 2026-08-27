package model

import (
	"time"

	"github.com/google/uuid"
)

// Gallery 图集持久化模型（对应 galleries 表，migration 110）。
type Gallery struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	OwnerID     uuid.UUID  `gorm:"type:uuid;column:owner_id;not null" json:"owner_id"`
	Title       string     `gorm:"type:varchar(255);not null" json:"title"`
	Description string     `gorm:"type:text;not null;default:''" json:"description"`
	CoverFileID *uuid.UUID `gorm:"type:uuid;column:cover_file_id" json:"cover_file_id,omitempty"`
	Status      string     `gorm:"type:varchar(16);not null;default:'published'" json:"status"`
	CreatedAt   time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt   time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (Gallery) TableName() string { return "galleries" }

// GalleryItem 图集媒体项持久化模型（对应 gallery_items 表，migration 111）。
//
// position 承载展示顺序（0 起升序）；主键 (gallery_id, file_id)。
type GalleryItem struct {
	GalleryID uuid.UUID `gorm:"type:uuid;column:gallery_id;primaryKey" json:"gallery_id"`
	FileID    uuid.UUID `gorm:"type:uuid;column:file_id;primaryKey" json:"file_id"`
	Caption   string    `gorm:"type:text;not null;default:''" json:"caption"`
	Position  int       `gorm:"column:position;not null" json:"position"`
	CreatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (GalleryItem) TableName() string { return "gallery_items" }
