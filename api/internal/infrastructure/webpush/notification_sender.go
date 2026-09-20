package webpush

import (
	"context"
	"errors"
	"fmt"

	appnotification "blog-api/internal/application/notification"
	domainnotification "blog-api/internal/domain/notification"
)

// NotificationSender 把通用 Sender 适配为站内通知的 WebPushSender 端口。
//
// tag 按来源类型聚合：同类型通知在浏览器侧折叠成一条，避免多条点赞刷屏。
type NotificationSender struct {
	sender *Sender
}

// NewNotificationSender 构造通知推送适配器。
func NewNotificationSender(sender *Sender) *NotificationSender {
	return &NotificationSender{sender: sender}
}

// Send 发送站内通知的浏览器系统通知，并把失效错误翻译成应用层哨兵值。
func (a *NotificationSender) Send(ctx context.Context, sub *domainnotification.PushSubscription, notification appnotification.BrowserNotification) error {
	err := a.sender.Deliver(ctx, Subscription{
		Endpoint: sub.Endpoint,
		P256DH:   sub.P256DH,
		Auth:     sub.Auth,
	}, Notification{
		Title: notification.Title,
		Body:  notification.Body,
		URL:   notification.URL,
		Tag:   "violet-notification-" + string(notification.SourceType),
	})
	if errors.Is(err, ErrSubscriptionExpired) {
		return fmt.Errorf("%w: %s", appnotification.ErrPushSubscriptionExpired, err)
	}
	return err
}

var _ appnotification.WebPushSender = (*NotificationSender)(nil)
