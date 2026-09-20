package webpush

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	webpushlib "github.com/SherClockHolmes/webpush-go"

	appchat "blog-api/internal/application/chat"
	domainchat "blog-api/internal/domain/chat"
)

// ErrSubscriptionExpired 推送服务确认订阅已失效，调用方可删除本地记录。
var ErrSubscriptionExpired = errors.New("web push subscription expired")

// Subscription 浏览器推送订阅的传输凭据（域中立：聊天与站内通知共用同一发送器）。
type Subscription struct {
	// Endpoint 推送服务 endpoint
	Endpoint string
	// P256DH 浏览器公钥
	P256DH string
	// Auth 浏览器认证密钥
	Auth string
}

// Notification 浏览器系统通知载荷。字段名即 service worker 读取的 JSON 键。
type Notification struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	// URL 点击通知后打开的站内路径
	URL string `json:"url"`
	// Tag 浏览器通知聚合标签
	Tag string `json:"tag"`
}

// Sender 使用 VAPID 向浏览器推送系统通知。
type Sender struct {
	publicKey  string
	privateKey string
	subject    string
}

// NewSender 构造 Web Push 发送器。
func NewSender(publicKey, privateKey, subject string) *Sender {
	return &Sender{publicKey: publicKey, privateKey: privateKey, subject: subject}
}

// Deliver 加密并发送一条浏览器通知；订阅失效时返回 ErrSubscriptionExpired。
func (s *Sender) Deliver(ctx context.Context, subscription Subscription, notification Notification) error {
	body, err := json.Marshal(notification)
	if err != nil {
		return err
	}
	response, err := webpushlib.SendNotificationWithContext(ctx, body, &webpushlib.Subscription{
		Endpoint: subscription.Endpoint,
		Keys:     webpushlib.Keys{P256dh: subscription.P256DH, Auth: subscription.Auth},
	}, &webpushlib.Options{
		Subscriber:      s.subject,
		VAPIDPublicKey:  s.publicKey,
		VAPIDPrivateKey: s.privateKey,
		TTL:             300,
		Topic:           notification.Tag,
	})
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusNotFound || response.StatusCode == http.StatusGone {
		return fmt.Errorf("%w: %s", ErrSubscriptionExpired, response.Status)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("web push returned %s", response.Status)
	}
	return nil
}

// Send 适配 appchat.PushSender 端口：把聊天载荷转成中立形态并翻译失效错误。
func (s *Sender) Send(ctx context.Context, subscription *domainchat.PushSubscription, payload appchat.PushPayload) error {
	err := s.Deliver(ctx, Subscription{
		Endpoint: subscription.Endpoint,
		P256DH:   subscription.P256DH,
		Auth:     subscription.Auth,
	}, Notification{Title: payload.Title, Body: payload.Body, URL: payload.URL, Tag: payload.Tag})
	if errors.Is(err, ErrSubscriptionExpired) {
		return fmt.Errorf("%w: %s", appchat.ErrPushSubscriptionExpired, err)
	}
	return err
}

var _ appchat.PushSender = (*Sender)(nil)
