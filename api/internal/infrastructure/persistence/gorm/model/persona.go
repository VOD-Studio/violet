package model

import (
	"time"

	"github.com/google/uuid"
)

type Persona struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey"`
	CreatedBy   uuid.UUID `gorm:"type:uuid;column:created_by;not null"`
	Name        string    `gorm:"type:varchar(120);not null;default:''"`
	Subtitle    string    `gorm:"type:varchar(240);not null;default:''"`
	Summary     string    `gorm:"type:varchar(500);not null;default:''"`
	ContentMD   string    `gorm:"type:text;column:content_md;not null;default:''"`
	ContentHTML string    `gorm:"type:text;column:content_html;not null;default:''"`
	Version     int64     `gorm:"not null;default:1"`
	CreatedAt   time.Time `gorm:"not null;default:CURRENT_TIMESTAMP"`
	UpdatedAt   time.Time `gorm:"not null;default:CURRENT_TIMESTAMP"`
}

func (Persona) TableName() string { return "personas" }

type PersonaFact struct {
	PersonaID uuid.UUID `gorm:"type:uuid;column:persona_id;primaryKey"`
	Position  int       `gorm:"primaryKey"`
	Label     string    `gorm:"type:varchar(40);not null"`
	Value     string    `gorm:"type:varchar(300);not null"`
}

func (PersonaFact) TableName() string { return "persona_facts" }

type PersonaImage struct {
	PersonaID       uuid.UUID `gorm:"type:uuid;column:persona_id;primaryKey"`
	Position        int       `gorm:"primaryKey"`
	FileID          uuid.UUID `gorm:"type:uuid;column:file_id;not null"`
	Caption         string    `gorm:"type:varchar(500);not null;default:''"`
	AltTextOverride string    `gorm:"type:varchar(300);column:alt_text_override;not null;default:''"`
}

func (PersonaImage) TableName() string { return "persona_images" }

type PersonaSelection struct {
	SingletonKey int16     `gorm:"column:singleton_key;primaryKey"`
	PersonaID    uuid.UUID `gorm:"type:uuid;column:persona_id;not null;unique"`
	ActivatedAt  time.Time `gorm:"column:activated_at;not null"`
}

func (PersonaSelection) TableName() string { return "persona_selection" }
