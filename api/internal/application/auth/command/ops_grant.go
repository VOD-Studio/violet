package command

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/opsgrant"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
)

// opsGrantTTL 授权有效期：覆盖「保存待确认 → 核对 → 确认生效」窗口即可，
// 不追求长时效；超时后高危操作要求重新验证。
const opsGrantTTL = 10 * time.Minute

// ============================================================
// IssueOpsGrant 签发短时运维授权
// ============================================================

// IssueOpsGrantInput 签发授权入参。
type IssueOpsGrantInput struct {
	// UserID 当前登录用户（授权绑定者）
	UserID string
	// SessionID 当前 session id（授权只在当前会话内可用）
	SessionID string
	// Category 申请的操作类别
	Category opsgrant.Category
	// Method 验证方式：password | email_code
	Method string
	// Password Method=password 时的当前密码
	Password string
	// Code Method=email_code 时的邮箱验证码
	Code string
}

// IssueOpsGrantOutput 签发结果。
type IssueOpsGrantOutput struct {
	// ExpiresAt 授权截止时间
	ExpiresAt time.Time
}

// ErrOpsGrantDenied 验证失败（密码错误/验证码错误/无可用验证通道）。
var ErrOpsGrantDenied = shared.Unauthorized("二次验证失败，请核对凭证后重试")

// IssueOpsGrantHandler 通过已验证密码或账号绑定邮箱验证码签发短时运维授权。
//
// OAuth 无密码用户走 email_code：验证码发送到账号绑定邮箱，不强迫设置密码。
type IssueOpsGrantHandler struct {
	userRepo    user.UserRepository
	hasher      PasswordHasher
	codeStore   appshared.CodeStore
	emailSender EmailSender
	grants      appshared.OpsGrantStore
	bus         appshared.EventBus
}

// NewIssueOpsGrantHandler 构造签发用例。
func NewIssueOpsGrantHandler(
	repo user.UserRepository,
	hasher PasswordHasher,
	codeStore appshared.CodeStore,
	emailSender EmailSender,
	grants appshared.OpsGrantStore,
	bus appshared.EventBus,
) *IssueOpsGrantHandler {
	return &IssueOpsGrantHandler{
		userRepo: repo, hasher: hasher, codeStore: codeStore,
		emailSender: emailSender, grants: grants, bus: bus,
	}
}

// Handle 校验凭证并签发授权。验证失败统一返回 ErrOpsGrantDenied 并发布
// OpsGrantDenied 事件（审计），不区分密码/验证码错误细节。
func (h *IssueOpsGrantHandler) Handle(ctx context.Context, in IssueOpsGrantInput) (IssueOpsGrantOutput, error) {
	id, err := shared.ParseID(in.UserID)
	if err != nil {
		return IssueOpsGrantOutput{}, ErrOpsGrantDenied
	}
	denied := func(reason string) (IssueOpsGrantOutput, error) {
		h.publish(ctx, NewOpsGrantDenied(id, in.Category, reason))
		return IssueOpsGrantOutput{}, ErrOpsGrantDenied
	}
	if !in.Category.Valid() || in.SessionID == "" {
		return denied("invalid_request")
	}
	u, err := h.userRepo.FindByID(ctx, id)
	if err != nil {
		return denied("user_not_found")
	}
	switch in.Method {
	case "password":
		hash := u.PasswordHash()
		if hash.String() == "" {
			return denied("no_password")
		}
		if err := h.hasher.Compare(hash, in.Password); err != nil {
			return denied("bad_password")
		}
	case "email_code":
		if u.Email().String() == "" {
			return denied("no_email")
		}
		matched, err := h.codeStore.Verify(ctx, "ops-grant", in.UserID, sha256Hash(in.Code))
		if err != nil {
			return IssueOpsGrantOutput{}, shared.Internal("运维授权验证码校验失败", err)
		}
		if !matched {
			return denied("bad_code")
		}
	default:
		return denied("unknown_method")
	}
	expiresAt := time.Now().Add(opsGrantTTL)
	grant, ok := opsgrant.NewGrant(in.UserID, in.SessionID, in.Category, expiresAt)
	if !ok {
		return denied("invalid_grant")
	}
	if err := h.grants.Issue(ctx, grant); err != nil {
		return IssueOpsGrantOutput{}, shared.Internal("签发运维授权失败", err)
	}
	h.publish(ctx, NewOpsGrantIssued(id, in.Category, in.Method))
	return IssueOpsGrantOutput{ExpiresAt: expiresAt}, nil
}

func (h *IssueOpsGrantHandler) publish(ctx context.Context, event shared.DomainEvent) {
	if h.bus == nil {
		return
	}
	if err := h.bus.Publish(ctx, []shared.DomainEvent{event}); err != nil {
		log.Warn().Err(err).Msg("发布运维授权事件失败")
	}
}

// ============================================================
// RequestOpsGrantCode 发送运维授权邮箱验证码
// ============================================================

// RequestOpsGrantCodeInput 发码入参。
type RequestOpsGrantCodeInput struct {
	// UserID 当前登录用户
	UserID string
}

// RequestOpsGrantCodeHandler 向账号绑定邮箱发送运维授权验证码。
// 供 OAuth 无密码用户作为二次验证通道。
type RequestOpsGrantCodeHandler struct {
	userRepo    user.UserRepository
	codeStore   appshared.CodeStore
	emailSender EmailSender
}

// NewRequestOpsGrantCodeHandler 构造发码用例。
func NewRequestOpsGrantCodeHandler(
	repo user.UserRepository,
	codeStore appshared.CodeStore,
	emailSender EmailSender,
) *RequestOpsGrantCodeHandler {
	return &RequestOpsGrantCodeHandler{userRepo: repo, codeStore: codeStore, emailSender: emailSender}
}

// Handle 生成验证码并发送。用户不存在或无邮箱时静默成功，不暴露信息。
func (h *RequestOpsGrantCodeHandler) Handle(ctx context.Context, in RequestOpsGrantCodeInput) error {
	id, err := shared.ParseID(in.UserID)
	if err != nil {
		return nil
	}
	u, err := h.userRepo.FindByID(ctx, id)
	if err != nil || u.Email().String() == "" {
		return nil
	}
	code, err := generateVerificationCode()
	if err != nil {
		return shared.Internal("生成验证码失败", err)
	}
	if err := h.codeStore.Store(ctx, "ops-grant", in.UserID, sha256Hash(code)); err != nil {
		return shared.Internal("存储验证码失败", err)
	}
	if err := h.emailSender.SendOpsGrantCode(ctx, u.Email().String(), code); err != nil {
		log.Warn().Err(err).Msg("发送运维授权验证码失败")
	}
	return nil
}


// ============================================================
// RevokeOpsGrant 主动吊销当前会话的全部运维授权（完成后收权）
// ============================================================

// RevokeOpsGrantHandler 吊销当前会话运维授权并发布审计事件。
type RevokeOpsGrantHandler struct {
	grants appshared.OpsGrantStore
	bus    appshared.EventBus
}

// NewRevokeOpsGrantHandler 构造吊销用例。
func NewRevokeOpsGrantHandler(grants appshared.OpsGrantStore, bus appshared.EventBus) *RevokeOpsGrantHandler {
	return &RevokeOpsGrantHandler{grants: grants, bus: bus}
}

// Handle 吊销并发布 OpsGrantRevoked 事件（审计记录主动收权）。
func (h *RevokeOpsGrantHandler) Handle(ctx context.Context, userID, sessionID string) error {
	if err := h.grants.RevokeSession(ctx, userID, sessionID); err != nil {
		return shared.Internal("吊销运维授权失败", err)
	}
	if id, err := shared.ParseID(userID); err == nil && h.bus != nil {
		if err := h.bus.Publish(ctx, []shared.DomainEvent{NewOpsGrantRevoked(id)}); err != nil {
			log.Warn().Err(err).Msg("发布运维授权吊销事件失败")
		}
	}
	return nil
}
// ============================================================
// VerifyOpsGrant / RevokeOpsGrants 授权校验与吊销（供高危端点内联使用）
// ============================================================

// VerifyOpsGrant 判断当前会话是否持有指定类别的有效授权。
// 授权本身不替代权限：调用方仍须独立校验角色/权限码。
func VerifyOpsGrant(ctx context.Context, grants appshared.OpsGrantStore, userID, sessionID string, category opsgrant.Category) bool {
	ok, err := grants.Exists(ctx, userID, sessionID, category)
	if err != nil {
		log.Error().Err(err).Msg("校验运维授权失败")
		return false
	}
	return ok
}

// RevokeOpsGrantForSession 吊销指定会话的运维授权（退出/设备吊销时调用）。
// 失败仅记日志：授权 TTL 仅 10 分钟，Redis 故障的降级窗口有限。
func RevokeOpsGrantForSession(ctx context.Context, grants appshared.OpsGrantStore, userID, sessionID string) {
	if grants == nil {
		return
	}
	if err := grants.RevokeSession(ctx, userID, sessionID); err != nil {
		log.Error().Err(err).Msg("吊销会话运维授权失败")
	}
}

// RevokeOpsGrantsForUser 吊销指定用户的全部运维授权（改密/撤权时调用）。
func RevokeOpsGrantsForUser(ctx context.Context, grants appshared.OpsGrantStore, userID string) {
	if grants == nil {
		return
	}
	if err := grants.RevokeUser(ctx, userID); err != nil {
		log.Error().Err(err).Msg("吊销用户运维授权失败")
	}
}
