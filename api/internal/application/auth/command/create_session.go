package command

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"

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
	// MaxDevices 单用户并发会话上限，<=0 不限制；超限按创建时间淘汰最旧
	MaxDevices int
	// Client 登录时观察到的客户端信息（IP/UserAgent），供设备列表展示
	Client session.ClientContext
}

// CreateSessionOutput 新建的 session 凭证，由 HTTP 层写入 cookie。
type CreateSessionOutput struct {
	// SessionID opaque session id，写入 violet_session cookie
	SessionID string
	// CSRFToken double-submit CSRF 凭证，写入 violet_csrf cookie
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
	bus      appshared.EventBus
}

// NewCreateSessionHandler 构造 CreateSessionHandler。
func NewCreateSessionHandler(repo user.UserRepository, store appshared.SessionStore, bus appshared.EventBus) *CreateSessionHandler {
	return &CreateSessionHandler{userRepo: repo, store: store, bus: bus}
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
		IsRoot:              u.IsRoot(),
	}, time.Now(), in.MaxTTL, in.Client)
	if err != nil {
		return CreateSessionOutput{}, shared.Internal("创建 session 失败", err)
	}
	evicted, err := h.store.CreateBounded(ctx, sess, in.IdleTTL, in.MaxDevices)
	if err != nil {
		return CreateSessionOutput{}, shared.Internal("持久化 session 失败", err)
	}
	if len(evicted) > 0 && h.bus != nil {
		if err := h.bus.Publish(ctx, []shared.DomainEvent{NewSessionEvicted(u.GetID(), len(evicted))}); err != nil {
			log.Warn().Err(err).Msg("发布会话淘汰事件失败")
		}
	}
	return CreateSessionOutput{SessionID: string(sess.ID()), CSRFToken: string(sess.CSRF())}, nil
}
