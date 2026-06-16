// Package command 提供 auth/user 聚合的写操作用例（CQRS Command 侧）。
//
// 迁移自旧 service/auth_service.go + verification_service.go + profile_service.go，
// 按 CQRS 拆分为独立 command handler。
package command

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"

	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
	"blog-api/internal/infrastructure/auth"
)

// ============================================================
// 端口定义（基础设施接口）
// ============================================================

// PasswordHasher 密码哈希端口
type PasswordHasher interface {
	Hash(plain string) (user.PasswordHash, error)
	Compare(hash user.PasswordHash, plain string) error
}

// EmailSender 邮件发送端口
type EmailSender interface {
	SendVerificationCode(ctx context.Context, email, code string) error
}

// ============================================================
// RegisterUser 注册用户
// ============================================================

// RegisterUserInput 注册入参
type RegisterUserInput struct {
	Email    string
	Username string
	Password string
}

// RegisterUserHandler 用户注册用例
//
// 编排：
// 1. 值对象校验（Email/Username 格式）
// 2. 唯一性查重
// 3. 密码哈希
// 4. 调用 NewUser 工厂（记录 UserRegistered 事件）
// 5. 持久化（初始 is_active=false，需邮箱验证后激活）
// 6. 生成验证码，存 Redis，发邮件
// 7. 发布事件
type RegisterUserHandler struct {
	userRepo    user.UserRepository
	codeStore   *auth.RedisCodeStore
	emailSender EmailSender
	hasher      PasswordHasher
	bus         appshared.EventBus
}

// NewRegisterUserHandler 构造注册用例
func NewRegisterUserHandler(
	repo user.UserRepository,
	codeStore *auth.RedisCodeStore,
	emailSender EmailSender,
	hasher PasswordHasher,
	bus appshared.EventBus,
) *RegisterUserHandler {
	return &RegisterUserHandler{
		userRepo: repo, codeStore: codeStore,
		emailSender: emailSender, hasher: hasher, bus: bus,
	}
}

// Handle 执行用户注册
func (h *RegisterUserHandler) Handle(ctx context.Context, in RegisterUserInput) error {
	// 1. 值对象校验
	email, err := user.ParseEmail(in.Email)
	if err != nil {
		return err
	}
	username, err := user.ParseUsername(in.Username)
	if err != nil {
		return err
	}

	// 2. 唯一性查重
	emailExists, err := h.userRepo.ExistsByEmail(ctx, email)
	if err != nil {
		return err
	}
	if emailExists {
		return user.ErrEmailExists
	}
	usernameExists, err := h.userRepo.ExistsByUsername(ctx, username)
	if err != nil {
		return err
	}
	if usernameExists {
		return user.ErrUsernameExists
	}

	// 3. 密码哈希
	hash, err := h.hasher.Hash(in.Password)
	if err != nil {
		return shared.Internal("密码哈希失败", err)
	}

	// 4. 工厂创建聚合
	u := user.NewUser(shared.NewID(), email, username, hash)
	// 注册用户默认未激活（需邮箱验证）
	u.Deactivate()

	// 5. 持久化
	if err := h.userRepo.Save(ctx, u); err != nil {
		return err
	}

	// 6. 生成验证码并存 Redis
	code, err := generateVerificationCode()
	if err != nil {
		return shared.Internal("生成验证码失败", err)
	}
	codeHash := sha256Hash(code)
	if err := h.codeStore.Store(ctx, "verify", email.String(), codeHash); err != nil {
		log.Error().Err(err).Msg("存储验证码失败")
	}

	// 7. 发送验证邮件（失败不阻塞注册）
	if err := h.emailSender.SendVerificationCode(ctx, email.String(), code); err != nil {
		log.Warn().Err(err).Str("email", email.String()).Msg("发送验证邮件失败")
	}

	// 8. 发布事件
	if events := u.PullEvents(); len(events) > 0 {
		_ = h.bus.Publish(ctx, events)
	}

	return nil
}

// ============================================================
// Login 登录
// ============================================================

// LoginInput 登录入参
type LoginInput struct {
	Email    string
	Password string
}

// LoginOutput 登录出参
type LoginOutput struct {
	TokenPair *auth.TokenPair
	UserID    string
}

// LoginHandler 登录用例
//
// 编排：
// 1. 按邮箱查找用户
// 2. 校验密码
// 3. 校验账户状态（已激活）
// 4. 生成 token pair
// 5. 存储 refresh token 到 Redis
type LoginHandler struct {
	userRepo   user.UserRepository
	hasher     PasswordHasher
	jwt        *auth.JWTService
	tokenStore *auth.RedisTokenStore
}

// NewLoginHandler 构造登录用例
func NewLoginHandler(
	repo user.UserRepository,
	hasher PasswordHasher,
	jwt *auth.JWTService,
	tokenStore *auth.RedisTokenStore,
) *LoginHandler {
	return &LoginHandler{userRepo: repo, hasher: hasher, jwt: jwt, tokenStore: tokenStore}
}

// Handle 执行登录
func (h *LoginHandler) Handle(ctx context.Context, in LoginInput) (LoginOutput, error) {
	// 1. 查找用户
	email, err := user.ParseEmail(in.Email)
	if err != nil {
		return LoginOutput{}, user.ErrInvalidCredentials
	}
	u, err := h.userRepo.FindByEmail(ctx, email)
	if err != nil {
		// 用户不存在统一返回无效凭证（不暴露邮箱是否注册）
		return LoginOutput{}, user.ErrInvalidCredentials
	}

	// 2. 校验密码
	if err := h.hasher.Compare(u.PasswordHash(), in.Password); err != nil {
		return LoginOutput{}, user.ErrInvalidCredentials
	}

	// 3. 校验账户状态
	if !u.CanLogin() {
		return LoginOutput{}, user.ErrAccountDisabled
	}

	// 4. 生成 token pair
	pair, err := h.jwt.GenerateTokenPair(auth.TokenInput{
		UserID: u.GetID().String(),
		Email:  u.Email().String(),
		Role:   string(u.Role()),
	})
	if err != nil {
		return LoginOutput{}, shared.Internal("生成令牌失败", err)
	}

	// 5. 存储 refresh token
	if err := h.tokenStore.Save(ctx, u.GetID().String(), pair.RefreshToken); err != nil {
		return LoginOutput{}, shared.Internal("存储 refresh token 失败", err)
	}

	return LoginOutput{TokenPair: pair, UserID: u.GetID().String()}, nil
}

// ============================================================
// Logout 登出
// ============================================================

// LogoutInput 登出入参
type LogoutInput struct {
	UserID string
}

// LogoutHandler 登出用例（删除 Redis 中的 refresh token，实现服务端撤销）
type LogoutHandler struct {
	tokenStore *auth.RedisTokenStore
}

// NewLogoutHandler 构造登出用例
func NewLogoutHandler(tokenStore *auth.RedisTokenStore) *LogoutHandler {
	return &LogoutHandler{tokenStore: tokenStore}
}

// Handle 执行登出
func (h *LogoutHandler) Handle(ctx context.Context, in LogoutInput) error {
	return h.tokenStore.Delete(ctx, in.UserID)
}

// ============================================================
// RefreshToken 刷新令牌
// ============================================================

// RefreshTokenInput 刷新令牌入参
type RefreshTokenInput struct {
	RefreshToken string
}

// RefreshTokenHandler 刷新令牌用例
//
// 编排：
// 1. 解析 refresh token
// 2. 与 Redis 中存储的比对
// 3. 重新查询用户信息
// 4. 生成新 token pair
// 5. 更新 Redis 中的 refresh token
type RefreshTokenHandler struct {
	userRepo   user.UserRepository
	jwt        *auth.JWTService
	tokenStore *auth.RedisTokenStore
}

// NewRefreshTokenHandler 构造刷新令牌用例
func NewRefreshTokenHandler(
	repo user.UserRepository,
	jwt *auth.JWTService,
	tokenStore *auth.RedisTokenStore,
) *RefreshTokenHandler {
	return &RefreshTokenHandler{userRepo: repo, jwt: jwt, tokenStore: tokenStore}
}

// Handle 执行刷新令牌
func (h *RefreshTokenHandler) Handle(ctx context.Context, in RefreshTokenInput) (*auth.TokenPair, error) {
	// 1. 解析 token
	claims, err := h.jwt.ParseToken(in.RefreshToken)
	if err != nil {
		return nil, user.ErrInvalidCredentials
	}

	// 2. 比对 Redis
	matched, err := h.tokenStore.Verify(ctx, claims.UserID, in.RefreshToken)
	if err != nil {
		return nil, shared.Internal("验证 refresh token 失败", err)
	}
	if !matched {
		return nil, user.ErrInvalidCredentials
	}

	// 3. 重新查询用户（获取最新角色）
	id, err := shared.ParseID(claims.UserID)
	if err != nil {
		return nil, shared.Internal("无效的用户 ID", err)
	}
	u, err := h.userRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// 4. 生成新 token pair
	pair, err := h.jwt.GenerateTokenPair(auth.TokenInput{
		UserID: u.GetID().String(),
		Email:  u.Email().String(),
		Role:   string(u.Role()),
	})
	if err != nil {
		return nil, shared.Internal("生成令牌失败", err)
	}

	// 5. 更新 Redis
	if err := h.tokenStore.Save(ctx, u.GetID().String(), pair.RefreshToken); err != nil {
		return nil, shared.Internal("更新 refresh token 失败", err)
	}

	return pair, nil
}

// ============================================================
// VerifyEmail 验证邮箱
// ============================================================

// VerifyEmailInput 邮箱验证入参
type VerifyEmailInput struct {
	Email string
	Code  string
}

// VerifyEmailHandler 邮箱验证用例
//
// 编排：
// 1. 查找用户
// 2. 比对验证码（Redis）
// 3. 聚合方法 VerifyEmail + 激活账户
// 4. 持久化
type VerifyEmailHandler struct {
	userRepo  user.UserRepository
	codeStore *auth.RedisCodeStore
}

// NewVerifyEmailHandler 构造邮箱验证用例
func NewVerifyEmailHandler(repo user.UserRepository, codeStore *auth.RedisCodeStore) *VerifyEmailHandler {
	return &VerifyEmailHandler{userRepo: repo, codeStore: codeStore}
}

// Handle 执行邮箱验证
func (h *VerifyEmailHandler) Handle(ctx context.Context, in VerifyEmailInput) error {
	email, err := user.ParseEmail(in.Email)
	if err != nil {
		return err
	}

	// 查找用户
	u, err := h.userRepo.FindByEmail(ctx, email)
	if err != nil {
		return err
	}

	// 比对验证码
	codeHash := sha256Hash(in.Code)
	matched, err := h.codeStore.Verify(ctx, "verify", email.String(), codeHash)
	if err != nil {
		return shared.Internal("验证码校验失败", err)
	}
	if !matched {
		return user.ErrInvalidCredentials
	}

	// 聚合方法 + 激活
	u.VerifyEmail()
	u.Activate()

	// 持久化
	return h.userRepo.Save(ctx, u)
}

// ============================================================
// 辅助函数
// ============================================================

// BcryptHasher bcrypt 密码哈希实现（与 user/command 包的重复，auth 包独立用）
type BcryptHasher struct{}

// NewBcryptHasher 创建 bcrypt 哈希器
func NewBcryptHasher() *BcryptHasher { return &BcryptHasher{} }

// Hash 使用 bcrypt 哈希
func (BcryptHasher) Hash(plain string) (user.PasswordHash, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		return user.PasswordHash{}, err
	}
	return user.NewPasswordHash(string(hashed)), nil
}

// Compare 比对密码与哈希
func (BcryptHasher) Compare(hash user.PasswordHash, plain string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash.String()), []byte(plain))
}

// generateVerificationCode 生成 6 位数字验证码
func generateVerificationCode() (string, error) {
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", fmt.Errorf("生成随机数失败: %w", err)
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// sha256Hash SHA256 哈希
func sha256Hash(input string) string {
	h := sha256.Sum256([]byte(input))
	return hex.EncodeToString(h[:])
}
