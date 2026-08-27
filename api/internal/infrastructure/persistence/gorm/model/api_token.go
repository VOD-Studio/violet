package model

import (
	"time"

	"gorm.io/datatypes"
)

// APIToken 个人访问令牌持久化模型（对应 api_tokens 表）。
//
// 机器鉴权凭证：明文 token 仅创建时返回一次，库中只存 token_hash。
// expires_at 为 NULL 表示永不过期；last_used_at 为 NULL 表示从未使用。
type APIToken struct {
	ID         string                      `gorm:"type:uuid;primaryKey" json:"id"`
	UserID     string                      `gorm:"type:uuid;column:user_id;index;not null" json:"user_id"`
	Name       string                      `gorm:"type:varchar(100);not null" json:"name"`
	TokenHash  string                      `gorm:"type:varchar(64);column:token_hash;uniqueIndex;not null" json:"-"`
	Scopes     datatypes.JSONSlice[string] `gorm:"type:jsonb;not null" json:"scopes"`
	ExpiresAt  *time.Time                  `gorm:"column:expires_at" json:"expires_at,omitempty"`
	LastUsedAt *time.Time                  `gorm:"column:last_used_at" json:"last_used_at,omitempty"`
	// Interactive MCP 写 tool 交互偏好（默认 true）；领域语义见 api_token.PAT
	Interactive *bool                       `gorm:"column:interactive;default:true" json:"interactive"`
	CreatedAt   time.Time                   `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}

// TableName 显式指定表名
func (APIToken) TableName() string { return "api_tokens" }
