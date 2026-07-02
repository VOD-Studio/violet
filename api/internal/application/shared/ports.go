// Package shared 定义应用层端口（基础设施接口），保持 application 层零框架依赖。
//
// 本文件抽取 auth 模块的基础设施端口（TokenService/TokenStore/CodeStore），
// 使 application/auth/command 不再直接 import infrastructure/auth 具体类型。
package shared

import (
	"context"
	"time"
)

// TokenPair 访问令牌 + 刷新令牌（应用层 DTO，不依赖 infra）
type TokenPair struct {
	AccessToken      string
	RefreshToken     string
	ExpiresIn        int64
	RefreshExpiresIn int64
}

// TokenInput 生成令牌入参
type TokenInput struct {
	UserID              string
	Email               string
	Role                string
	RoleID              int32
	IsBuiltinSuperAdmin bool
}

// Claims 解析出的令牌声明
type Claims struct {
	UserID              string
	Email               string
	Role                string
	RoleID              int32
	IsBuiltinSuperAdmin bool
}

// TokenService JWT 签发/验签端口
type TokenService interface {
	GenerateTokenPair(in TokenInput) (*TokenPair, error)
	ParseToken(token string) (*Claims, error)
	AccessTTL() time.Duration
	RefreshTTL() time.Duration
}

// RotateResult 原子轮换 refresh token 的结果，区分三种语义以便调用方精确处理
// （详见 ADR-0001 不变量 1、2）。
type RotateResult int

const (
	// RotateSuccess 旧 token 匹配，已原子地写入新 token。
	RotateSuccess RotateResult = iota
	// RotateReused 入参 token 与当前存储值不匹配（重用已废弃的 token），
	// 整个 token 家族已被吊销。调用方应返回 401 强制重登。
	RotateReused
	// RotateInvalid 当前无存储 token（已登出或从未登录）。
	RotateInvalid
)

// TokenStore refresh token 存储端口
type TokenStore interface {
	Save(ctx context.Context, userID, refreshToken string) error
	// Rotate 原子地校验旧 token 并写入新 token，单次 Redis 操作内完成（见 ADR-0001 不变量 1）。
	// 旧 token 不匹配时吊销整个家族（不变量 2），返回 RotateReused。
	Rotate(ctx context.Context, userID, oldToken, newToken string) (RotateResult, error)
	Delete(ctx context.Context, userID string) error
}

// CodeStore 验证码存储端口
type CodeStore interface {
	Store(ctx context.Context, prefix, identifier, codeHash string) error
	Verify(ctx context.Context, prefix, identifier, codeHash string) (bool, error)
}
