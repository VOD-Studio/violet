// Package model 定义 GORM 表模型（持久化模型，区别于领域实体）。
//
// 持久化模型（PO, Persistence Object）与领域实体（domain.User）分离：
//   - 领域实体表达业务概念，无 GORM tag
//   - 持久化模型表达表结构，带 GORM tag
//
// repository 实现负责两者互转：
//   - 加载：PO → 领域实体（ReconstructUser）
//   - 保存：领域实体 → PO
package model

import (
	"time"

	"github.com/google/uuid"
)

// BaseModel 公共字段基类，可被各 PO 嵌入
//
// 提供 id / created_at / updated_at，对应大多数表的标准字段。
// 使用 uuid.UUID 而非 string，保证类型安全。
type BaseModel struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	CreatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

// User 用户表持久化模型
//
// 对应数据库 users 表，与 internal/model.User（DTO）和 domain/user.User（领域实体）三分离：
//   - 本模型（PO）：表结构，带 GORM tag，用于持久化
//   - domain/user.User：领域实体，含业务方法，无 tag
//   - internal/model.User（旧 DTO）：API 响应，将逐步废弃
type User struct {
	BaseModel
	Username     string `gorm:"type:varchar(32);unique;not null" json:"username"`
	Email        string `gorm:"type:varchar(255);unique;not null" json:"email"`
	PasswordHash string `gorm:"type:varchar(255);not null" json:"-"`
	AvatarURL    string `gorm:"type:text" json:"avatar_url"`
	Bio          string `gorm:"type:text" json:"bio"`
	Role         string `gorm:"type:varchar(32);not null;default:'user'" json:"role"`
	// IsBuiltinSuperAdmin 内置超管标志位（区分通配符超管与被委派超管）
	IsBuiltinSuperAdmin bool   `gorm:"not null;default:false" json:"is_builtin_super_admin"`
	EmailVerified       bool   `gorm:"not null;default:false" json:"email_verified"`
	IsActive            bool   `gorm:"not null;default:false" json:"is_active"`
	GoogleID            *string `gorm:"type:varchar(255);uniqueIndex" json:"google_id"`
	GithubID            *string `gorm:"type:varchar(255);uniqueIndex" json:"github_id"`
	RoleID              *int32 `gorm:"index" json:"role_id,omitempty"`
}

// TableName 显式指定表名（GORM 默认会复数化为 users，此处显式表达意图）
func (User) TableName() string { return "users" }
