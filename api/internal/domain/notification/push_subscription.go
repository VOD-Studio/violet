package notification

import (
	"context"
	"strings"
	"time"

	domainshared "blog-api/internal/domain/shared"
)

// PushSubscription 站内通知的浏览器 Web Push 订阅。
//
// 与聊天推送订阅（chat 域）相互独立：同一浏览器的 endpoint 可同时出现在两处，
// 因为「接收聊天消息提醒」与「接收站内通知提醒」是两次独立的用户授权决定。
// endpoint 是浏览器分配的推送地址，全局唯一，作主键。
type PushSubscription struct {
	// UserID 订阅所属用户
	UserID domainshared.ID
	// Endpoint 推送服务 endpoint（浏览器分配，唯一标识一个订阅）
	Endpoint string
	// P256DH 浏览器公钥（负载加密用）
	P256DH string
	// Auth 浏览器认证密钥（负载加密用）
	Auth string
	// UserAgent 订阅设备标识，可空
	UserAgent string
	// CreatedAt 首次注册时间
	CreatedAt time.Time
	// UpdatedAt 最近更新时间
	UpdatedAt time.Time
}

// NewPushSubscription 构造订阅并校验必填凭据。
func NewPushSubscription(userID domainshared.ID, endpoint, p256dh, auth, userAgent string, now time.Time) (*PushSubscription, error) {
	if userID.IsZero() {
		return nil, domainshared.BadRequest("订阅用户不能为空")
	}
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		return nil, domainshared.BadRequest("推送 endpoint 不能为空")
	}
	if strings.TrimSpace(p256dh) == "" || strings.TrimSpace(auth) == "" {
		return nil, domainshared.BadRequest("推送密钥不完整")
	}
	return &PushSubscription{
		UserID:    userID,
		Endpoint:  endpoint,
		P256DH:    p256dh,
		Auth:      auth,
		UserAgent: userAgent,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

// PushSubscriptionRepository 通知推送订阅仓储端口。
type PushSubscriptionRepository interface {
	// Save 保存或更新订阅（按 endpoint upsert：同一浏览器重复授权不产生重复行）。
	Save(ctx context.Context, sub *PushSubscription) error
	// Delete 删除指定用户的某个订阅（endpoint 归属校验在 SQL 条件里）。
	Delete(ctx context.Context, userID domainshared.ID, endpoint string) error
	// ListByUser 列出某用户的全部订阅（多设备/多浏览器各一条）。
	ListByUser(ctx context.Context, userID domainshared.ID) ([]*PushSubscription, error)
}
