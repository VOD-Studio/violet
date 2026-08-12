package model

import (
	"time"

	"github.com/google/uuid"
)

// FriendLink 友链持久化模型（对应 friendlinks 表，migration 076）。
//
// 站点级内容单元（无 author 归属，PRD-0014）：访客申请 → 站长审核 → 前台展示。
// status 四态：pending / approved / rejected / disabled。
// 两张部分唯一索引兜底业务约束（service 层先查后写，索引防并发穿透）：
//   - uniq_friendlinks_url_active：url 唯一 WHERE status != 'rejected'（被拒不阻塞重新申请）
//   - uniq_friendlinks_pending_identity：(ip_hash, contact_email) 唯一 WHERE status = 'pending'（申请配额）
type FriendLink struct {
	ID           uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	UserID       *uuid.UUID `gorm:"type:uuid;column:user_id" json:"user_id,omitempty"`
	Name         string     `gorm:"type:varchar(30);not null" json:"name"`
	URL          string     `gorm:"type:text;not null" json:"url"`
	AvatarURL    string     `gorm:"type:text;not null;default:''" json:"avatar_url"`
	Description  string     `gorm:"type:varchar(80);not null;default:''" json:"description"`
	OwnerName    string     `gorm:"type:varchar(30);not null;default:''" json:"owner_name"`
	LinkbackURL  string     `gorm:"type:text;not null;default:''" json:"linkback_url"`
	ContactEmail string     `gorm:"type:varchar(254);not null;default:''" json:"contact_email"`
	Status       string     `gorm:"type:varchar(16);not null;default:'pending'" json:"status"`
	SortOrder    int        `gorm:"column:sort_order;not null;default:0" json:"sort_order"`
	IPHash       string     `gorm:"type:varchar(64);column:ip_hash;not null;default:''" json:"ip_hash"`
	CreatedAt    time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt    time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

// TableName 显式指定表名
func (FriendLink) TableName() string { return "friendlinks" }
