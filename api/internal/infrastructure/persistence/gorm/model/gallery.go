package model

import (
	"time"

	"github.com/google/uuid"
)

type Gallery struct {
	ID                  uuid.UUID  `gorm:"type:uuid;primaryKey"`
	AuthorID            uuid.UUID  `gorm:"type:uuid;column:author_id;not null"`
	Slug                *string    `gorm:"type:varchar(120);unique"`
	WorkingRevisionID   uuid.UUID  `gorm:"type:uuid;column:working_revision_id;not null"`
	PublishedRevisionID *uuid.UUID `gorm:"type:uuid;column:published_revision_id"`
	Version             int64      `gorm:"not null;default:1"`
	PublishedAt         *time.Time `gorm:"column:published_at"`
	CreatedAt           time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP"`
	UpdatedAt           time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP"`
}

func (Gallery) TableName() string { return "galleries" }

type GalleryRevision struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey"`
	GalleryID uuid.UUID `gorm:"type:uuid;column:gallery_id;not null"`
	Title     string    `gorm:"type:varchar(120);not null;default:''"`
	Summary   string    `gorm:"type:varchar(500);not null;default:''"`
	CreatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP"`
	UpdatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP"`
}

func (GalleryRevision) TableName() string { return "gallery_revisions" }

type GalleryRevisionItem struct {
	RevisionID      uuid.UUID `gorm:"type:uuid;column:revision_id;primaryKey"`
	FileID          uuid.UUID `gorm:"type:uuid;column:file_id;primaryKey"`
	Position        int       `gorm:"column:position;not null"`
	Caption         string    `gorm:"type:varchar(500);not null;default:''"`
	AltTextOverride string    `gorm:"type:varchar(300);column:alt_text_override;not null;default:''"`
}

func (GalleryRevisionItem) TableName() string { return "gallery_revision_items" }
