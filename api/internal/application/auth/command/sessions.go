package command

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/session"
	"blog-api/internal/domain/shared"
)

// ============================================================
// ListUserSessions 设备/会话列表
// ============================================================

// SessionDeviceDTO 设备列表条目。不含 session id、CSRF 等任何凭据：
// PublicID 是 SHA-256(id) 的十六进制前 32 位，仅用于定位与吊销。
type SessionDeviceDTO struct {
	// PublicID 会话公开标识（非凭据，不可反查 session id）
	PublicID string `json:"public_id"`
	// CreatedAt 创建时间（登录时刻）
	CreatedAt string `json:"created_at"`
	// LastSeenAt 最近活跃时间
	LastSeenAt string `json:"last_seen_at"`
	// ClientIP 最近一次请求的客户端 IP
	ClientIP string `json:"client_ip"`
	// UserAgent 最近一次请求的 User-Agent（已截断）
	UserAgent string `json:"user_agent"`
	// Current 是否当前请求所在的会话
	Current bool `json:"current"`
}

// PublicID 从 session id 派生公开标识。单向哈希：列表/吊销端点只流转该值，
// 前端拿不到可用的会话凭据。
func PublicID(id session.ID) string {
	sum := sha256.Sum256([]byte(id))
	return hex.EncodeToString(sum[:])[:32]
}

// ListUserSessionsHandler 返回当前用户全部有效登录会话（按创建时间升序）。
type ListUserSessionsHandler struct {
	store appshared.SessionStore
}

// NewListUserSessionsHandler 构造设备列表用例。
func NewListUserSessionsHandler(store appshared.SessionStore) *ListUserSessionsHandler {
	return &ListUserSessionsHandler{store: store}
}

// Handle 执行列表查询。currentSessionID 非空时标记对应条目为当前会话。
func (h *ListUserSessionsHandler) Handle(ctx context.Context, userID, currentSessionID string) ([]SessionDeviceDTO, error) {
	sessions, err := h.store.ListByUser(ctx, userID)
	if err != nil {
		return nil, shared.Internal("读取登录会话失败", err)
	}
	dtos := make([]SessionDeviceDTO, 0, len(sessions))
	for _, sess := range sessions {
		client := sess.Client()
		dtos = append(dtos, SessionDeviceDTO{
			PublicID:   PublicID(sess.ID()),
			CreatedAt:  sess.CreatedAt().UTC().Format(time.RFC3339),
			LastSeenAt: sess.LastSeenAt().UTC().Format(time.RFC3339),
			ClientIP:   client.IP,
			UserAgent:  client.UserAgent,
			Current:    string(sess.ID()) == currentSessionID,
		})
	}
	return dtos, nil
}

// ============================================================
// RevokeUserSession 吊销指定会话
// ============================================================

// RevokeUserSessionInput 吊销入参。
type RevokeUserSessionInput struct {
	// OperatorID 操作者（审计主体）
	OperatorID string
	// TargetUserID 会话属主；管理员吊销他人会话时与 OperatorID 不同
	TargetUserID string
	// PublicID 待吊销会话的公开标识
	PublicID string
}

// ErrSessionNotOwned 公开标识不属于目标用户。
var ErrSessionNotOwned = shared.NotFound("会话不存在")

// RevokeUserSessionHandler 吊销指定用户的指定会话。
//
// 属主校验：仅遍历目标用户的会话集合做哈希匹配，外部传入的 publicID 匹配
// 不到即拒绝，不提供跨用户吊销能力。吊销后同步吊销该会话的运维授权。
type RevokeUserSessionHandler struct {
	store  appshared.SessionStore
	grants appshared.OpsGrantStore
	bus    appshared.EventBus
}

// NewRevokeUserSessionHandler 构造吊销用例。
func NewRevokeUserSessionHandler(store appshared.SessionStore, grants appshared.OpsGrantStore, bus appshared.EventBus) *RevokeUserSessionHandler {
	return &RevokeUserSessionHandler{store: store, grants: grants, bus: bus}
}

// Handle 执行吊销并发布审计事件。删除是幂等的：目标不存在时返回
// ErrSessionNotOwned，调用方映射 404。
func (h *RevokeUserSessionHandler) Handle(ctx context.Context, in RevokeUserSessionInput) error {
	sessions, err := h.store.ListByUser(ctx, in.TargetUserID)
	if err != nil {
		return shared.Internal("读取登录会话失败", err)
	}
	for _, sess := range sessions {
		if PublicID(sess.ID()) != in.PublicID {
			continue
		}
		if err := h.store.DeleteForUser(ctx, in.TargetUserID, sess.ID()); err != nil {
			return shared.Internal("吊销登录会话失败", err)
		}
		RevokeOpsGrantForSession(ctx, h.grants, in.TargetUserID, string(sess.ID()))
		if h.bus != nil {
			id, err := shared.ParseID(in.TargetUserID)
			if err == nil {
				if err := h.bus.Publish(ctx, []shared.DomainEvent{NewSessionRevoked(id, in.PublicID, in.OperatorID == in.TargetUserID)}); err != nil {
					log.Warn().Err(err).Msg("发布会话吊销事件失败")
				}
			}
		}
		return nil
	}
	return ErrSessionNotOwned
}
