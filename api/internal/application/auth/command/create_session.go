package command

import (
	"context"
	"time"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/session"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
)

// CreateSessionInput 创建 opaque session 的入参。
//
// MaxTTL<=0 表示无绝对寿命上限（仅受 IdleTTL 滑动窗口约束）。
type CreateSessionInput struct {
	// UserID 登录用户唯一标识
	UserID string
	// IdleTTL 滑动续期窗口，每个真实请求重置 session 剩余寿命
	IdleTTL time.Duration
	// MaxTTL 绝对寿命上限，<=0 表示无上限
	MaxTTL time.Duration
}

// CreateSessionOutput 新建的 session 凭证，由 HTTP 层写入 cookie。
type CreateSessionOutput struct {
	// SessionID opaque session id，写入 mimo_session cookie
	SessionID string
	// CSRFToken double-submit CSRF 凭证，写入 mimo_csrf cookie
	CSRFToken string
}

// CreateSessionHandler 登录成功后创建 opaque session。
//
// 编排：FindByID 取用户 → 构造 UserSnapshot → NewSession → SessionStore.Create。
// 与各 login handler 解耦：login 只校验凭证返回 userID，由 HTTP 层统一调本
// handler 创建 session，避免邮箱密码 / Google / Github 三种登录方式重复 session 逻辑。
type CreateSessionHandler struct {
	userRepo user.UserRepository
	store    appshared.SessionStore
}

// NewCreateSessionHandler 构造 CreateSessionHandler。
func NewCreateSessionHandler(repo user.UserRepository, store appshared.SessionStore) *CreateSessionHandler {
	return &CreateSessionHandler{userRepo: repo, store: store}
}

// Handle 执行 session 创建，返回 session id 与 csrf token。
//
// 用户不存在或 id 非法映射为 ErrInvalidCredentials（401），与 login 行为一致。
func (h *CreateSessionHandler) Handle(ctx context.Context, in CreateSessionInput) (CreateSessionOutput, error) {
	id, err := shared.ParseID(in.UserID)
	if err != nil {
		return CreateSessionOutput{}, user.ErrInvalidCredentials
	}
	u, err := h.userRepo.FindByID(ctx, id)
	if err != nil {
		return CreateSessionOutput{}, user.ErrInvalidCredentials
	}
	sess, err := session.NewSession(session.UserSnapshot{
		UserID:              u.GetID(),
		Email:               u.Email().String(),
		Role:                string(u.Role()),
		IsBuiltinSuperAdmin: u.IsBuiltinSuperAdmin(),
	}, time.Now(), in.MaxTTL)
	if err != nil {
		return CreateSessionOutput{}, shared.Internal("创建 session 失败", err)
	}
	if err := h.store.Create(ctx, sess, in.IdleTTL); err != nil {
		return CreateSessionOutput{}, shared.Internal("持久化 session 失败", err)
	}
	return CreateSessionOutput{SessionID: string(sess.ID()), CSRFToken: string(sess.CSRF())}, nil
}
