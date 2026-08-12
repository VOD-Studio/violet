// Package audit 提供操作日志的应用层订阅者。
//
// 审计订阅者消费领域事件，转换为 AuditEvent 写入 append-only 存储。
// 覆盖面由聚合根 RecordEvent 决定——新增业务发事件即自动审计，
// 不依赖各 service 手工注入审计接口。
package audit

import (
	"context"
	"strconv"

	"github.com/rs/zerolog"

	appshared "blog-api/internal/application/shared"
	authcmd "blog-api/internal/application/auth/command"
	domainannouncement "blog-api/internal/domain/announcement"
	domainapitoken "blog-api/internal/domain/api_token"
	domainaudit "blog-api/internal/domain/audit"
	domaincomment "blog-api/internal/domain/comment"
	domainfriendlink "blog-api/internal/domain/friendlink"
	domainrole "blog-api/internal/domain/role"
	domainpost "blog-api/internal/domain/post"
	domainsubscription "blog-api/internal/domain/subscription"
	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
	domainuser "blog-api/internal/domain/user"
	"blog-api/internal/middleware"
)

// Subscriber 审计订阅者：消费领域事件 → AuditEvent → 写库。
//
// Actor 信息（UserID/Email/IP/UA）从 ctx 提取（session 中间件注入），
// 事件 payload 提供资源信息。写库失败记降级日志（fail-safe），
// 不阻断其他订阅者（EventBus 容错隔离）。
type Subscriber struct {
	store domainaudit.EventStore
	log   zerolog.Logger
}

// NewSubscriber 构造审计订阅者
func NewSubscriber(store domainaudit.EventStore, log zerolog.Logger) *Subscriber {
	return &Subscriber{store: store, log: log}
}

// Subscribe 注册订阅者到事件总线（订阅全部事件，按类型分发）。
//
// 通配订阅（空 eventName）保证未来新增领域事件无需改装配。
func (s *Subscriber) Subscribe(bus appshared.EventBus) {
	bus.Subscribe("", s.Handle)
}

// Handle 处理单个领域事件。
//
// 事件 → 构造 AuditEvent → store.Append。写库失败记降级日志并返回 error
// （EventBus 会记录处理失败，但不会阻断其他订阅者）。
func (s *Subscriber) Handle(ctx context.Context, event shared.DomainEvent) error {
	auditEvent, ok := s.mapEvent(ctx, event)
	if !ok {
		// 未知事件类型：不记审计（未来扩展事件时在此补映射）
		return nil
	}
	if err := s.store.Append(ctx, auditEvent); err != nil {
		// fail-safe：降级日志含完整事件快照，丢失记录仍可人工追回
		s.log.Error().
			Err(err).
			Str("event", event.EventName()).
			Str("event_id", event.EventID().String()).
			Str("aggregate_id", event.AggregateID().String()).
			Str("action", auditEvent.Action.String()).
			Str("resource_type", auditEvent.Resource.Type).
			Str("resource_id", auditEvent.Resource.ID).
			Str("resource_name", auditEvent.Resource.Name).
			Str("actor_user_id", auditEvent.Actor.UserID).
			Str("actor_user_name", auditEvent.Actor.UserName).
			Str("ip_address", auditEvent.Actor.IPAddress).
			Msg("审计事件写入失败")
		return err
	}
	return nil
}

// mapEvent 把领域事件映射为 AuditEvent。
//
// 返回 ok=false 表示该事件类型不审计（静默跳过）。
// 事件名是发布即冻结的契约（受控枚举），switch 分支一旦发布不改名。
func (s *Subscriber) mapEvent(ctx context.Context, event shared.DomainEvent) (domainaudit.AuditEvent, bool) {
	actor := domainaudit.Actor{
		Type:      domainaudit.ActorTypeUser,
		UserID:    middleware.GetUserID(ctx),
		UserName:  middleware.GetUserEmail(ctx), // 审计上下文无 username key，用 email 作为可读标识
		IPAddress: middleware.GetClientIPFromContext(ctx),
		UserAgent: middleware.GetUserAgentFromContext(ctx),
	}

	switch e := event.(type) {
	case domainuser.UserRegistered:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionCreate,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "user", ID: e.AggregateID().String(), Name: e.Email.String()},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainuser.UserPasswordChanged:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionUpdate,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "user", ID: e.AggregateID().String()},
			Changes:    []domainaudit.FieldChange{{Field: "password", From: nil, To: "changed"}},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainuser.UserEmailVerified:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionUpdate,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "user", ID: e.AggregateID().String()},
			Changes:    []domainaudit.FieldChange{{Field: "email_verified", From: false, To: true}},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainuser.UserRoleChanged:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionUpdateRole,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "user", ID: e.AggregateID().String(), Name: e.UserName},
			Changes:    []domainaudit.FieldChange{{Field: "role", From: string(e.From), To: string(e.To)}},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainuser.UserStatusChanged:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionUpdateStatus,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "user", ID: e.AggregateID().String(), Name: e.UserName},
			Changes:    []domainaudit.FieldChange{{Field: "is_active", From: e.From, To: e.To}},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainuser.UserUsernameChanged:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionUpdate,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "user", ID: e.AggregateID().String()},
			Changes:    []domainaudit.FieldChange{{Field: "username", From: e.From, To: e.To}},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainuser.UserDeleted:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionDelete,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "user", ID: e.AggregateID().String(), Name: e.UserName},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainuser.BatchUserStatusChanged:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionBatchUpdate,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "user"},
			Metadata:   map[string]any{"count": e.Affected, "is_active": e.IsActive},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainuser.BatchUserRoleChanged:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionBatchUpdate,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "user"},
			Metadata:   map[string]any{"count": e.Affected, "role": e.Role},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainrole.RoleCreated:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionCreate,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "role", ID: idToString(e.RoleID), Name: e.RoleName.String()},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainrole.RolePermissionsChanged:
		changes := make([]domainaudit.FieldChange, 0, 2)
		if len(e.Added) > 0 {
			changes = append(changes, domainaudit.FieldChange{Field: "permissions_added", From: nil, To: e.Added})
		}
		if len(e.Removed) > 0 {
			changes = append(changes, domainaudit.FieldChange{Field: "permissions_removed", From: e.Removed, To: nil})
		}
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionUpdatePerms,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "role", ID: idToString(e.RoleID)},
			Changes:    changes,
			OccurredAt: e.OccurredAt(),
		}, true

	case domainrole.RoleUpdated:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionUpdate,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "role", ID: idToString(e.RoleID)},
			Changes:    []domainaudit.FieldChange{{Field: "name", From: e.FromName, To: e.ToName}},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainrole.RoleDeleted:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionDelete,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "role", ID: idToString(e.RoleID), Name: e.RoleName},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainpost.PostPublished:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionPublish,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "post", ID: e.AggregateID().String(), Name: e.Title},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainpost.PostArchived:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionArchive,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "post", ID: e.AggregateID().String(), Name: e.Title},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainpost.PostRevertedToDraft:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionUnpublish,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "post", ID: e.AggregateID().String(), Name: e.Title},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainannouncement.AnnouncementCreated:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionCreate,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "announcement", ID: idToString(e.ID)},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainannouncement.AnnouncementUpdated:
		changes := make([]domainaudit.FieldChange, 0, len(e.Changes))
		for _, c := range e.Changes {
			changes = append(changes, domainaudit.FieldChange{Field: c.Field, From: c.From, To: c.To})
		}
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionUpdate,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "announcement", ID: idToString(e.ID), Name: e.Title},
			Changes:    changes,
			OccurredAt: e.OccurredAt(),
		}, true

	case domainannouncement.AnnouncementDeleted:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionDelete,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "announcement", ID: idToString(e.ID)},
			OccurredAt: e.OccurredAt(),
		}, true

	case domaintweet.TweetCreated:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionCreate,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "tweet", ID: e.AggregateID().String(), Name: e.Excerpt},
			OccurredAt: e.OccurredAt(),
		}, true

	case domaintweet.TweetDeleted:
		// Metadata 记原作者：管理员删他人推文时与操作者（Actor）不同，审计可追溯
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionDelete,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "tweet", ID: e.AggregateID().String(), Name: e.Excerpt},
			Metadata:   map[string]any{"author_id": e.AuthorID.String()},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainfriendlink.FriendLinkCreated:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionCreate,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "friendlink", ID: e.AggregateID().String(), Name: e.Name},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainfriendlink.FriendLinkApproved:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionApprove,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "friendlink", ID: e.AggregateID().String(), Name: e.Name},
			Changes:    []domainaudit.FieldChange{{Field: "status", From: e.From, To: e.To}},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainfriendlink.FriendLinkRejected:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionReject,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "friendlink", ID: e.AggregateID().String(), Name: e.Name},
			Changes:    []domainaudit.FieldChange{{Field: "status", From: e.From, To: e.To}},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainfriendlink.FriendLinkDisabled:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionUpdateStatus,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "friendlink", ID: e.AggregateID().String(), Name: e.Name},
			Changes:    []domainaudit.FieldChange{{Field: "status", From: e.From, To: e.To}},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainfriendlink.FriendLinkRestored:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionUpdateStatus,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "friendlink", ID: e.AggregateID().String(), Name: e.Name},
			Changes:    []domainaudit.FieldChange{{Field: "status", From: e.From, To: e.To}},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainfriendlink.FriendLinkUpdated:
		changes := make([]domainaudit.FieldChange, 0, len(e.Changes))
		for _, c := range e.Changes {
			changes = append(changes, domainaudit.FieldChange{Field: c.Field, From: c.From, To: c.To})
		}
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionUpdate,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "friendlink", ID: e.AggregateID().String(), Name: e.Name},
			Changes:    changes,
			OccurredAt: e.OccurredAt(),
		}, true

	case domainfriendlink.FriendLinkDeleted:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionDelete,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "friendlink", ID: e.AggregateID().String(), Name: e.Name},
			OccurredAt: e.OccurredAt(),
		}, true

	case domaincomment.CommentApproved:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionApprove,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "comment", ID: e.AggregateID().String()},
			OccurredAt: e.OccurredAt(),
		}, true

	case domaincomment.CommentSpammed:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionReject,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "comment", ID: e.AggregateID().String()},
			OccurredAt: e.OccurredAt(),
		}, true

	case domaincomment.CommentDeleted:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionDelete,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "comment", ID: e.AggregateID().String()},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainapitoken.PATCreated:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionCreate,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "api_token", ID: e.AggregateID().String(), Name: e.Name},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainapitoken.PATDeleted:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionDelete,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "api_token", ID: e.AggregateID().String(), Name: e.Name},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainsettings.SettingsUpdated:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionUpdate,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "settings"},
			Metadata:   map[string]any{"changed_keys": e.ChangedKeys},
			OccurredAt: e.OccurredAt(),
		}, true

	case authcmd.UserLoggedIn:
		// 登录发布发生在 session 创建前，ctx 无 UserID——Actor 从事件 payload 取，
		// 保证 /admin/logs/user/{id} 能按操作人查到登录记录（与 logout 行为一致）
		actor.UserID = e.AggregateID().String()
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionLogin,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "auth", ID: e.AggregateID().String()},
			Metadata:   map[string]any{"provider": e.Provider},
			OccurredAt: e.OccurredAt(),
		}, true

	case authcmd.UserLoggedOut:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionLogout,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "auth", ID: e.AggregateID().String()},
			OccurredAt: e.OccurredAt(),
		}, true

	case authcmd.UserLoginFailed:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionLoginFailed,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "auth"},
			Metadata:   map[string]any{"reason": e.Reason},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainsubscription.SubscriptionCreated:
		return domainaudit.AuditEvent{
			EventID: e.EventID(),
			Action:  domainaudit.ActionCreate,
			Actor:   actor,
			Resource: domainaudit.ResourceRef{
				Type: "subscription", ID: e.AggregateID().String(), Name: e.Title,
			},
			Metadata:   map[string]any{"feed_url": e.FeedURL},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainsubscription.SubscriptionUpdated:
		return domainaudit.AuditEvent{
			EventID:  e.EventID(),
			Action:   domainaudit.ActionUpdate,
			Actor:    actor,
			Resource: domainaudit.ResourceRef{Type: "subscription", ID: e.AggregateID().String(), Name: e.Title},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainsubscription.SubscriptionPaused:
		return domainaudit.AuditEvent{
			EventID:  e.EventID(),
			Action:   domainaudit.ActionUpdateStatus,
			Actor:    actor,
			Resource: domainaudit.ResourceRef{Type: "subscription", ID: e.AggregateID().String()},
			Changes:  []domainaudit.FieldChange{{Field: "status", From: "active", To: "paused"}},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainsubscription.SubscriptionResumed:
		return domainaudit.AuditEvent{
			EventID:  e.EventID(),
			Action:   domainaudit.ActionUpdateStatus,
			Actor:    actor,
			Resource: domainaudit.ResourceRef{Type: "subscription", ID: e.AggregateID().String()},
			Changes:  []domainaudit.FieldChange{{Field: "status", From: "paused", To: "active"}},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainsubscription.SubscriptionDeleted:
		return domainaudit.AuditEvent{
			EventID:  e.EventID(),
			Action:   domainaudit.ActionDelete,
			Actor:    actor,
			Resource: domainaudit.ResourceRef{Type: "subscription", ID: e.AggregateID().String(), Name: e.Title},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainsubscription.SubscriptionFetched:
		// 调度器自动抓取：actor_type=system，UserName 借用存作业名
		if e.IsSystem {
			actor.Type = domainaudit.ActorTypeSystem
			actor.UserName = "subscription_job"
		}
		action := domainaudit.ActionCreate
		if !e.Success {
			action = domainaudit.ActionUpdate
		}
		return domainaudit.AuditEvent{
			EventID:  e.EventID(),
			Action:   action,
			Actor:    actor,
			Resource: domainaudit.ResourceRef{Type: "subscription", ID: e.AggregateID().String(), Name: e.Title},
			Metadata: map[string]any{
				"imported": e.Imported, "failed": e.Failed, "success": e.Success,
				"error": e.Error,
			},
			OccurredAt: e.OccurredAt(),
		}, true

	default:
		return domainaudit.AuditEvent{}, false
	}
}

// idToString 把 int32 资源 ID 转为字符串（role 聚合用 int32 ID）
func idToString(id int32) string {
	return strconv.FormatInt(int64(id), 10)
}
