package model

import "time"

// SiteImpression 映射匿名设备印记表；只保存不可逆令牌摘要。
type SiteImpression struct {
	TokenHash []byte    `gorm:"column:token_hash;type:bytea;primaryKey"`
	CreatedAt time.Time `gorm:"column:created_at;not null;default:CURRENT_TIMESTAMP"`
}

func (SiteImpression) TableName() string { return "site_impressions" }
