package webpush

import (
	"context"
	"encoding/json"
	"fmt"
	"io"

	webpushlib "github.com/SherClockHolmes/webpush-go"

	appchat "blog-api/internal/application/chat"
	domainchat "blog-api/internal/domain/chat"
)

// Sender 使用 VAPID 向浏览器推送聊天通知。
type Sender struct {
	publicKey  string
	privateKey string
	subject    string
}

// NewSender 构造 Web Push 发送器。
func NewSender(publicKey, privateKey, subject string) *Sender {
	return &Sender{publicKey: publicKey, privateKey: privateKey, subject: subject}
}

// Send 加密并发送一条 Web Push 通知。
func (s *Sender) Send(ctx context.Context, subscription *domainchat.PushSubscription, payload appchat.PushPayload) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	response, err := webpushlib.SendNotificationWithContext(ctx, body, &webpushlib.Subscription{
		Endpoint: subscription.Endpoint,
		Keys: webpushlib.Keys{P256dh: subscription.P256DH, Auth: subscription.Auth},
	}, &webpushlib.Options{
		Subscriber:     s.subject,
		VAPIDPublicKey: s.publicKey,
		VAPIDPrivateKey: s.privateKey,
		TTL:            300,
		Topic:          payload.Tag,
	})
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		message, _ := io.ReadAll(io.LimitReader(response.Body, 4<<10))
		return fmt.Errorf("web push returned %s: %s", response.Status, string(message))
	}
	return nil
}

var _ appchat.PushSender = (*Sender)(nil)
