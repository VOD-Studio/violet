package model

import (
	"time"

	"github.com/google/uuid"
)

// PublicationEntry 发布物投影持久化模型。
type PublicationEntry struct {
	Kind        string    `gorm:"type:varchar(16);primaryKey"`
	SourceID    uuid.UUID `gorm:"type:uuid;column:source_id;primaryKey"`
	RouteKey    string    `gorm:"type:varchar(255);column:route_key;not null"`
	Title       string    `gorm:"type:varchar(255);not null"`
	PublishedAt time.Time `gorm:"column:published_at;not null"`
	Featured    bool      `gorm:"not null;default:false"`
	CreatedAt   time.Time `gorm:"not null;default:CURRENT_TIMESTAMP"`
	UpdatedAt   time.Time `gorm:"not null;default:CURRENT_TIMESTAMP"`
}

func (PublicationEntry) TableName() string { return "publication_entries" }
