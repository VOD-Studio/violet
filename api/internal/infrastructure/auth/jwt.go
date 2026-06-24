// Package auth 提供 JWT 与密码哈希的基础设施实现。
//
// 但按 DDD 端口/适配器模式重构为独立的基础设施实现，
// 不再与 AuthService 耦合。
package auth

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog/log"
)

// ============================================================
// JWT Claims 与 TokenPair
// ============================================================

// JWTClaims JWT 声明（负载）
//
// 与旧 auth_types.go 的 JWTClaims 保持兼容，
// 供 middleware.Auth 读取 UserID/Role 等 context 注入。
type JWTClaims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	RoleID int32  `json:"role_id"`
	jwt.RegisteredClaims
}

// TokenPair 访问令牌 + 刷新令牌对
type TokenPair struct {
	AccessToken      string
	RefreshToken     string
	ExpiresIn        int64 // 访问令牌剩余秒数
	RefreshExpiresIn int64 // 刷新令牌剩余秒数
}

// TokenInput 生成令牌的入参
type TokenInput struct {
	UserID string
	Email  string
	Role   string
	RoleID int32
}

// ============================================================
// JWTService JWT 签发与验证服务
// ============================================================

// JWTService JWT 基础设施服务
//
// 负责 ES256 签名/验签，不依赖数据库或 Redis。
// 密钥对在构造时从 PEM 文件加载（生产）或临时生成（开发）。
type JWTService struct {
	privateKey *ecdsa.PrivateKey
	publicKey  *ecdsa.PublicKey
	accessTTL  time.Duration
	refreshTTL time.Duration
}

// NewJWTService 创建 JWT 服务
//
// privateKeyPath/publicKeyPath 为空时：
//   - allowEphemeral=true：生成临时密钥并记录警告日志（仅开发）
//   - allowEphemeral=false：返回错误，拒绝启动（生产 fail-closed）
func NewJWTService(privateKeyPath, publicKeyPath string, accessTTL, refreshTTL time.Duration, allowEphemeral bool) (*JWTService, error) {
	priv, pub, err := loadOrGenerateKeys(privateKeyPath, publicKeyPath, allowEphemeral)
	if err != nil {
		return nil, fmt.Errorf("加载 JWT 密钥失败: %w", err)
	}
	return &JWTService{
		privateKey: priv,
		publicKey:  pub,
		accessTTL:  accessTTL,
		refreshTTL: refreshTTL,
	}, nil
}

// GenerateTokenPair 生成访问令牌与刷新令牌
func (s *JWTService) GenerateTokenPair(in TokenInput) (*TokenPair, error) {
	now := time.Now()

	// 访问令牌（含 RoleID）
	accessClaims := &JWTClaims{
		UserID: in.UserID,
		Email:  in.Email,
		Role:   in.Role,
		RoleID: in.RoleID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.accessTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   in.UserID,
			Issuer:    "blog-api",
		},
	}
	accessTokenString, err := signToken(accessClaims, s.privateKey)
	if err != nil {
		return nil, err
	}

	// 刷新令牌（不含 RoleID，刷新时重新查询）
	refreshClaims := &JWTClaims{
		UserID: in.UserID,
		Email:  in.Email,
		Role:   in.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.refreshTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   in.UserID,
			Issuer:    "blog-api",
		},
	}
	refreshTokenString, err := signToken(refreshClaims, s.privateKey)
	if err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:      accessTokenString,
		RefreshToken:     refreshTokenString,
		ExpiresIn:        int64(s.accessTTL.Seconds()),
		RefreshExpiresIn: int64(s.refreshTTL.Seconds()),
	}, nil
}

// ParseToken 解析并验证 JWT，返回 claims
//
// 强校验：算法类型（防 alg 混淆攻击）、issuer（防跨服务令牌复用）、过期时间。
func (s *JWTService) ParseToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodECDSA); !ok {
			return nil, fmt.Errorf("不支持的签名算法: %v", token.Header["alg"])
		}
		return s.publicKey, nil
	}, jwt.WithIssuer("blog-api"), jwt.WithExpirationRequired())
	if err != nil {
		return nil, fmt.Errorf("解析令牌失败: %w", err)
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, errors.New("无效的令牌")
	}
	return claims, nil
}

// AccessTTL 返回访问令牌 TTL
func (s *JWTService) AccessTTL() time.Duration { return s.accessTTL }

// RefreshTTL 返回刷新令牌 TTL
func (s *JWTService) RefreshTTL() time.Duration { return s.refreshTTL }

// signToken 用私钥签名 claims
func signToken(claims *JWTClaims, key *ecdsa.PrivateKey) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodES256, claims)
	signed, err := token.SignedString(key)
	if err != nil {
		return "", fmt.Errorf("签名令牌失败: %w", err)
	}
	return signed, nil
}

// ============================================================
// ============================================================

// loadOrGenerateKeys 加载或生成 ES256 密钥对
//
// allowEphemeral=false 且路径为空时返回错误（fail-closed，防生产环境静默密钥轮换）。
func loadOrGenerateKeys(privateKeyPath, publicKeyPath string, allowEphemeral bool) (*ecdsa.PrivateKey, *ecdsa.PublicKey, error) {
	if privateKeyPath != "" && publicKeyPath != "" {
		return loadKeysFromFiles(privateKeyPath, publicKeyPath)
	}
	if !allowEphemeral {
		return nil, nil, errors.New("未配置 JWT 密钥文件路径，且未启用临时密钥（jwt_allow_ephemeral_key）；生产环境必须配置密钥")
	}
	log.Warn().Msg("使用临时 JWT 密钥（仅开发环境）；每次重启所有令牌将失效")
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, nil, fmt.Errorf("生成 ECDSA 密钥失败: %w", err)
	}
	return privateKey, &privateKey.PublicKey, nil
}

// loadKeysFromFiles 从 PEM 文件加载密钥对
func loadKeysFromFiles(privateKeyPath, publicKeyPath string) (*ecdsa.PrivateKey, *ecdsa.PublicKey, error) {
	privateKeyData, err := os.ReadFile(privateKeyPath)
	if err != nil {
		return nil, nil, fmt.Errorf("读取私钥文件失败: %w", err)
	}
	privateKeyBlock, _ := pem.Decode(privateKeyData)
	if privateKeyBlock == nil {
		return nil, nil, errors.New("无效的私钥 PEM 格式")
	}
	privateKey, err := x509.ParseECPrivateKey(privateKeyBlock.Bytes)
	if err != nil {
		return nil, nil, fmt.Errorf("解析私钥失败: %w", err)
	}

	publicKeyData, err := os.ReadFile(publicKeyPath)
	if err != nil {
		return nil, nil, fmt.Errorf("读取公钥文件失败: %w", err)
	}
	publicKeyBlock, _ := pem.Decode(publicKeyData)
	if publicKeyBlock == nil {
		return nil, nil, errors.New("无效的公钥 PEM 格式")
	}
	publicKeyInterface, err := x509.ParsePKIXPublicKey(publicKeyBlock.Bytes)
	if err != nil {
		return nil, nil, fmt.Errorf("解析公钥失败: %w", err)
	}
	publicKey, ok := publicKeyInterface.(*ecdsa.PublicKey)
	if !ok {
		return nil, nil, errors.New("公钥类型不是 ECDSA")
	}

	return privateKey, publicKey, nil
}
