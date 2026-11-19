package command

import (
	"context"
	"crypto/rand"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
)

type registrationRepository interface {
	FindByEmail(context.Context, user.Email) (*user.User, error)
	FindByUsername(context.Context, user.Username) (*user.User, error)
	FindPendingRegistration(context.Context, string) (*user.User, error)
	CreatePendingRegistration(context.Context, *user.User, string) error
	SavePendingRegistration(context.Context, *user.User, user.Email, user.PasswordHash) error
}

// RegisterUserInput 接受新注册资料或继续同一次待验证注册。
type RegisterUserInput struct {
	Email    string
	Username string
	Password string
	// RegistrationToken 非空时只能修改该凭据关联的待验证记录。
	RegistrationToken string
}

type RegisterUserOutput struct {
	// RegistrationToken 创建记录时签发；不向仅凭邮箱恢复注册的请求签发。
	RegistrationToken string `json:"registration_token,omitempty"`
}

type RegisterUserHandler struct {
	userRepo    registrationRepository
	codeStore   appshared.CodeStore
	emailSender EmailSender
	hasher      PasswordHasher
	bus         appshared.EventBus
}

func NewRegisterUserHandler(
	repo registrationRepository,
	codeStore appshared.CodeStore,
	emailSender EmailSender,
	hasher PasswordHasher,
	bus appshared.EventBus,
) *RegisterUserHandler {
	return &RegisterUserHandler{userRepo: repo, codeStore: codeStore, emailSender: emailSender, hasher: hasher, bus: bus}
}

// Handle 只有原始注册凭据持有者可更改邮箱，不凭用户名认领未激活账号。
func (h *RegisterUserHandler) Handle(ctx context.Context, in RegisterUserInput) (RegisterUserOutput, error) {
	email, err := user.ParseEmail(in.Email)
	if err != nil {
		return RegisterUserOutput{}, err
	}
	username, err := user.ParseUsername(in.Username)
	if err != nil {
		return RegisterUserOutput{}, err
	}

	u, err := h.pendingUser(ctx, in.RegistrationToken, email)
	if err != nil {
		return RegisterUserOutput{}, err
	}
	holder, err := h.userRepo.FindByUsername(ctx, username)
	if err != nil && !shared.IsDomainError(err, shared.CodeNotFound) {
		return RegisterUserOutput{}, err
	}
	if holder != nil && (u == nil || holder.GetID() != u.GetID()) {
		return RegisterUserOutput{}, user.ErrUsernameExists
	}
	hash, err := h.hasher.Hash(in.Password)
	if err != nil {
		return RegisterUserOutput{}, shared.Internal("密码哈希失败", err)
	}
	code, err := generateVerificationCode()
	if err != nil {
		return RegisterUserOutput{}, shared.Internal("生成验证码失败", err)
	}

	var out RegisterUserOutput
	if u == nil {
		u = user.NewUser(shared.NewID(), email, username, hash)
		u.Deactivate()
		out.RegistrationToken = rand.Text()
		err = h.userRepo.CreatePendingRegistration(ctx, u, sha256Hash(out.RegistrationToken))
	} else {
		previousEmail, previousHash := u.Email(), u.PasswordHash()
		if err := u.ReRegister(email, username, hash); err != nil {
			return RegisterUserOutput{}, err
		}
		err = h.userRepo.SavePendingRegistration(ctx, u, previousEmail, previousHash)
	}
	if err != nil {
		return RegisterUserOutput{}, err
	}

	if err := h.codeStore.Store(ctx, "verify", registrationCodeKey(u), sha256Hash(code)); err != nil {
		log.Error().Err(err).Msg("存储验证码失败")
	}
	if err := h.emailSender.SendVerificationCode(ctx, email.String(), code); err != nil {
		log.Warn().Err(err).Str("email", email.String()).Msg("发送验证邮件失败")
	}
	if events := u.PullEvents(); len(events) > 0 {
		_ = h.bus.Publish(ctx, events)
	}
	return out, nil
}

func (h *RegisterUserHandler) pendingUser(ctx context.Context, token string, email user.Email) (*user.User, error) {
	if token != "" {
		u, err := h.userRepo.FindPendingRegistration(ctx, sha256Hash(token))
		if shared.IsDomainError(err, shared.CodeNotFound) {
			return nil, shared.Conflict("待验证注册已失效，请重新打开注册页")
		}
		return u, err
	}
	u, err := h.userRepo.FindByEmail(ctx, email)
	if shared.IsDomainError(err, shared.CodeNotFound) {
		return nil, nil
	}
	if err == nil && u.EmailVerified() {
		return nil, user.ErrEmailExists
	}
	return u, err
}

// 注册重发和改址都会生成带新盐的密码哈希；旧码只能用于原来的记录版本。
func registrationCodeKey(u *user.User) string {
	return sha256Hash(u.GetID().String() + ":" + u.Email().String() + ":" + u.PasswordHash().String())
}

type VerifyEmailInput struct {
	Email string
	Code  string
}

type VerifyEmailHandler struct {
	userRepo  registrationRepository
	codeStore appshared.CodeStore
	bus       appshared.EventBus
}

func NewVerifyEmailHandler(repo registrationRepository, codeStore appshared.CodeStore, bus appshared.EventBus) *VerifyEmailHandler {
	return &VerifyEmailHandler{userRepo: repo, codeStore: codeStore, bus: bus}
}

// Handle 用发送给当前邮箱的验证码激活对应的待验证注册。
func (h *VerifyEmailHandler) Handle(ctx context.Context, in VerifyEmailInput) error {
	email, err := user.ParseEmail(in.Email)
	if err != nil {
		return err
	}
	u, err := h.userRepo.FindByEmail(ctx, email)
	if shared.IsDomainError(err, shared.CodeNotFound) {
		return user.ErrInvalidCredentials
	}
	if err != nil {
		return err
	}
	if u.EmailVerified() {
		return user.ErrInvalidCredentials
	}
	matched, err := h.codeStore.Verify(ctx, "verify", registrationCodeKey(u), sha256Hash(in.Code))
	if err != nil {
		return shared.Internal("验证码校验失败", err)
	}
	if !matched {
		return user.ErrInvalidCredentials
	}

	u.VerifyEmail()
	u.Activate()
	if err := h.userRepo.SavePendingRegistration(ctx, u, email, u.PasswordHash()); err != nil {
		return err
	}
	if events := u.PullEvents(); len(events) > 0 {
		if err := h.bus.Publish(ctx, events); err != nil {
			log.Warn().Err(err).Msg("发布邮箱验证事件失败")
		}
	}
	return nil
}
