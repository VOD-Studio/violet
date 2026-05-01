package service

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"log"
	"math/big"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"

	"blog-api/config"
	"blog-api/internal/repository/generated"
)

// 错误定义，用于区分不同业务异常
var (
	// ErrEmailAlreadyExists 邮箱已被注册
	ErrEmailAlreadyExists = errors.New("邮箱已被注册")
	// ErrUsernameAlreadyExists 用户名已被占用
	ErrUsernameAlreadyExists = errors.New("用户名已被占用")
	// ErrInvalidCredentials 邮箱或密码错误
	ErrInvalidCredentials = errors.New("邮箱或密码错误")
	// ErrAccountNotActivated 账户未激活，需要先验证邮箱
	ErrAccountNotActivated = errors.New("账户未激活，请先验证邮箱")
	// ErrInvalidVerificationCode 验证码无效或已过期
	ErrInvalidVerificationCode = errors.New("验证码无效或已过期")
	// ErrTooManyAttempts 验证码尝试次数过多
	ErrTooManyAttempts = errors.New("验证码尝试次数过多，请重新获取")
	// ErrInvalidRefreshToken 刷新令牌无效或已过期
	ErrInvalidRefreshToken = errors.New("刷新令牌无效或已过期")
	// ErrUserNotFound 用户不存在
	ErrUserNotFound = errors.New("用户不存在")
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
	// Role 用户角色
	Role string `json:"role"`
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

// NewAuthService 创建认证服务实例
// 初始化 ES256 密钥对，从文件加载或自动生成临时密钥
func NewAuthService(queries *generated.Queries, redisClient *redis.Client, emailSvc *EmailService, cfg *config.Config) *AuthService {
	privateKey, publicKey, err := loadOrGenerateKeys(cfg.JWTPrivateKeyPath, cfg.JWTPublicKeyPath)
	if err != nil {
		log.Fatalf("加载 JWT 密钥失败: %v", err)
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
// 验证邮箱和用户名唯一性，创建未激活用户，发送邮箱验证码
func (s *AuthService) Register(ctx context.Context, email, username, password string) error {
	// 检查邮箱是否已被注册
	_, err := s.queries.GetUserByEmail(ctx, email)
	if err == nil {
		return ErrEmailAlreadyExists
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("查询邮箱失败: %w", err)
	}

	// 检查用户名是否已被占用
	_, err = s.queries.GetUserByUsername(ctx, username)
	if err == nil {
		return ErrUsernameAlreadyExists
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("查询用户名失败: %w", err)
	}

	// 使用 bcrypt 对密码进行哈希处理
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("密码哈希失败: %w", err)
	}

	// 创建用户记录，初始状态为未激活且邮箱未验证
	user, err := s.queries.CreateUser(ctx, generated.CreateUserParams{
		Username:      username,
		Email:         email,
		PasswordHash:  string(hashedPassword),
		Role:          "user",
		EmailVerified: false,
		IsActive:      false,
	})
	if err != nil {
		return fmt.Errorf("创建用户失败: %w", err)
	}

	// 生成 6 位数字验证码
	code, err := generateVerificationCode()
	if err != nil {
		return fmt.Errorf("生成验证码失败: %w", err)
	}

	// 将验证码的 SHA256 哈希值存入 Redis，有效期 10 分钟
	if err := s.storeVerificationCode(ctx, "verify:"+email, code); err != nil {
		return fmt.Errorf("存储验证码失败: %w", err)
	}

	// 发送验证码邮件
	if err := s.emailService.SendVerificationCode(ctx, email, code); err != nil {
		log.Printf("发送验证码邮件失败，用户 %s 已创建但未收到验证码: %v", user.ID, err)
	}

	return nil
}

// VerifyEmail 验证邮箱
// 比较用户提交的验证码与 Redis 中存储的哈希值
// 验证成功后激活用户并更新邮箱验证状态
func (s *AuthService) VerifyEmail(ctx context.Context, email, code string) error {
	key := "verify:" + email

	// 从 Redis 获取验证码数据
	data, err := s.getVerificationData(ctx, key)
	if err != nil {
		return ErrInvalidVerificationCode
	}

	// 检查尝试次数是否超过限制（最多 5 次）
	if data.Attempts >= 5 {
		// 删除 Redis 中的验证码
		s.redis.Del(ctx, key)
		return ErrTooManyAttempts
	}

	// 计算用户提交验证码的 SHA256 哈希值
	codeHash := sha256Hash(code)

	// 比较哈希值
	if codeHash != data.CodeHash {
		// 增加尝试次数
		data.Attempts++
		s.storeVerificationData(ctx, key, *data)
		return ErrInvalidVerificationCode
	}

	// 验证成功，删除 Redis 中的验证码
	s.redis.Del(ctx, key)

	// 查询用户
	user, err := s.queries.GetUserByEmail(ctx, email)
	if err != nil {
		return fmt.Errorf("查询用户失败: %w", err)
	}

	// 更新用户激活状态
	if err := s.queries.UpdateUserActive(ctx, generated.UpdateUserActiveParams{
		ID:       user.ID,
		IsActive: true,
	}); err != nil {
		return fmt.Errorf("更新用户激活状态失败: %w", err)
	}

	// 更新用户邮箱验证状态
	if err := s.queries.UpdateUserVerified(ctx, generated.UpdateUserVerifiedParams{
		ID:            user.ID,
		EmailVerified: true,
	}); err != nil {
		return fmt.Errorf("更新邮箱验证状态失败: %w", err)
	}

	return nil
}

// Login 用户登录
// 验证邮箱密码，生成访问令牌和刷新令牌
func (s *AuthService) Login(ctx context.Context, email, password string) (*TokenPair, error) {
	// 按邮箱查询用户
	user, err := s.queries.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("查询用户失败: %w", err)
	}

	// 验证密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	// 检查账户是否已激活
	if !user.IsActive {
		return nil, ErrAccountNotActivated
	}

	// 生成令牌对
	tokenPair, err := s.generateTokenPair(user.ID.String(), user.Email, user.Role)
	if err != nil {
		return nil, fmt.Errorf("生成令牌失败: %w", err)
	}

	// 将刷新令牌存入 Redis，有效期与配置一致
	refreshKey := "refresh:" + user.ID.String()
	if err := s.redis.Set(ctx, refreshKey, tokenPair.RefreshToken, s.config.JWTRefreshTokenTTL).Err(); err != nil {
		return nil, fmt.Errorf("存储刷新令牌失败: %w", err)
	}

	return tokenPair, nil
}

// RefreshToken 刷新访问令牌
// 验证刷新令牌有效性，生成新的令牌对
func (s *AuthService) RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error) {
	// 解析并验证刷新令牌
	claims, err := s.parseToken(refreshToken)
	if err != nil {
		return nil, ErrInvalidRefreshToken
	}

	userID := claims.UserID

	// 从 Redis 获取存储的刷新令牌进行比对
	refreshKey := "refresh:" + userID
	storedToken, err := s.redis.Get(ctx, refreshKey).Result()
	if err != nil {
		return nil, ErrInvalidRefreshToken
	}

	// 比较令牌是否匹配
	if storedToken != refreshToken {
		return nil, ErrInvalidRefreshToken
	}

	// 查询用户信息以获取最新角色
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("无效的用户 ID: %w", err)
	}

	user, err := s.queries.GetUserByID(ctx, userUUID)
	if err != nil {
		return nil, fmt.Errorf("查询用户失败: %w", err)
	}

	// 生成新的令牌对
	tokenPair, err := s.generateTokenPair(userID, user.Email, user.Role)
	if err != nil {
		return nil, fmt.Errorf("生成令牌失败: %w", err)
	}

	// 更新 Redis 中的刷新令牌
	if err := s.redis.Set(ctx, refreshKey, tokenPair.RefreshToken, s.config.JWTRefreshTokenTTL).Err(); err != nil {
		return nil, fmt.Errorf("更新刷新令牌失败: %w", err)
	}

	return tokenPair, nil
}

// Logout 用户登出
// 删除 Redis 中的刷新令牌，使当前会话失效
func (s *AuthService) Logout(ctx context.Context, userID string) error {
	refreshKey := "refresh:" + userID
	if err := s.redis.Del(ctx, refreshKey).Err(); err != nil {
		return fmt.Errorf("删除刷新令牌失败: %w", err)
	}
	return nil
}

// ForgotPassword 发送密码重置验证码
// 向用户邮箱发送重置码，不暴露用户是否存在
func (s *AuthService) ForgotPassword(ctx context.Context, email string) error {
	// 查询用户是否存在
	user, err := s.queries.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// 用户不存在时仍返回成功，避免暴露邮箱是否注册
			return nil
		}
		return fmt.Errorf("查询用户失败: %w", err)
	}

	// 生成 6 位数字重置码
	code, err := generateVerificationCode()
	if err != nil {
		return fmt.Errorf("生成重置码失败: %w", err)
	}

	// 将重置码的 SHA256 哈希值存入 Redis
	key := "reset:" + email
	if err := s.storeVerificationCode(ctx, key, code); err != nil {
		return fmt.Errorf("存储重置码失败: %w", err)
	}

	// 发送重置码邮件
	if err := s.emailService.SendPasswordResetCode(ctx, user.Email, code); err != nil {
		log.Printf("发送密码重置邮件失败: %v", err)
	}

	return nil
}

// ResetPassword 重置密码
// 验证重置码后更新用户密码
func (s *AuthService) ResetPassword(ctx context.Context, email, code, newPassword string) error {
	key := "reset:" + email

	// 从 Redis 获取重置码数据
	data, err := s.getVerificationData(ctx, key)
	if err != nil {
		return ErrInvalidVerificationCode
	}

	// 检查尝试次数
	if data.Attempts >= 5 {
		s.redis.Del(ctx, key)
		return ErrTooManyAttempts
	}

	// 比较哈希值
	codeHash := sha256Hash(code)
	if codeHash != data.CodeHash {
		data.Attempts++
		s.storeVerificationData(ctx, key, *data)
		return ErrInvalidVerificationCode
	}

	// 重置码验证成功，删除 Redis 中的数据
	s.redis.Del(ctx, key)

	// 查询用户
	user, err := s.queries.GetUserByEmail(ctx, email)
	if err != nil {
		return fmt.Errorf("查询用户失败: %w", err)
	}

	// 对新密码进行哈希处理
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("密码哈希失败: %w", err)
	}

	// 更新密码
	if err := s.queries.UpdateUserPassword(ctx, generated.UpdateUserPasswordParams{
		ID:           user.ID,
		PasswordHash: string(hashedPassword),
	}); err != nil {
		return fmt.Errorf("更新密码失败: %w", err)
	}

	// 吊销该用户的所有刷新令牌
	refreshKey := "refresh:" + user.ID.String()
	s.redis.Del(ctx, refreshKey)

	return nil
}

// GetUserByID 按 ID 查询用户信息
func (s *AuthService) GetUserByID(ctx context.Context, userID string) (*generated.User, error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("无效的用户 ID: %w", err)
	}

	user, err := s.queries.GetUserByID(ctx, userUUID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("查询用户失败: %w", err)
	}

	return user, nil
}

// UpdateProfile 更新用户个人资料
func (s *AuthService) UpdateProfile(ctx context.Context, userID, username, bio, avatarURL string) (*generated.User, error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("无效的用户 ID: %w", err)
	}

	// 如果要修改用户名，检查是否已被占用
	existing, err := s.queries.GetUserByUsername(ctx, username)
	if err == nil && existing.ID != userUUID {
		return nil, ErrUsernameAlreadyExists
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("查询用户名失败: %w", err)
	}

	var bioNull sql.NullString
	if bio != "" {
		bioNull = sql.NullString{String: bio, Valid: true}
	}
	var avatarNull sql.NullString
	if avatarURL != "" {
		avatarNull = sql.NullString{String: avatarURL, Valid: true}
	}

	user, err := s.queries.UpdateUserProfile(ctx, generated.UpdateUserProfileParams{
		ID:        userUUID,
		Username:  username,
		Bio:       bioNull,
		AvatarUrl: avatarNull,
	})
	if err != nil {
		return nil, fmt.Errorf("更新个人资料失败: %w", err)
	}

	return user, nil
}

// UpdatePassword 修改密码（需验证旧密码）
func (s *AuthService) UpdatePassword(ctx context.Context, userID, oldPassword, newPassword string) error {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("无效的用户 ID: %w", err)
	}

	user, err := s.queries.GetUserByID(ctx, userUUID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrUserNotFound
		}
		return fmt.Errorf("查询用户失败: %w", err)
	}

	// 验证旧密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(oldPassword)); err != nil {
		return ErrInvalidCredentials
	}

	// 哈希新密码并更新
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("密码哈希失败: %w", err)
	}

	if err := s.queries.UpdateUserPassword(ctx, generated.UpdateUserPasswordParams{
		ID:           userUUID,
		PasswordHash: string(hashedPassword),
	}); err != nil {
		return fmt.Errorf("更新密码失败: %w", err)
	}

	return nil
}

// --- 内部辅助方法 ---

// generateVerificationCode 生成 6 位数字验证码
// 使用 crypto/rand 确保密码学安全的随机性
func generateVerificationCode() (string, error) {
	// 生成 6 位随机数（000000-999999）
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// sha256Hash 计算字符串的 SHA256 哈希值并返回十六进制字符串
func sha256Hash(input string) string {
	h := sha256.Sum256([]byte(input))
	return hex.EncodeToString(h[:])
}

// storeVerificationCode 将验证码存储到 Redis
// 存储格式为 JSON，包含验证码哈希和尝试次数
func (s *AuthService) storeVerificationCode(ctx context.Context, key, code string) error {
	data := VerificationData{
		CodeHash: sha256Hash(code),
		Attempts: 0,
	}
	return s.storeVerificationData(ctx, key, data)
}

// storeVerificationData 将验证数据序列化后存入 Redis
func (s *AuthService) storeVerificationData(ctx context.Context, key string, data VerificationData) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化验证数据失败: %w", err)
	}
	return s.redis.Set(ctx, key, string(jsonData), 10*time.Minute).Err()
}

// getVerificationData 从 Redis 获取验证数据并反序列化
func (s *AuthService) getVerificationData(ctx context.Context, key string) (*VerificationData, error) {
	jsonData, err := s.redis.Get(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var data VerificationData
	if err := json.Unmarshal([]byte(jsonData), &data); err != nil {
		return nil, fmt.Errorf("反序列化验证数据失败: %w", err)
	}

	return &data, nil
}

// generateTokenPair 生成访问令牌和刷新令牌
func (s *AuthService) generateTokenPair(userID, email, role string) (*TokenPair, error) {
	now := time.Now()

	// 生成访问令牌
	accessClaims := &JWTClaims{
		UserID: userID,
		Email:  email,
		Role:   role,
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

	// 生成刷新令牌
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
		AccessToken:       accessTokenString,
		RefreshToken:      refreshTokenString,
		ExpiresIn:         int64(s.config.JWTAccessTokenTTL.Seconds()),
		RefreshExpiresIn:  int64(s.config.JWTRefreshTokenTTL.Seconds()),
	}, nil
}

// parseToken 解析并验证 JWT 令牌
// 使用 ES256 公钥验证签名和过期时间
func (s *AuthService) parseToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		// 验证签名算法
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
// 供中间件调用，验证 JWT 令牌的有效性
func (s *AuthService) ValidateToken(tokenString string) (*JWTClaims, error) {
	return s.parseToken(tokenString)
}

// loadOrGenerateKeys 加载或生成 ES256 密钥对
// 优先从文件加载，若文件不存在则生成临时密钥对（仅用于开发环境）
func loadOrGenerateKeys(privateKeyPath, publicKeyPath string) (*ecdsa.PrivateKey, *ecdsa.PublicKey, error) {
	if privateKeyPath != "" && publicKeyPath != "" {
		return loadKeysFromFiles(privateKeyPath, publicKeyPath)
	}

	// 开发环境：生成临时密钥对
	log.Println("警告: 未配置 JWT 密钥文件，使用临时密钥对（仅适用于开发环境）")
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, nil, fmt.Errorf("生成 ECDSA 密钥失败: %w", err)
	}
	return privateKey, &privateKey.PublicKey, nil
}

// loadKeysFromFiles 从 PEM 文件加载 ES256 密钥对
func loadKeysFromFiles(privateKeyPath, publicKeyPath string) (*ecdsa.PrivateKey, *ecdsa.PublicKey, error) {
	// 加载私钥
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

	// 加载公钥
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
