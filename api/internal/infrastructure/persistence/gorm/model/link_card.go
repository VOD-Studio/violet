package model

import (
	"time"

	"github.com/google/uuid"
)

// LinkCard OG 链接卡片缓存（按 URL 全局去重，跨内容共享）。
type LinkCard struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	URL         string    `gorm:"type:text;not null;uniqueIndex:uniq_link_cards_url" json:"url"`
	Title       string    `gorm:"type:text;not null;default:''" json:"title"`
	Description string    `gorm:"type:text;not null;default:''" json:"description"`
	SiteName    string    `gorm:"type:varchar(120);not null;default:''" json:"site_name"`
	ImageURL    string    `gorm:"type:text;not null;default:''" json:"image_url"`
	Status      string    `gorm:"type:varchar(16);not null;default:'pending'" json:"status"`
	FetchedAt   time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"fetched_at"`
	ExpiresAt   time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"expires_at"`
	LastError   string    `gorm:"type:varchar(200);not null;default:''" json:"last_error"`
	FailCount   int       `gorm:"not null;default:0" json:"fail_count"`
	CreatedAt   time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt   time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

// TableName 显式指定表名。
func (LinkCard) TableName() string { return "link_cards" }
