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
	domainaudit "blog-api/internal/domain/audit"
	domainrole "blog-api/internal/domain/role"
	"blog-api/internal/domain/shared"
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
		s.log.Error().
			Err(err).
			Str("event", event.EventName()).
			Str("event_id", event.EventID().String()).
			Str("aggregate_id", event.AggregateID().String()).
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
			Resource:   domainaudit.ResourceRef{Type: "user", ID: e.AggregateID().String()},
			Changes:    []domainaudit.FieldChange{{Field: "role", From: string(e.From), To: string(e.To)}},
			OccurredAt: e.OccurredAt(),
		}, true

	case domainuser.UserStatusChanged:
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionUpdateStatus,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "user", ID: e.AggregateID().String()},
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
			Resource:   domainaudit.ResourceRef{Type: "user", ID: e.AggregateID().String()},
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
		return domainaudit.AuditEvent{
			EventID:    e.EventID(),
			Action:     domainaudit.ActionUpdatePerms,
			Actor:      actor,
			Resource:   domainaudit.ResourceRef{Type: "role", ID: idToString(e.RoleID)},
			OccurredAt: e.OccurredAt(),
		}, true

	case authcmd.UserLoggedIn:
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

	default:
		return domainaudit.AuditEvent{}, false
	}
}

// idToString 把 int32 资源 ID 转为字符串（role 聚合用 int32 ID）
func idToString(id int32) string {
	return strconv.FormatInt(int64(id), 10)
}
