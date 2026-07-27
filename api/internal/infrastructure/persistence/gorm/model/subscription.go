package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// Subscription 订阅源持久化模型（对应 subscriptions 表，migration 061）。
//
// 承载 RSS feed 订阅：用户注册 feed URL + 抓取频率，后端定时任务按频率拉 feed
// 抓正文建草稿。本期（T6）只做手动 CRUD，定时抓取在 T7/T8。
//
// nullable 语义：
//   - last_fetched_at NULL = 从未抓过
//   - next_fetch_at   NULL = 未排程（理论上 active 状态必有值，重建场景兜底）
//   - retry_after_until NULL = 无 429 Retry-After 限制
type Subscription struct {
	ID                 uuid.UUID              `gorm:"type:uuid;primaryKey" json:"id"`
	UserID             uuid.UUID              `gorm:"type:uuid;column:user_id;index;not null" json:"user_id"`
	SourceType         string                 `gorm:"type:varchar(20);column:source_type;default:rss;not null" json:"source_type"`
	FeedURL            string                 `gorm:"type:text;column:feed_url;not null" json:"feed_url"`
	Title              string                 `gorm:"type:varchar(255)" json:"title"`
	Interval           string                 `gorm:"type:varchar(20);not null;default:daily" json:"interval"`
	AutoPublish        bool                   `gorm:"column:auto_publish;default:false;not null" json:"auto_publish"`
	CanonicalOverride  string                 `gorm:"type:text;column:canonical_override" json:"canonical_override,omitempty"`
	Tags               datatypes.JSONSlice[string] `gorm:"type:jsonb;not null;default:'[]'" json:"tags"`
	Status             string                 `gorm:"type:varchar(20);not null;default:active" json:"status"`
	ConsecutiveFailures int                   `gorm:"column:consecutive_failures;not null;default:0" json:"consecutive_failures"`
	LastError          string                 `gorm:"type:text;column:last_error" json:"last_error,omitempty"`
	LastFetchedAt      *time.Time             `gorm:"column:last_fetched_at" json:"last_fetched_at,omitempty"`
	NextFetchAt        *time.Time             `gorm:"column:next_fetch_at" json:"next_fetch_at,omitempty"`
	RetryAfterUntil    *time.Time             `gorm:"column:retry_after_until" json:"retry_after_until,omitempty"`
	CreatedAt          time.Time              `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt          time.Time              `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

// TableName 显式指定表名
func (Subscription) TableName() string { return "subscriptions" }
