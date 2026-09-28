package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type ExternalTweet struct {
	ID                    uuid.UUID `gorm:"type:uuid;primaryKey"`
	Platform              string    `gorm:"not null;default:x;uniqueIndex:idx_external_source"`
	SourceID              string    `gorm:"not null;uniqueIndex:idx_external_source"`
	CanonicalURL          string
	Snapshot              datatypes.JSON `gorm:"type:jsonb"`
	QuotedExternalTweetID *uuid.UUID     `gorm:"type:uuid"`
	FetchSource           string
	SnapshotVersion       string
	Fingerprint           string
	Availability          string
	FetchedAt             *time.Time
	LastCheckedAt         time.Time
	LastError             string
	ProtectedUntil        time.Time
	TakenDown             bool
}
