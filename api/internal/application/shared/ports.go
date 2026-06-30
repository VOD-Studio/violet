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

// TokenStore refresh token 存储端口
type TokenStore interface {
	Save(ctx context.Context, userID, refreshToken string) error
	Verify(ctx context.Context, userID, refreshToken string) (bool, error)
	Delete(ctx context.Context, userID string) error
}

// CodeStore 验证码存储端口
type CodeStore interface {
	Store(ctx context.Context, prefix, identifier, codeHash string) error
	Verify(ctx context.Context, prefix, identifier, codeHash string) (bool, error)
}
