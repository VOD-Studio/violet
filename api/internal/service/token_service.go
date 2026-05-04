// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"context"
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
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// generateTokenPair 生成访问令牌和刷新令牌
func (s *AuthService) generateTokenPair(userID, email, role string, roleID int32) (*TokenPair, error) {
	now := time.Now()

	accessClaims := &JWTClaims{
		UserID: userID,
		Email:  email,
		Role:   role,
		RoleID: roleID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.config.JWTAccessTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   userID,
			Issuer:    "blog-api",
		},
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodES256, accessClaims)
	accessTokenString, err := accessToken.SignedString(s.privateKey)
	if err != nil {
		return nil, fmt.Errorf("签名访问令牌失败: %w", err)
	}

	refreshClaims := &JWTClaims{
		UserID: userID,
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.config.JWTRefreshTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   userID,
			Issuer:    "blog-api",
		},
	}

	refreshToken := jwt.NewWithClaims(jwt.SigningMethodES256, refreshClaims)
	refreshTokenString, err := refreshToken.SignedString(s.privateKey)
	if err != nil {
		return nil, fmt.Errorf("签名刷新令牌失败: %w", err)
	}

	return &TokenPair{
		AccessToken:      accessTokenString,
		RefreshToken:     refreshTokenString,
		ExpiresIn:        int64(s.config.JWTAccessTokenTTL.Seconds()),
		RefreshExpiresIn: int64(s.config.JWTRefreshTokenTTL.Seconds()),
	}, nil
}

// parseToken 解析并验证 JWT 令牌
func (s *AuthService) parseToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodECDSA); !ok {
			return nil, fmt.Errorf("不支持的签名算法: %v", token.Header["alg"])
		}
		return s.publicKey, nil
	})
	if err != nil {
		return nil, fmt.Errorf("解析令牌失败: %w", err)
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, errors.New("无效的令牌")
	}

	return claims, nil
}

// ValidateToken 验证令牌并返回声明信息
func (s *AuthService) ValidateToken(tokenString string) (*JWTClaims, error) {
	return s.parseToken(tokenString)
}

// RefreshToken 刷新访问令牌
func (s *AuthService) RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error) {
	log.Info().Str("service", "AuthService").Str("operation", "RefreshToken").Msg("开始刷新令牌")

	claims, err := s.parseToken(refreshToken)
	if err != nil {
		log.Warn().Err(err).Msg("刷新令牌无效")
		return nil, ErrInvalidRefreshToken
	}

	userID := claims.UserID
	log.Debug().Str("user_id", userID).Msg("解析刷新令牌成功")

	refreshKey := "refresh:" + userID
	log.Info().Str("target", "Redis").Str("key", refreshKey).Msg("验证刷新令牌")
	storedToken, err := s.redis.Get(ctx, refreshKey).Result()
	if err != nil {
		log.Warn().Err(err).Str("user_id", userID).Msg("Redis中未找到刷新令牌")
		return nil, ErrInvalidRefreshToken
	}

	if storedToken != refreshToken {
		log.Warn().Str("user_id", userID).Msg("刷新令牌不匹配")
		return nil, ErrInvalidRefreshToken
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("无效的用户ID")
		return nil, fmt.Errorf("无效的用户 ID: %w", err)
	}

	log.Debug().Str("query", "GetUserByID").Str("user_id", userID).Msg("查询用户信息")
	user, err := s.queries.GetUserByID(ctx, userUUID)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("查询用户失败")
		return nil, fmt.Errorf("查询用户失败: %w", err)
	}

	roleID, _ := s.queries.GetUserRoleID(ctx, userID)
	var rid int32
	if roleID.Valid {
		rid = roleID.Int32
	}
	tokenPair, err := s.generateTokenPair(userID, user.Email, user.Role, rid)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("生成新令牌失败")
		return nil, fmt.Errorf("生成令牌失败: %w", err)
	}

	log.Info().Str("target", "Redis").Str("key", refreshKey).Msg("更新刷新令牌")
	if err := s.redis.Set(ctx, refreshKey, tokenPair.RefreshToken, s.config.JWTRefreshTokenTTL).Err(); err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("更新刷新令牌失败")
		return nil, fmt.Errorf("更新刷新令牌失败: %w", err)
	}

	log.Info().Str("user_id", userID).Msg("令牌刷新成功")
	return tokenPair, nil
}

// loadOrGenerateKeys 加载或生成 ES256 密钥对
func loadOrGenerateKeys(privateKeyPath, publicKeyPath string) (*ecdsa.PrivateKey, *ecdsa.PublicKey, error) {
	if privateKeyPath != "" && publicKeyPath != "" {
		return loadKeysFromFiles(privateKeyPath, publicKeyPath)
	}

	log.Warn().Msg("未配置 JWT 密钥文件，使用临时密钥对（仅适用于开发环境）")
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, nil, fmt.Errorf("生成 ECDSA 密钥失败: %w", err)
	}
	return privateKey, &privateKey.PublicKey, nil
}

// loadKeysFromFiles 从 PEM 文件加载 ES256 密钥对
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
