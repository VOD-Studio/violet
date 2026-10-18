package model

import (
	"time"

	"github.com/google/uuid"
)

type RoadmapItem struct {
	BaseModel
	ProjectID        uuid.UUID  `gorm:"type:uuid;not null"`
	Number           int64      `gorm:"not null"`
	Title            string     `gorm:"type:text;not null"`
	Description      string     `gorm:"type:text;not null"`
	Stage            string     `gorm:"type:text;not null"`
	Position         string     `gorm:"type:text;not null"`
	Tags             string     `gorm:"type:jsonb;not null"`
	Links            string     `gorm:"type:jsonb;not null"`
	Checklist        string     `gorm:"type:jsonb;not null"`
	CompletionDate   *time.Time `gorm:"type:date"`
	DeliveredVersion string     `gorm:"type:text;not null"`
	DeletedAt        *time.Time
}

func (RoadmapItem) TableName() string { return "roadmap_items" }
