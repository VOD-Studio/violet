package notification

import (
	"context"
	"fmt"

	"github.com/rs/zerolog"

	appshared "blog-api/internal/application/shared"
	domaincomment "blog-api/internal/domain/comment"
	domainfriendlink "blog-api/internal/domain/friendlink"
	domainnotification "blog-api/internal/domain/notification"
	domainshared "blog-api/internal/domain/shared"
	domainsubscription "blog-api/internal/domain/subscription"
)

// --- 接收者解析端口（由 wiring 层适配现有仓储实现）---

// SubscriptionOwnerLookup 解析订阅所有者（订阅抓取失败通知用）。
type SubscriptionOwnerLookup interface {
	// FindOwnerID 返回订阅所有者的 userID。
	FindOwnerID(ctx context.Context, subscriptionID domainshared.ID) (domainshared.ID, error)
}

// CommentAuthorLookup 解析评论作者（评论审核通知用）。
type CommentAuthorLookup interface {
	// FindAuthorID 返回评论作者的 userID；nil 表示匿名评论（无通知接收者）。
	FindAuthorID(ctx context.Context, commentID domainshared.ID) (*domainshared.ID, error)
}

// AdminUserLookup 解析管理员用户（友链申请等 admin 通知用）。
type AdminUserLookup interface {
	// FindAdminIDs 返回应接收管理通知的用户 ID 列表。
	FindAdminIDs(ctx context.Context) ([]domainshared.ID, error)
}

// Subscriber 通知订阅者：消费领域事件 → 计算接收者 → 写通知。
//
// 镜像审计 subscriber 结构（通配订阅 + 按事件类型分发）。
// 写通知失败记降级日志（fail-safe），不阻断其他订阅者（EventBus 容错隔离）。
type Subscriber struct {
	store         domainnotification.NotificationRepository
	subLookup     SubscriptionOwnerLookup
	commentLookup CommentAuthorLookup
	adminLookup   AdminUserLookup
	log           zerolog.Logger
}

// NewSubscriber 构造通知订阅者。
func NewSubscriber(
	store domainnotification.NotificationRepository,
	subLookup SubscriptionOwnerLookup,
	commentLookup CommentAuthorLookup,
	adminLookup AdminUserLookup,
	log zerolog.Logger,
) *Subscriber {
	return &Subscriber{
		store:         store,
		subLookup:     subLookup,
		commentLookup: commentLookup,
		adminLookup:   adminLookup,
		log:           log,
	}
}

// Subscribe 注册订阅者到事件总线（通配订阅，按事件类型分发）。
func (s *Subscriber) Subscribe(bus appshared.EventBus) {
	bus.Subscribe("", s.Handle)
}

// Handle 处理单个领域事件。
func (s *Subscriber) Handle(ctx context.Context, event domainshared.DomainEvent) error {
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
	}
	return nil
}

// notifyAction 一次通知创建动作的中间数据。
type notifyAction struct {
	userID     domainshared.ID
	sourceType domainnotification.SourceType
	sourceID   domainshared.ID
	title      string
	body       string
	payload    map[string]any
}

// mapEvent 把领域事件映射为通知创建动作列表。
//
// 返回 ok=false 表示该事件类型不产生通知（静默跳过）。
func (s *Subscriber) mapEvent(ctx context.Context, event domainshared.DomainEvent) ([]notifyAction, bool) {
	switch e := event.(type) {
	case domainsubscription.SubscriptionFetched:
		return s.handleSubscriptionFetched(ctx, e)

	case domainfriendlink.FriendLinkCreated:
		return s.handleFriendlinkCreated(ctx, e)

	case domaincomment.CommentApproved:
		return s.handleCommentApproved(ctx, e)

	default:
		return nil, false
	}
}

// --- 事件处理 ---

func (s *Subscriber) handleSubscriptionFetched(ctx context.Context, e domainsubscription.SubscriptionFetched) ([]notifyAction, bool) {
	// 通知规则：
	//   - 调度器自动（IsSystem=true）：仅失败通知
	//   - 手动触发（IsSystem=false）：成功/失败都通知（用户点了"立即抓取"，要等结果）
	if e.IsSystem && e.Error == "" {
		return nil, false
	}

	ownerID, err := s.subLookup.FindOwnerID(ctx, e.AggregateID())
	if err != nil {
		s.log.Warn().Err(err).Str("subscription_id", e.AggregateID().String()).Msg("解析订阅所有者失败")
		return nil, false
	}

	var title, body string
	if e.Success {
		title = fmt.Sprintf("订阅「%s」抓取完成", e.Title)
		if e.Imported > 0 {
			body = fmt.Sprintf("新增 %d 篇文章", e.Imported)
		} else {
			body = "无新文章"
		}
	} else {
		title = fmt.Sprintf("订阅「%s」抓取失败", e.Title)
		body = e.Error
	}
	sourceType := domainnotification.SourceSubscriptionFailed
	if e.Success {
		sourceType = domainnotification.SourceSubscriptionSucceeded
	}
	return []notifyAction{{
		userID:     ownerID,
		sourceType: sourceType,
		sourceID:   e.AggregateID(),
		title:      title,
		body:       body,
		payload: map[string]any{
			"subscription_id": e.AggregateID().String(),
			"success":         e.Success,
			"imported":        e.Imported,
			"failed":          e.Failed,
		},
	}}, true
}

func (s *Subscriber) handleFriendlinkCreated(ctx context.Context, e domainfriendlink.FriendLinkCreated) ([]notifyAction, bool) {
	adminIDs, err := s.adminLookup.FindAdminIDs(ctx)
	if err != nil {
		s.log.Warn().Err(err).Msg("解析管理员用户失败")
		return nil, false
	}

	actions := make([]notifyAction, 0, len(adminIDs))
	for _, adminID := range adminIDs {
		actions = append(actions, notifyAction{
			userID:     adminID,
			sourceType: domainnotification.SourceFriendLinkApplied,
			sourceID:   e.AggregateID(),
			title:      fmt.Sprintf("收到新友链申请「%s」", e.Name),
			body:       e.URL,
			payload:    map[string]any{"name": e.Name, "url": e.URL},
		})
	}
	return actions, true
}

func (s *Subscriber) handleCommentApproved(ctx context.Context, e domaincomment.CommentApproved) ([]notifyAction, bool) {
	authorID, err := s.commentLookup.FindAuthorID(ctx, e.AggregateID())
	if err != nil {
		s.log.Warn().Err(err).Str("comment_id", e.AggregateID().String()).Msg("解析评论作者失败")
		return nil, false
	}
	if authorID == nil {
		return nil, false
	}

	return []notifyAction{{
		userID:     *authorID,
		sourceType: domainnotification.SourceCommentApproved,
		sourceID:   e.AggregateID(),
		title:      "你的评论已审核通过",
		body:       "",
		payload:    map[string]any{"comment_id": e.AggregateID().String()},
	}}, true
}
