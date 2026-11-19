// Package command 提供 auth/user 聚合的写操作用例（CQRS Command 侧）。
//
// 按 CQRS 拆分为独立 command handler。
package command

import (
	"context"
	"strings"

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
// Login 登录
// ============================================================

// LoginInput 登录入参
type LoginInput struct {
	// Identifier 登录标识符，可为邮箱或用户名
	Identifier string
	Password   string
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
// 1. 按邮箱或用户名查找用户
// 2. 校验密码
// 3. 校验账户状态（已激活）
// 4. 发布登录成功/失败事件（审计）
// 5. 返回 userID（session 创建交由 CreateSessionHandler）
type LoginHandler struct {
	userRepo user.UserRepository
	hasher   PasswordHasher
	bus      appshared.EventBus
}

// NewLoginHandler 构造登录用例。
// 仅校验凭证与账户状态，不在此处创建 session。
func NewLoginHandler(
	repo user.UserRepository,
	hasher PasswordHasher,
	bus appshared.EventBus,
) *LoginHandler {
	return &LoginHandler{userRepo: repo, hasher: hasher, bus: bus}
}

// Handle 执行登录
func (h *LoginHandler) Handle(ctx context.Context, in LoginInput) (LoginOutput, error) {
	// 1. 按邮箱或用户名查找用户
	u, err := h.findUserByIdentifier(ctx, in.Identifier)
	if err != nil {
		// 用户不存在统一返回无效凭证（不暴露账号是否注册），
		// 但记审计（账号探测/暴力破解也要有痕迹）
		h.publishFailed(ctx, "用户不存在")
		return LoginOutput{}, user.ErrInvalidCredentials
	}

	// 2. 校验密码
	if err := h.hasher.Compare(u.PasswordHash(), in.Password); err != nil {
		h.publishFailed(ctx, "密码错误")
		return LoginOutput{}, user.ErrInvalidCredentials
	}

	// 3. 校验账户状态：先判邮箱是否已验证，再判账户是否被禁用，
	//    分别返回明确原因（之前两类状态都返回 ErrAccountDisabled，
	//    导致未验证用户看到「账户已被禁用」的误导文案）。
	if !u.EmailVerified() {
		h.publishFailed(ctx, "邮箱未验证")
		return LoginOutput{}, user.ErrEmailNotVerified
	}
	if !u.IsActive() {
		h.publishFailed(ctx, "账户已禁用")
		return LoginOutput{}, user.ErrAccountDisabled
	}

	// 4. 发布登录成功事件（审计）
	if err := h.bus.Publish(ctx, []shared.DomainEvent{NewUserLoggedIn(u.GetID(), "password")}); err != nil {
		log.Warn().Err(err).Msg("发布登录事件失败")
	}

	return LoginOutput{UserID: u.GetID().String()}, nil
}

// findUserByIdentifier 按邮箱或用户名查找用户。
// 含 @ 视为邮箱，否则视为用户名（与 GitHub/GitLab 等主流平台一致）。
// 格式无效或用户不存在均返回错误，由 Handle 统一处理为无效凭证（不暴露账号是否存在）。
func (h *LoginHandler) findUserByIdentifier(ctx context.Context, identifier string) (*user.User, error) {
	identifier = strings.TrimSpace(identifier)
	if strings.Contains(identifier, "@") {
		email, err := user.ParseEmail(identifier)
		if err != nil {
			return nil, err
		}
		return h.userRepo.FindByEmail(ctx, email)
	}
	username, err := user.ParseUsername(identifier)
	if err != nil {
		return nil, err
	}
	return h.userRepo.FindByUsername(ctx, username)
}

// publishFailed 发布登录失败事件（失败原因不记密码明文）
func (h *LoginHandler) publishFailed(ctx context.Context, reason string) {
	if err := h.bus.Publish(ctx, []shared.DomainEvent{NewUserLoginFailed(reason)}); err != nil {
		log.Warn().Err(err).Msg("发布登录失败事件失败")
	}
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
	bus   appshared.EventBus
}

// NewLogoutHandler 构造登出用例。
func NewLogoutHandler(store appshared.SessionStore, bus appshared.EventBus) *LogoutHandler {
	return &LogoutHandler{store: store, bus: bus}
}

// Handle 执行登出。
// session 删除失败会让已登出设备的 session 继续有效，故返回错误交由上层记日志。
func (h *LogoutHandler) Handle(ctx context.Context, in LogoutInput) error {
	if err := h.store.DeleteForUser(ctx, in.UserID, session.ID(in.SessionID)); err != nil {
		return err
	}
	// 发布登出事件（审计）。userID 解析失败时降级为不记（登出已成功）。
	uid, err := shared.ParseID(in.UserID)
	if err != nil {
		log.Warn().Err(err).Msg("解析登出用户 ID 失败，跳过登出审计")
		return nil
	}
	if err := h.bus.Publish(ctx, []shared.DomainEvent{NewUserLoggedOut(uid)}); err != nil {
		log.Warn().Err(err).Msg("发布登出事件失败")
	}
	return nil
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
