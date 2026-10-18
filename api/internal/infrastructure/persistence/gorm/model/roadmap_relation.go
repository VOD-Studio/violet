package model

import (
	"time"

	"github.com/google/uuid"
)

type RoadmapRelation struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey"`
	ProjectID uuid.UUID `gorm:"type:uuid;not null"`
	SourceID  uuid.UUID `gorm:"type:uuid;not null"`
	TargetID  uuid.UUID `gorm:"type:uuid;not null"`
	Type      string    `gorm:"not null"`
	CreatedAt time.Time
}

func (RoadmapRelation) TableName() string { return "roadmap_relations" }
