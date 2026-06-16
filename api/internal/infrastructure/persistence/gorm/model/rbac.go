package model

import (
	"time"
)

// RolePermission 角色-权限关联表（role_permissions）
//
// 显式定义中间表模型，便于直接操作（如 SavePermissions 全量替换），
// 而非依赖 GORM 隐式创建的中间表。
type RolePermission struct {
	RoleID       int32 `gorm:"primaryKey"`
	PermissionID int32 `gorm:"primaryKey"`
}

// TableName 显式指定中间表名
func (RolePermission) TableName() string { return "role_permissions" }

// Role 角色表持久化模型（对应 roles 表）
type Role struct {
	ID          int32     `gorm:"primaryKey;autoIncrement" json:"id"`
	Name        string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	CreatedAt   time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`

	// Permissions 角色-权限多对多关联（通过 role_permissions 表）
	// GORM AutoMigrate 会创建中间表；Preload("Permissions") 可预加载权限
	Permissions []Permission `gorm:"many2many:role_permissions;"`
}

// TableName 显式指定表名
func (Role) TableName() string { return "roles" }

// Permission 权限点表持久化模型（对应 permissions 表）
type Permission struct {
	ID          int32     `gorm:"primaryKey;autoIncrement" json:"id"`
	Code        string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"code"`
	Name        string    `gorm:"type:varchar(100);not null" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	CreatedAt   time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}

// TableName 显式指定表名
func (Permission) TableName() string { return "permissions" }
