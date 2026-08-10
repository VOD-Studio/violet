package command

import (
	"context"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
)

// ============================================================
// ForgotPassword 忘记密码（发送重置码）
// ============================================================

// ForgotPasswordInput 忘记密码入参
type ForgotPasswordInput struct {
	Email string
}

// ForgotPasswordHandler 忘记密码用例
//
// 安全设计：即使用户不存在也返回成功（不暴露邮箱是否注册）。
type ForgotPasswordHandler struct {
	userRepo    user.UserRepository
	codeStore   appshared.CodeStore
	emailSender EmailSender
	hasher      PasswordHasher
}

// NewForgotPasswordHandler 构造忘记密码用例。
// ForgotPassword 仅发送重置码，不吊销 session（session 在 ResetPassword 改密后吊销）。
func NewForgotPasswordHandler(
	repo user.UserRepository,
	codeStore appshared.CodeStore,
	emailSender EmailSender,
	hasher PasswordHasher,
) *ForgotPasswordHandler {
	return &ForgotPasswordHandler{
		userRepo: repo, codeStore: codeStore,
		emailSender: emailSender, hasher: hasher,
	}
}

// Handle 执行忘记密码
func (h *ForgotPasswordHandler) Handle(ctx context.Context, in ForgotPasswordInput) error {
	email, err := user.ParseEmail(in.Email)
	if err != nil {
		return err
	}

	// 查找用户（不存在则静默成功，不暴露）
	u, err := h.userRepo.FindByEmail(ctx, email)
	if err != nil {
		log.Debug().Str("email", email.String()).Msg("忘记密码：用户不存在，静默成功")
		return nil // 静默成功
	}

	// 生成重置码
	code, err := generateVerificationCode()
	if err != nil {
		return shared.Internal("生成重置码失败", err)
	}
	codeHash := sha256Hash(code)
	if err := h.codeStore.Store(ctx, "reset", email.String(), codeHash); err != nil {
		return shared.Internal("存储重置码失败", err)
	}

	// 发送重置邮件（用专门的重置码模板，而非注册验证模板）
	if err := h.emailSender.SendPasswordResetCode(ctx, email.String(), code); err != nil {
		log.Warn().Err(err).Str("email", email.String()).Msg("发送重置邮件失败")
	}

	_ = u // 用户存在但不在此处修改（ResetPassword 时处理）
	return nil
}

// ============================================================
// ResetPassword 重置密码
// ============================================================

// ResetPasswordInput 重置密码入参
type ResetPasswordInput struct {
	Email       string
	Code        string
	NewPassword string
}

// ResetPasswordHandler 重置密码用例
type ResetPasswordHandler struct {
	userRepo     user.UserRepository
	codeStore    appshared.CodeStore
	hasher       PasswordHasher
	sessionStore appshared.SessionStore
}

// NewResetPasswordHandler 构造重置密码用例。
// 改密成功后吊销该用户全部 session（DeleteByUser），强制所有设备重登。
func NewResetPasswordHandler(
	repo user.UserRepository,
	codeStore appshared.CodeStore,
	hasher PasswordHasher,
	sessionStore appshared.SessionStore,
) *ResetPasswordHandler {
	return &ResetPasswordHandler{
		userRepo: repo, codeStore: codeStore,
		hasher: hasher, sessionStore: sessionStore,
	}
}

// Handle 执行重置密码
func (h *ResetPasswordHandler) Handle(ctx context.Context, in ResetPasswordInput) error {
	email, err := user.ParseEmail(in.Email)
	if err != nil {
		return err
	}

	// 校验重置码
	codeHash := sha256Hash(in.Code)
	matched, err := h.codeStore.Verify(ctx, "reset", email.String(), codeHash)
	if err != nil {
		return shared.Internal("重置码校验失败", err)
	}
	if !matched {
		return user.ErrInvalidCredentials
	}

	// 查找用户
	u, err := h.userRepo.FindByEmail(ctx, email)
	if err != nil {
		return err
	}

	// 哈希新密码 + 聚合方法
	newHash, err := h.hasher.Hash(in.NewPassword)
	if err != nil {
		return shared.Internal("密码哈希失败", err)
	}
	u.ChangePassword(newHash)

	// 持久化
	if err := h.userRepo.Save(ctx, u); err != nil {
		return err
	}

	// 吊销该用户全部 session（强制所有设备重登）。
	// 失败仅记日志：密码 DB 写入已成功，返回 500 会让用户误以为改密失败；
	// 接受「Redis 故障下旧 session 可能短暂有效」的降级，运维据此排查 Redis。
	if err := h.sessionStore.DeleteByUser(ctx, u.GetID().String()); err != nil {
		log.Error().Err(err).Stringer("userID", u.GetID()).Msg("改密后吊销 session 失败")
	}

	return nil
}

// ============================================================
// UpdateProfile 更新个人资料
// ============================================================

// UpdateProfileInput 更新资料入参
//
// 所有字段为指针，nil 表示不更新该字段，空字符串表示清空。
type UpdateProfileInput struct {
	UserID     string
	Username   *string
	DisplayName *string
	Bio        *string
	AvatarURL  *string
}

// UpdateProfileHandler 更新个人资料用例
type UpdateProfileHandler struct {
	userRepo user.UserRepository
}

// NewUpdateProfileHandler 构造更新资料用例
func NewUpdateProfileHandler(repo user.UserRepository) *UpdateProfileHandler {
	return &UpdateProfileHandler{userRepo: repo}
}

// Handle 执行更新资料
func (h *UpdateProfileHandler) Handle(ctx context.Context, in UpdateProfileInput) (*user.User, error) {
	id, err := shared.ParseID(in.UserID)
	if err != nil {
		return nil, shared.BadRequest("无效的用户 ID")
	}

	u, err := h.userRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// 用户名变更需查重
	if in.Username != nil && *in.Username != u.Username().String() {
		username, err := user.ParseUsername(*in.Username)
		if err != nil {
			return nil, err
		}
		exists, err := h.userRepo.ExistsByUsername(ctx, username)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, user.ErrUsernameExists
		}
		u.ChangeUsername(username)
	}

	// 显示名变更（允许重复，无需查重；空串=清除，回退 username）
	if in.DisplayName != nil {
		displayName, err := user.ParseDisplayName(*in.DisplayName)
		if err != nil {
			return nil, err
		}
		u.UpdateDisplayName(displayName)
	}

	if in.AvatarURL != nil {
		u.UpdateAvatarURL(*in.AvatarURL)
	}

	if in.Bio != nil {
		u.UpdateBio(*in.Bio)
	}

	if err := h.userRepo.Save(ctx, u); err != nil {
		return nil, err
	}
	return u, nil
}

// ============================================================
// ChangePassword 修改密码（已登录用户）
// ============================================================

// ChangePasswordInput 修改密码入参
type ChangePasswordInput struct {
	UserID      string
	OldPassword string
	NewPassword string
}

// ChangePasswordHandler 修改密码用例
type ChangePasswordHandler struct {
	userRepo     user.UserRepository
	hasher       PasswordHasher
	sessionStore appshared.SessionStore
}

// NewChangePasswordHandler 构造修改密码用例。
// 改密成功后吊销该用户全部 session（DeleteByUser），强制所有设备重登。
func NewChangePasswordHandler(
	repo user.UserRepository,
	hasher PasswordHasher,
	sessionStore appshared.SessionStore,
) *ChangePasswordHandler {
	return &ChangePasswordHandler{userRepo: repo, hasher: hasher, sessionStore: sessionStore}
}

// Handle 执行修改密码
func (h *ChangePasswordHandler) Handle(ctx context.Context, in ChangePasswordInput) error {
	id, err := shared.ParseID(in.UserID)
	if err != nil {
		return shared.BadRequest("无效的用户 ID")
	}

	u, err := h.userRepo.FindByID(ctx, id)
	if err != nil {
		return err
	}

	// 校验旧密码
	if err := h.hasher.Compare(u.PasswordHash(), in.OldPassword); err != nil {
		return user.ErrInvalidCredentials
	}

	// 哈希新密码
	newHash, err := h.hasher.Hash(in.NewPassword)
	if err != nil {
		return shared.Internal("密码哈希失败", err)
	}
	u.ChangePassword(newHash)

	// 持久化
	if err := h.userRepo.Save(ctx, u); err != nil {
		return err
	}

	// 吊销该用户全部 session（强制所有设备重登）。
	// 失败仅记日志：密码 DB 写入已完成，返回错误会让用户以为改密失败。
	if err := h.sessionStore.DeleteByUser(ctx, u.GetID().String()); err != nil {
		log.Error().Err(err).Stringer("userID", u.GetID()).Msg("改密后吊销 session 失败")
	}

	return nil
}
