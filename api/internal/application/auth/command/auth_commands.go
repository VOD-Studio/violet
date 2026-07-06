// Package command 提供 auth/user 聚合的写操作用例（CQRS Command 侧）。
//
// 按 CQRS 拆分为独立 command handler。
package command

import (
	"context"
	"errors"

	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/session"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
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
	SendPasswordResetCode(ctx context.Context, email, code string) error
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
	codeStore   appshared.CodeStore
	emailSender EmailSender
	hasher      PasswordHasher
	bus         appshared.EventBus
}

// NewRegisterUserHandler 构造注册用例
func NewRegisterUserHandler(
	repo user.UserRepository,
	codeStore appshared.CodeStore,
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
//
// 查重策略（处理「已注册但未验证」的死号）：
//   - email 已存在且已验证 → 冲突，不可覆盖
//   - email 已存在但未验证 → 覆盖该记录（更新 username/password）并重发验证码，
//     让中断的注册流程能继续。覆盖前校验新 username 未被其他已验证用户占用。
//   - email 不存在 → 正常注册新用户
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

	// 2. 密码哈希（查重前先算好，覆盖/新建都要用）
	hash, err := h.hasher.Hash(in.Password)
	if err != nil {
		return shared.Internal("密码哈希失败", err)
	}

	// 3. email 查重：区分已验证 / 未验证
	existing, err := h.userRepo.FindByEmail(ctx, email)
	if err != nil && !shared.IsDomainError(err, shared.CodeNotFound) {
		return err
	}

	var u *user.User
	if existing != nil {
		// 已验证用户不可覆盖
		if err := existing.ReRegister(username, hash); err != nil {
			return err // ReRegister 内部对已验证用户返回 ErrEmailExists
		}
		// 覆盖前校验：新 username 未被其他已验证用户占用
		if err := h.checkUsernameAvailable(ctx, username, existing.GetID()); err != nil {
			return err
		}
		u = existing
	} else {
		// 新用户：username 不能与任何已存在用户（含未验证死号）冲突
		usernameExists, err := h.userRepo.ExistsByUsername(ctx, username)
		if err != nil {
			return err
		}
		if usernameExists {
			// 可能是别人未验证的死号占用了该 username，但为避免误覆盖他人账号，
			// 这里直接报冲突，让用户换 username（覆盖仅以 email 为准）
			return user.ErrUsernameExists
		}
		u = user.NewUser(shared.NewID(), email, username, hash)
		u.Deactivate() // 注册用户默认未激活（需邮箱验证）
	}

	// 4. 持久化（新建 or 覆盖更新）
	if err := h.userRepo.Save(ctx, u); err != nil {
		return err
	}

	// 5. 生成验证码并存 Redis
	code, err := generateVerificationCode()
	if err != nil {
		return shared.Internal("生成验证码失败", err)
	}
	codeHash := sha256Hash(code)
	if err := h.codeStore.Store(ctx, "verify", email.String(), codeHash); err != nil {
		log.Error().Err(err).Msg("存储验证码失败")
	}

	// 6. 发送验证邮件（失败不阻塞注册）
	if err := h.emailSender.SendVerificationCode(ctx, email.String(), code); err != nil {
		log.Warn().Err(err).Str("email", email.String()).Msg("发送验证邮件失败")
	}

	// 7. 发布事件
	if events := u.PullEvents(); len(events) > 0 {
		_ = h.bus.Publish(ctx, events)
	}

	return nil
}

// checkUsernameAvailable 校验 username 未被「其他已验证用户」占用
//
// 覆盖未验证账号时调用：允许占用其他未验证死号的 username，但不能撞已验证用户的。
func (h *RegisterUserHandler) checkUsernameAvailable(ctx context.Context, username user.Username, excludeID shared.ID) error {
	holder, err := h.userRepo.FindByUsername(ctx, username)
	if err != nil && !shared.IsDomainError(err, shared.CodeNotFound) {
		return err
	}
	if holder == nil {
		return nil // 无人占用
	}
	// 占用者是当前正在覆盖的用户自己 → 允许
	if holder.GetID() == excludeID {
		return nil
	}
	// 占用者已验证 → 不可占用
	if holder.EmailVerified() {
		return user.ErrUsernameExists
	}
	// 占用者是另一个未验证死号 → 允许覆盖其 username（注册流程以 email 为准）
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

// LoginOutput 登录出参。
// 仅返回 userID：session 创建交由 CreateSessionHandler 统一编排
// （HTTP 层先调 login 拿 userID，再调 CreateSession 创建 session 并下发 cookie）。
type LoginOutput struct {
	UserID string
}

// LoginHandler 登录用例
//
// 编排：
// 1. 按邮箱查找用户
// 2. 校验密码
// 3. 校验账户状态（已激活）
// 4. 返回 userID（session 创建交由 CreateSessionHandler）
type LoginHandler struct {
	userRepo user.UserRepository
	hasher   PasswordHasher
}

// NewLoginHandler 构造登录用例。
// 仅校验凭证与账户状态，不在此处创建 session。
func NewLoginHandler(
	repo user.UserRepository,
	hasher PasswordHasher,
) *LoginHandler {
	return &LoginHandler{userRepo: repo, hasher: hasher}
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

	// 3. 校验账户状态：先判邮箱是否已验证，再判账户是否被禁用，
	//    分别返回明确原因（之前两类状态都返回 ErrAccountDisabled，
	//    导致未验证用户看到「账户已被禁用」的误导文案）。
	if !u.EmailVerified() {
		return LoginOutput{}, user.ErrEmailNotVerified
	}
	if !u.IsActive() {
		return LoginOutput{}, user.ErrAccountDisabled
	}

	return LoginOutput{UserID: u.GetID().String()}, nil
}

// ============================================================
// Logout 登出
// ============================================================

// LogoutInput 登出入参。
// SessionID 由鉴权中间件从 cookie 读出注入 ctx，据此删除当前设备 session。
type LogoutInput struct {
	UserID    string
	SessionID string
}

// LogoutHandler 登出用例：删除当前 session（登出当前设备），不影响该用户其他设备。
type LogoutHandler struct {
	store appshared.SessionStore
}

// NewLogoutHandler 构造登出用例。
func NewLogoutHandler(store appshared.SessionStore) *LogoutHandler {
	return &LogoutHandler{store: store}
}

// Handle 执行登出。
// session 删除失败会让已登出设备的 session 继续有效，故返回错误交由上层记日志。
func (h *LogoutHandler) Handle(ctx context.Context, in LogoutInput) error {
	return h.store.DeleteForUser(ctx, in.UserID, session.ID(in.SessionID))
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
// 1. 解析 refresh token（验签 + exp + issuer）
// 2. 重新查询用户（获取最新角色）
// 3. 生成新 token pair
// 4. 原子轮换：校验旧 token + 写入新 token + 重用检测（见 ADR-0001 不变量 1、2）
//
// 重用检测：若入参 token 与 Redis 当前值不匹配（重放已废弃 token），整个家族被吊销，
// 返回 ErrInvalidCredentials 触发前端强制重登。
type RefreshTokenHandler struct {
	userRepo   user.UserRepository
	jwt        appshared.TokenService
	tokenStore appshared.TokenStore
}

// NewRefreshTokenHandler 构造刷新令牌用例
func NewRefreshTokenHandler(
	repo user.UserRepository,
	jwt appshared.TokenService,
	tokenStore appshared.TokenStore,
) *RefreshTokenHandler {
	return &RefreshTokenHandler{userRepo: repo, jwt: jwt, tokenStore: tokenStore}
}

// Handle 执行刷新令牌
func (h *RefreshTokenHandler) Handle(ctx context.Context, in RefreshTokenInput) (*appshared.TokenPair, error) {
	// 1. 解析 token（验签 + 过期 + 颁发者）
	claims, err := h.jwt.ParseToken(in.RefreshToken)
	if err != nil {
		log.Warn().
			Str("reason", "parse_failed").
			Err(err).
			Str("token_prefix", tokenPrefix(in.RefreshToken)).
			Msg("refresh 失败：令牌解析失败（验签/过期/颁发者）")
		return nil, user.ErrInvalidCredentials
	}

	// 2. 重新查询用户（获取最新角色）
	//    token 已通过签名校验，若 subject 不是合法 ID，说明是失效/异常凭证，
	//    应映射为 401（触发前端重登）而非 500。
	id, err := shared.ParseID(claims.UserID)
	if err != nil {
		log.Warn().
			Str("reason", "invalid_subject").
			Str("subject", claims.UserID).
			Msg("refresh 失败：subject 不是合法用户 ID")
		return nil, user.ErrInvalidCredentials
	}
	u, err := h.userRepo.FindByID(ctx, id)
	if err != nil {
		// 用户已被删除（token 仍有效但用户不存在）→ 401 强制重登；
		// 仅真实 DB 故障才视为 500。
		if errors.Is(err, user.ErrNotFound) {
			log.Warn().
				Str("reason", "user_not_found").
				Str("user_id", id.String()).
				Msg("refresh 失败：用户不存在（可能已删除）")
			return nil, user.ErrInvalidCredentials
		}
		return nil, shared.Internal("查询用户失败", err)
	}

	// 3. 生成新 token pair（JWT 签名必须在 Go 内完成）
	pair, err := h.jwt.GenerateTokenPair(appshared.TokenInput{
		UserID:              u.GetID().String(),
		Email:               u.Email().String(),
		Role:                string(u.Role()),
		IsBuiltinSuperAdmin: u.IsBuiltinSuperAdmin(),
	})
	if err != nil {
		return nil, shared.Internal("生成令牌失败", err)
	}

	// 4. 原子轮换：单次 Redis 操作内校验旧 token + 写入新 token + 重用检测。
	//    见 ADR-0001：Verify+Save 非原子会导致并发刷新铸出多对 token；
	//    重用旧 token 时吊销整个家族。
	res, err := h.tokenStore.Rotate(ctx, u.GetID().String(), in.RefreshToken, pair.RefreshToken)
	if err != nil {
		return nil, shared.Internal("轮换 refresh token 失败", err)
	}
	switch res {
	case appshared.RotateSuccess:
		return pair, nil
	case appshared.RotateReused:
		// 重用已废弃 token → 整个家族已被吊销 → 401 强制重登
		log.Warn().
			Str("reason", "rotate_reused").
			Str("user_id", u.GetID().String()).
			Str("token_prefix", tokenPrefix(in.RefreshToken)).
			Msg("refresh 失败：检测到 refresh token 重用，家族已被吊销")
		return nil, user.ErrInvalidCredentials
	default:
		// RotateInvalid：无存储 token（已登出）→ 401
		log.Warn().
			Str("reason", "rotate_invalid").
			Str("user_id", u.GetID().String()).
			Str("token_prefix", tokenPrefix(in.RefreshToken)).
			Msg("refresh 失败：白名单无此 token（已登出或被覆盖）")
		return nil, user.ErrInvalidCredentials
	}
}

// tokenPrefix 返回 refresh token 的脱敏前缀（前 16 字符），用于日志关联而不泄露完整凭证。
func tokenPrefix(token string) string {
	if len(token) > 16 {
		return token[:16]
	}
	return token
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
	codeStore appshared.CodeStore
}

// NewVerifyEmailHandler 构造邮箱验证用例
func NewVerifyEmailHandler(repo user.UserRepository, codeStore appshared.CodeStore) *VerifyEmailHandler {
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

// generateVerificationCode 生成 6 位数字验证码（委托给 application/shared，保留包内薄包装）
func generateVerificationCode() (string, error) {
	return appshared.GenerateVerificationCode()
}

// sha256Hash SHA256 哈希（委托给 application/shared）
func sha256Hash(input string) string {
	return appshared.SHA256Hash(input)
}
