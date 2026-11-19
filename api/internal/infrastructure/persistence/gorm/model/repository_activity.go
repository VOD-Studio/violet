package model

import (
	"time"

	"gorm.io/datatypes"

	activity "blog-api/internal/domain/repositoryactivity"
)

type RepositoryActivitySource struct {
	Key           string `gorm:"primaryKey"`
	RepositoryID  int64
	DefaultBranch string
	Unavailable   bool
	AttemptedAt   time.Time
	VerifiedAt    *time.Time
	DataAt        *time.Time
	SyncedAt      *time.Time
	Reason        string
	RetryAt       *time.Time
	Commits       datatypes.JSONType[activity.Stream] `gorm:"type:jsonb"`
	Releases      datatypes.JSONType[activity.Stream] `gorm:"type:jsonb"`
}

func (RepositoryActivitySource) TableName() string { return "repository_activity_sources" }

type RepositoryActivityEvent struct {
	RepositoryID int64  `gorm:"primaryKey;autoIncrement:false"`
	Kind         string `gorm:"primaryKey"`
	SourceID     string `gorm:"primaryKey"`
	Tag          string
	Title        string
	URL          string
	OccurredAt   time.Time
	SeenAt       time.Time
}

func (RepositoryActivityEvent) TableName() string { return "repository_activity_events" }
