// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"context"
	"crypto/ecdsa"
	"database/sql"
	"errors"
	"fmt"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"

	"blog-api/config"
	"blog-api/internal/repository/generated"
)

// AuthService 认证服务，处理用户注册、登录、邮箱验证等业务逻辑
type AuthService struct {
	// queries sqlc 生成的数据库查询接口
	queries *generated.Queries
	// redis Redis 客户端，用于存储验证码和刷新令牌
	redis *redis.Client
	// emailService 邮件服务，用于发送验证码
	emailService EmailSender
	// config 应用配置
	config *config.Config
	// privateKey JWT ES256 私钥
	privateKey *ecdsa.PrivateKey
	// publicKey JWT ES256 公钥
	publicKey *ecdsa.PublicKey
}

// NewAuthService 创建认证服务实例
func NewAuthService(queries *generated.Queries, redisClient *redis.Client, emailSvc *EmailService, cfg *config.Config) *AuthService {
	privateKey, publicKey, err := loadOrGenerateKeys(cfg.JWTPrivateKeyPath, cfg.JWTPublicKeyPath)
	if err != nil {
		log.Fatal().Err(err).Msg("加载 JWT 密钥失败")
	}

	return &AuthService{
		queries:      queries,
		redis:        redisClient,
		emailService: emailSvc,
		config:       cfg,
		privateKey:   privateKey,
		publicKey:    publicKey,
	}
}

// Register 用户注册
func (s *AuthService) Register(ctx context.Context, email, username, password string) error {
	log.Info().Str("service", "AuthService").Str("operation", "Register").Str("email", email).Str("username", username).Msg("开始用户注册")

	log.Debug().Str("query", "GetUserByEmail").Str("email", email).Msg("检查邮箱是否已注册")
	_, err := s.queries.GetUserByEmail(ctx, email)
	if err == nil {
		log.Warn().Str("email", email).Msg("邮箱已被注册")
		return ErrEmailAlreadyExists
	}
	if !errors.Is(err, sql.ErrNoRows) {
		log.Error().Err(err).Str("email", email).Msg("查询邮箱失败")
		return fmt.Errorf("查询邮箱失败: %w", err)
	}

	log.Debug().Str("query", "GetUserByUsername").Str("username", username).Msg("检查用户名是否已占用")
	_, err = s.queries.GetUserByUsername(ctx, username)
	if err == nil {
		log.Warn().Str("username", username).Msg("用户名已被占用")
		return ErrUsernameAlreadyExists
	}
	if !errors.Is(err, sql.ErrNoRows) {
		log.Error().Err(err).Str("username", username).Msg("查询用户名失败")
		return fmt.Errorf("查询用户名失败: %w", err)
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Error().Err(err).Msg("密码哈希失败")
		return fmt.Errorf("密码哈希失败: %w", err)
	}

	log.Debug().Str("query", "CreateUser").Str("email", email).Str("username", username).Msg("创建用户记录")
	user, err := s.queries.CreateUser(ctx, generated.CreateUserParams{
		Username:      username,
		Email:         email,
		PasswordHash:  string(hashedPassword),
		Role:          "user",
		EmailVerified: false,
		IsActive:      false,
	})
	if err != nil {
		log.Error().Err(err).Str("email", email).Str("username", username).Msg("创建用户失败")
		return fmt.Errorf("创建用户失败: %w", err)
	}

	code, err := generateVerificationCode()
	if err != nil {
		log.Error().Err(err).Msg("生成验证码失败")
		return fmt.Errorf("生成验证码失败: %w", err)
	}

	log.Info().Str("target", "Redis").Str("key", "verify:"+email).Msg("存储验证码到Redis")
	if err := s.storeVerificationCode(ctx, "verify:"+email, code); err != nil {
		log.Error().Err(err).Str("email", email).Msg("存储验证码失败")
		return fmt.Errorf("存储验证码失败: %w", err)
	}

	log.Info().Str("target", "EmailService").Str("email", email).Msg("发送验证码邮件")
	if err := s.emailService.SendVerificationCode(ctx, email, code); err != nil {
		log.Warn().Err(err).Str("user_id", user.ID.String()).Str("email", email).Msg("发送验证码邮件失败，用户已创建但未收到验证码")
	}

	log.Info().Str("user_id", user.ID.String()).Str("email", email).Msg("用户注册成功")
	return nil
}

// Login 用户登录
func (s *AuthService) Login(ctx context.Context, email, password string) (*TokenPair, error) {
	log.Info().Str("service", "AuthService").Str("operation", "Login").Str("email", email).Msg("开始用户登录")

	log.Debug().Str("query", "GetUserByEmail").Str("email", email).Msg("查询用户信息")
	user, err := s.queries.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Warn().Str("email", email).Msg("用户不存在")
			return nil, ErrInvalidCredentials
		}
		log.Error().Err(err).Str("email", email).Msg("查询用户失败")
		return nil, fmt.Errorf("查询用户失败: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		log.Warn().Str("email", email).Str("user_id", user.ID.String()).Msg("密码错误")
		return nil, ErrInvalidCredentials
	}

	if !user.IsActive {
		log.Warn().Str("email", email).Str("user_id", user.ID.String()).Msg("账户未激活")
		return nil, ErrAccountNotActivated
	}

	log.Debug().Str("query", "GetUserRoleID").Str("user_id", user.ID.String()).Msg("获取用户角色ID")
	roleID, _ := s.queries.GetUserRoleID(ctx, user.ID)
	var rid int32
	if roleID.Valid {
		rid = roleID.Int32
	}

	tokenPair, err := s.generateTokenPair(user.ID.String(), user.Email, user.Role, rid)
	if err != nil {
		log.Error().Err(err).Str("user_id", user.ID.String()).Msg("生成令牌失败")
		return nil, fmt.Errorf("生成令牌失败: %w", err)
	}

	refreshKey := "refresh:" + user.ID.String()
	log.Info().Str("target", "Redis").Str("key", refreshKey).Str("user_id", user.ID.String()).Msg("存储刷新令牌")
	if err := s.redis.Set(ctx, refreshKey, tokenPair.RefreshToken, s.config.JWTRefreshTokenTTL).Err(); err != nil {
		log.Error().Err(err).Str("user_id", user.ID.String()).Msg("存储刷新令牌失败")
		return nil, fmt.Errorf("存储刷新令牌失败: %w", err)
	}

	log.Info().Str("user_id", user.ID.String()).Str("email", email).Msg("用户登录成功")
	return tokenPair, nil
}

// Logout 用户登出
func (s *AuthService) Logout(ctx context.Context, userID string) error {
	log.Info().Str("service", "AuthService").Str("operation", "Logout").Str("user_id", userID).Msg("开始用户登出")

	refreshKey := "refresh:" + userID
	log.Info().Str("target", "Redis").Str("key", refreshKey).Msg("删除刷新令牌")
	if err := s.redis.Del(ctx, refreshKey).Err(); err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("删除刷新令牌失败")
		return fmt.Errorf("删除刷新令牌失败: %w", err)
	}

	log.Info().Str("user_id", userID).Msg("用户登出成功")
	return nil
}
