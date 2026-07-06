// Package shared 定义应用层端口（基础设施接口），保持 application 层零框架依赖。
//
// 本文件抽取 auth 模块的基础设施端口（TokenService/TokenStore/CodeStore），
// 使 application/auth/command 不再直接 import infrastructure/auth 具体类型。
package shared

import (
	"context"
	"time"

	domainsession "blog-api/internal/domain/session"
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

// SessionStore opaque session 存储端口。
//
// 命门不变量②：Touch 只滑动续期（重置 TTL + 更新 lastSeenAt），不轮换 id、
// 不产生 Set-Cookie。一旦轮换 id 就要在 SSR 写 cookie，重新撞 server function
// 吞 Set-Cookie 的卡点。
type SessionStore interface {
	// Create 写入新 session，TTL=idleTTL，同时登记到 user:<uid>:sessions 索引。
	Create(ctx context.Context, sess *domainsession.Session, idleTTL time.Duration) error
	// Get 读取并反序列化，不续期。不存在或已过期返回 session.ErrSessionNotFound。
	Get(ctx context.Context, id domainsession.ID) (*domainsession.Session, error)
	// Touch 滑动续期：重置 TTL=idleTTL 并更新 lastSeenAt，不换 id、不产生 cookie。
	Touch(ctx context.Context, sess *domainsession.Session, idleTTL time.Duration) error
	// DeleteForUser 删除指定用户的指定 session（登出当前设备），同步清理索引。
	DeleteForUser(ctx context.Context, userID string, id domainsession.ID) error
	// DeleteByUser 删除某用户全部 session（改密/重置密码强制全部设备重登）。
	DeleteByUser(ctx context.Context, userID string) error
}
