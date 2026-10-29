package model

import "time"

// PresenceDevice Nowbeam 上报设备（对应 presence_devices 表）；凭证只存 SHA-256 哈希。
type PresenceDevice struct {
	ID          string    `gorm:"type:uuid;primaryKey" json:"id"`
	DisplayName string    `gorm:"column:display_name;not null" json:"display_name"`
	TokenHash   string    `gorm:"column:token_hash;uniqueIndex;not null" json:"-"`
	CreatedAt   time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (PresenceDevice) TableName() string { return "presence_devices" }

// PresenceSettings 接收端公开策略单例行（id 恒为 1）。
type PresenceSettings struct {
	ID         int16 `gorm:"primaryKey" json:"id"`
	PublicRead bool  `gorm:"column:public_read;not null" json:"public_read"`
}

func (PresenceSettings) TableName() string { return "presence_settings" }
