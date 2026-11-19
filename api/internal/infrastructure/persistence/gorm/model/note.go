package model

import (
	"time"

	"github.com/google/uuid"
)

// Note 笔记表持久化模型
type Note struct {
	ID              uuid.UUID  `gorm:"type:uuid;primaryKey"`
	AuthorID        uuid.UUID  `gorm:"type:uuid;column:author_id;not null"`
	Title           string     `gorm:"type:varchar(120);not null;default:''"`
	ContentMD       string     `gorm:"type:text;column:content_md;not null"`
	ContentHTML     string     `gorm:"type:text;column:content_html;not null;default:''"`
	Status          string     `gorm:"type:varchar(16);not null;default:'draft'"`
	PublishedAt     *time.Time `gorm:"column:published_at"`
	CreatedAt       time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP"`
	UpdatedAt       time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP"`
	NoteType        string     `gorm:"type:varchar(16);not null;default:'unclassified'"`
	ProjectID       *uuid.UUID `gorm:"type:uuid"`
	Project         *Project   `gorm:"constraint:OnDelete:SET NULL;"`
	PitfallSymptom  string     `gorm:"type:text;not null;default:''"`
	PitfallCause    string     `gorm:"type:text;not null;default:''"`
	PitfallRemedy   string     `gorm:"type:text;not null;default:''"`
	PitfallResolved bool       `gorm:"not null;default:false"`
	PitfallCode     string     `gorm:"type:text;not null;default:''"`
	// 多对多关联标签（note_tags）
	Tags []Tag `gorm:"many2many:note_tags;"`
}

func (Note) TableName() string { return "notes" }
