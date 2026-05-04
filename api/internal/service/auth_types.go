// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"context"

	"github.com/golang-jwt/jwt/v5"
)

// EmailSender 邮件发送接口，便于测试时替换
type EmailSender interface {
	SendVerificationCode(ctx context.Context, email, code string) error
	SendPasswordResetCode(ctx context.Context, email, code string) error
}

// VerificationData 验证码存储结构，包含哈希值和剩余尝试次数
type VerificationData struct {
	// CodeHash 验证码的 SHA256 哈希值
	CodeHash string `json:"code_hash"`
	// Attempts 已尝试次数
	Attempts int `json:"attempts"`
}

// JWTClaims JWT 令牌声明
type JWTClaims struct {
	// UserID 用户 ID
	UserID string `json:"user_id"`
	// Email 用户邮箱
	Email string `json:"email"`
	// Role 用户角色名称
	Role string `json:"role"`
	// RoleID 用户角色 ID（用于权限查询）
	RoleID int32 `json:"role_id,omitempty"`
	// 标准 JWT 声明
	jwt.RegisteredClaims
}

// TokenPair 访问令牌和刷新令牌对
type TokenPair struct {
	// AccessToken 访问令牌，有效期较短
	AccessToken string `json:"access_token"`
	// RefreshToken 刷新令牌，有效期较长
	RefreshToken string `json:"refresh_token"`
	// ExpiresIn 访问令牌过期时间（秒）
	ExpiresIn int64 `json:"expires_in"`
	// RefreshExpiresIn 刷新令牌过期时间（秒）
	RefreshExpiresIn int64 `json:"refresh_expires_in"`
}
