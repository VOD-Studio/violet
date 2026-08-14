package notification

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/rs/zerolog"

	appshared "blog-api/internal/application/shared"
	domainnotification "blog-api/internal/domain/notification"
	domainshared "blog-api/internal/domain/shared"
)

// SSEEvent SSE 推送的通知事件（序列化为 SSE data 行）。
type SSEEvent struct {
	ID         string         `json:"id"`
	SourceType string         `json:"source_type"`
	SourceID   string         `json:"source_id"`
	Title      string         `json:"title"`
	Body       string         `json:"body"`
	Payload    map[string]any `json:"payload"`
	CreatedAt  string         `json:"created_at"`
}

// Notifier 通知推送端口。subscriber 写入通知后调用 Push 推给在线用户。
//
// 不在线用户：通知已落 DB，下次打开铃铛时自然看到。
// 由 infrastructure 层或本包的 ConnectionManager 实现。
type Notifier interface {
	// Push 给指定用户的所有在线 SSE 连接推送通知。
	Push(userID domainshared.ID, event SSEEvent)
}

// NoopNotifier 空实现（N3 未接入前 / 测试用）。
type NoopNotifier struct{}

func (NoopNotifier) Push(domainshared.ID, SSEEvent) {}

// ConnectionManager 维护在线用户的 SSE 连接池。
//
// 同一用户多标签页 = 多连接（[]chan）。Push 广播到全部连接。
// 线程安全：conns map 受 mutex 保护。单实例进程内有效——
// 多实例水平扩展时需 Redis pub/sub 广播（PRD-0015 扩展点，当前不做）。
type ConnectionManager struct {
	mu    sync.Mutex
	conns map[domainshared.ID][]chan SSEEvent
	log   zerolog.Logger
}

// NewConnectionManager 构造连接管理器。
func NewConnectionManager(log zerolog.Logger) *ConnectionManager {
	return &ConnectionManager{
		conns: make(map[domainshared.ID][]chan SSEEvent),
		log:   log,
	}
}

// Register 注册一个用户的 SSE 连接，返回接收 channel + 注销函数。
//
// channel 缓冲为 16：通知高频时缓冲防 Push 阻塞；
// 缓冲满时 Push 非阻塞丢弃（通知不比连接稳定性重要——丢的下次拉列表补）。
func (m *ConnectionManager) Register(userID domainshared.ID) (<-chan SSEEvent, func()) {
	ch := make(chan SSEEvent, 16)

	var closeOnce sync.Once

	m.mu.Lock()
	m.conns[userID] = append(m.conns[userID], ch)
	m.mu.Unlock()

	cleanup := func() {
		m.mu.Lock()
		defer m.mu.Unlock()
		conns := m.conns[userID]
		for i, c := range conns {
			if c == ch {
				m.conns[userID] = append(conns[:i], conns[i+1:]...)
				break
			}
		}
		if len(m.conns[userID]) == 0 {
			delete(m.conns, userID)
		}
		closeOnce.Do(func() { close(ch) })
	}
	return ch, cleanup
}

// Push 给指定用户的所有在线连接推送通知。
//
// 持锁发送：cleanup 在锁内 close(ch)，锁外发送会与 close 竞态导致
// send on closed channel panic。select default 非阻塞，持锁时间可忽略。
func (m *ConnectionManager) Push(userID domainshared.ID, event SSEEvent) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, ch := range m.conns[userID] {
		select {
		case ch <- event:
		default:
			// 缓冲满，丢弃——用户下次拉列表时补
			m.log.Warn().Str("user_id", userID.String()).Msg("SSE 连接缓冲满，通知丢弃")
		}
	}
}

// --- PushingSubscriber ---

// PushingSubscriber 包装 Subscriber，写入通知后通过 Notifier 推送。
//
// 与裸 Subscriber 的区别：Handle 在 store.Save 成功后调用 notifier.Push。
// 单实例时 Notifier 是 ConnectionManager；测试时可注入 NoopNotifier。
type PushingSubscriber struct {
	*Subscriber
	notifier Notifier
}

// NewPushingSubscriber 构造带推送的 subscriber。
func NewPushingSubscriber(
	store domainnotification.NotificationRepository,
	subLookup SubscriptionOwnerLookup,
	commentLookup CommentAuthorLookup,
	adminLookup AdminUserLookup,
	friendlinkLookup FriendLinkApplicantLookup,
	notifier Notifier,
	log zerolog.Logger,
) *PushingSubscriber {
	return &PushingSubscriber{
		Subscriber: NewSubscriber(store, subLookup, commentLookup, adminLookup, friendlinkLookup, log),
		notifier:   notifier,
	}
}

// Subscribe 注册到事件总线。
func (s *PushingSubscriber) Subscribe(bus appshared.EventBus) {
	bus.Subscribe("", s.Handle)
}

// Handle 处理事件 → 写通知 → 推送。
func (s *PushingSubscriber) Handle(ctx context.Context, event domainshared.DomainEvent) error {
	actions, ok := s.mapEvent(ctx, event)
	if !ok || len(actions) == 0 {
		return nil
	}

	for _, act := range actions {
		n, err := domainnotification.NewNotification(act.userID, domainshared.IDFromUUID(event.EventID()), act.sourceType, act.sourceID, act.title, act.body, act.payload)
		if err != nil {
			s.log.Error().Err(err).Str("event", event.EventName()).Msg("构造通知失败")
			continue
		}
		if err := s.store.Save(ctx, n); err != nil {
			s.log.Error().
				Err(err).
				Str("event", event.EventName()).
				Str("event_id", event.EventID().String()).
				Str("user_id", act.userID.String()).
				Msg("通知写入失败")
			continue
		}
		// 推送给在线用户
		s.notifier.Push(act.userID, SSEEvent{
			ID:         n.GetID().String(),
			SourceType: string(act.sourceType),
			SourceID:   act.sourceID.String(),
			Title:      act.title,
			Body:       act.body,
			Payload:    act.payload,
			CreatedAt:  n.CreatedAt().Format(time.RFC3339),
		})
	}
	return nil
}

// EventToJSON 序列化 SSEEvent 为 JSON 字符串（handler 层写 SSE data 行用）。
func EventToJSON(e SSEEvent) string {
	b, _ := json.Marshal(e)
	return string(b)
}
