package notification

import (
	"context"
	"errors"
	"time"

	"github.com/rs/zerolog"

	domainnotification "blog-api/internal/domain/notification"
	domainshared "blog-api/internal/domain/shared"
)

// ErrPushSubscriptionExpired 推送服务确认订阅已失效，可删除本地记录。
var ErrPushSubscriptionExpired = errors.New("notification push subscription expired")

// WebPushSender 加密发送浏览器通知的基础设施端口；订阅失效时返回 ErrPushSubscriptionExpired。
type WebPushSender interface {
	Send(ctx context.Context, sub *domainnotification.PushSubscription, notification BrowserNotification) error
}

// PushService 站内通知的浏览器推送订阅管理 + 扇出投递。
//
// 同时实现 BrowserPusher（供 PushingSubscriber 写通知后调用）与订阅增删用例
// （供 HTTP handler 调用）。未配置 VAPID 密钥时 sender 为 nil，退化为只存订阅不投递。
type PushService struct {
	repo   domainnotification.PushSubscriptionRepository
	sender WebPushSender
	// publicKey VAPID 公钥，下发给前端 subscribe 用；空串表示站点未启用推送
	publicKey string
	now       func() time.Time
	log       zerolog.Logger
}

// NewPushService 构造推送服务。sender 为 nil 时不投递；now 为 nil 时用 time.Now。
func NewPushService(
	repo domainnotification.PushSubscriptionRepository,
	sender WebPushSender,
	publicKey string,
	now func() time.Time,
	log zerolog.Logger,
) *PushService {
	if now == nil {
		now = time.Now
	}
	return &PushService{repo: repo, sender: sender, publicKey: publicKey, now: now, log: log}
}

// Enabled 站点是否具备推送能力（VAPID 公钥与发送器都就位）。
func (s *PushService) Enabled() bool { return s.publicKey != "" && s.sender != nil }

// PublicKey 返回 VAPID 公钥（未配置时为空串）。
func (s *PushService) PublicKey() string { return s.publicKey }

// Subscribe 注册当前浏览器的推送订阅。
func (s *PushService) Subscribe(ctx context.Context, userID domainshared.ID, endpoint, p256dh, auth, userAgent string) error {
	sub, err := domainnotification.NewPushSubscription(userID, endpoint, p256dh, auth, userAgent, s.now())
	if err != nil {
		return err
	}
	return s.repo.Save(ctx, sub)
}

// Unsubscribe 注销当前浏览器的推送订阅。
func (s *PushService) Unsubscribe(ctx context.Context, userID domainshared.ID, endpoint string) error {
	return s.repo.Delete(ctx, userID, endpoint)
}

// PushBrowser 给用户的全部订阅投递浏览器通知。
//
// fail-safe：查询/投递失败只记日志，不向上传播——通知已落 DB，铃铛仍可见。
// 订阅确认失效（410/404）时删除该行，其余错误保留订阅供后续通知复用。
func (s *PushService) PushBrowser(ctx context.Context, userID domainshared.ID, notification BrowserNotification) {
	if !s.Enabled() {
		return
	}
	subs, err := s.repo.ListByUser(ctx, userID)
	if err != nil {
		s.log.Warn().Err(err).Str("user_id", userID.String()).Msg("查询通知推送订阅失败")
		return
	}
	for _, sub := range subs {
		if err := s.sender.Send(ctx, sub, notification); err == nil {
			continue
		} else if errors.Is(err, ErrPushSubscriptionExpired) {
			if err := s.repo.Delete(ctx, userID, sub.Endpoint); err != nil {
				s.log.Warn().Err(err).Msg("清理失效通知推送订阅失败")
			}
		} else {
			s.log.Warn().Err(err).Msg("通知浏览器推送失败，保留订阅供后续通知使用")
		}
	}
}

var _ BrowserPusher = (*PushService)(nil)
