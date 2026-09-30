package webpush

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"time"

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
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	var lastErr error
	var delay time.Duration
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
			}
		}
		response, err := webpushlib.SendNotificationWithContext(ctx, body, &webpushlib.Subscription{
			Endpoint: subscription.Endpoint,
			Keys:     webpushlib.Keys{P256dh: subscription.P256DH, Auth: subscription.Auth},
		}, &webpushlib.Options{
			Subscriber:      s.subject,
			VAPIDPublicKey:  s.publicKey,
			VAPIDPrivateKey: s.privateKey,
			TTL:             86400,
			Urgency:         webpushlib.UrgencyHigh,
			// Tag 只控制系统通知显示；不设 Topic，避免覆盖尚未投递的聊天消息。
		})
		delay = pushRetryDelay("", attempt)
		if err != nil {
			// url.Error 包含完整 endpoint，不能进入日志。
			var urlErr *url.Error
			if errors.As(err, &urlErr) {
				err = urlErr.Err
			}
			lastErr = fmt.Errorf("web push transport: %w", err)
			var networkErr net.Error
			if ctx.Err() == nil && errors.As(err, &networkErr) && networkErr.Timeout() {
				continue
			}
			return lastErr
		}
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 4096))
		_ = response.Body.Close()
		if response.StatusCode == http.StatusNotFound || response.StatusCode == http.StatusGone {
			return fmt.Errorf("%w: HTTP %d", ErrSubscriptionExpired, response.StatusCode)
		}
		if response.StatusCode >= 200 && response.StatusCode < 300 {
			return nil
		}
		lastErr = fmt.Errorf("web push returned HTTP %d", response.StatusCode)
		if response.StatusCode != http.StatusTooManyRequests && response.StatusCode < 500 {
			return lastErr
		}
		delay = pushRetryDelay(response.Header.Get("Retry-After"), attempt)
	}
	return lastErr
}

func pushRetryDelay(retryAfter string, attempt int) time.Duration {
	delay := 250 * time.Millisecond * time.Duration(1<<attempt)
	if seconds, err := strconv.Atoi(retryAfter); err == nil && seconds > 0 {
		return max(delay, time.Duration(min(seconds, 10))*time.Second)
	}
	if retryAt, err := http.ParseTime(retryAfter); err == nil {
		return max(delay, time.Until(retryAt))
	}
	return delay
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
