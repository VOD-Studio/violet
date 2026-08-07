package gorm

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	domainaudit "blog-api/internal/domain/audit"
	domainshared "blog-api/internal/domain/shared"
)

// AuditEventPO 操作日志 PO（append-only）。
//
// 数据库列按变更频率从高到低排列：occurred_at（热点查询过滤）→
// event_id（去重）→ action/resource_type（索引）→ 业务字段 → 元数据列。
type AuditEventPO struct {
	ID int64 `gorm:"primaryKey;autoIncrement" json:"id"`

	// event_id 事件 UUID（唯一，幂等去重）
	EventID string `gorm:"type:uuid;uniqueIndex;column:event_id" json:"event_id"`
	// action 操作类型（受控枚举字符串）
	Action string `gorm:"type:varchar(50);index;column:action" json:"action"`
	// occurred_at 发生时间（索引，DESC 排序）
	OccurredAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP;index;column:occurred_at" json:"occurred_at"`

	// actor_type 操作者类型（user/system）。区分真人与系统自动化，让审计日志
	// 能分辨「张三删的」vs「定时任务自动删的」（业界共识 AppMaster/Cloudflare）。
	ActorType     string  `gorm:"type:varchar(10);not null;default:'user';column:actor_type" json:"actor_type"`
	ActorUserID   *string `gorm:"type:uuid;index;column:actor_user_id" json:"actor_user_id"`

	// resource 资源字段
	ResourceType string `gorm:"type:varchar(50);index;column:resource_type" json:"resource_type"`
	ResourceID   string `gorm:"type:varchar(255);column:resource_id" json:"resource_id"`
	ResourceName string `gorm:"type:varchar(255);column:resource_name" json:"resource_name"`

	// changes 字段变更列表（jsonb，结构化 before/after）
	// *string：空时以 NULL 入库（jsonb 列拒绝空串）
	Changes *string `gorm:"type:jsonb;column:changes" json:"changes"`
	// metadata 兜底元数据
	Metadata *string `gorm:"type:jsonb;column:metadata" json:"metadata"`

	CreatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP;column:created_at" json:"created_at"`
}

func (AuditEventPO) TableName() string { return "audit_events" }

// EventStore 实现领域 EventStore 端口（append-only）。
type EventStore struct {
	db *gorm.DB
}

func NewEventStore(db *gorm.DB) *EventStore {
	return &EventStore{db: db}
}

// Append 写入一条审计事件（append-only）。
//
// JSON 序列化失败时返回 error（fail-safe：写入失败不可静默）。
func (s *EventStore) Append(ctx context.Context, event domainaudit.AuditEvent) error {
	po, err := buildPO(event)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Create(&po).Error
}

// List 分页查询全部事件（按 OccurredAt DESC）
func (s *EventStore) List(ctx context.Context, page, limit int) (domainaudit.ListResult, error) {
	return s.list(ctx, nil, page, limit, "审计事件")
}

// ListByActor 分页查询指定操作人的事件
func (s *EventStore) ListByActor(ctx context.Context, userID string, page, limit int) (domainaudit.ListResult, error) {
	return s.list(ctx, s.db.WithContext(ctx).Where("actor_user_id = ?", userID), page, limit, "用户审计事件")
}

// ListFiltered 按筛选条件分页查询（action/resource_type/actor 可选）
func (s *EventStore) ListFiltered(ctx context.Context, filter domainaudit.ListFilter, page, limit int) (domainaudit.ListResult, error) {
	q := s.db.WithContext(ctx)
	if filter.Action != nil {
		q = q.Where("action = ?", *filter.Action)
	}
	if filter.ResourceType != nil {
		q = q.Where("resource_type = ?", *filter.ResourceType)
	}
	if filter.ActorUserID != nil {
		q = q.Where("actor_user_id = ?", *filter.ActorUserID)
	}
	return s.list(ctx, q, page, limit, "审计事件")
}

// list 分页查询公共骨架：count + find + 转换。
//
// query 为 nil 时查全部；否则在 query 上追加 Where/Order/Offset/Limit。
// 返回的 ListResult 按 OccurredAt DESC 排序。
func (s *EventStore) list(ctx context.Context, query *gorm.DB, page, limit int, label string) (domainaudit.ListResult, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	base := query
	if base == nil {
		base = s.db.WithContext(ctx)
	}
	base = base.Model(&AuditEventPO{})

	var total int64
	if err := base.Count(&total).Error; err != nil {
		return domainaudit.ListResult{}, domainshared.Internal(label+"计数失败", err)
	}
	var pos []AuditEventPO
	if err := base.
		Order("occurred_at DESC").
		Offset(offset).Limit(limit).
		Find(&pos).Error; err != nil {
		return domainaudit.ListResult{}, domainshared.Internal(label+"查询失败", err)
	}
	return domainaudit.ListResult{Events: poSliceToDomain(pos), Total: total}, nil
}

// buildPO 把领域事件转换为 PO。Changes/Metadata 序列化为 JSON。
func buildPO(e domainaudit.AuditEvent) (AuditEventPO, error) {
	po := AuditEventPO{
		EventID:       e.EventID.String(),
		Action:        e.Action.String(),
		ActorType:     string(e.Actor.Type),
		ActorUserName: e.Actor.UserName,
		ResourceType:  e.Resource.Type,
		ResourceID:    e.Resource.ID,
		ResourceName:  e.Resource.Name,
		OccurredAt:    e.OccurredAt,
	}
	if e.Actor.UserID != "" {
		po.ActorUserID = &e.Actor.UserID
	}
	if len(e.Changes) > 0 {
		b, err := json.Marshal(e.Changes)
		if err != nil {
			return AuditEventPO{}, domainshared.Internal("变更字段序列化失败", err)
		}
		changes := string(b)
		po.Changes = &changes
	}
	if len(e.Metadata) > 0 {
		b, err := json.Marshal(e.Metadata)
		if err != nil {
			return AuditEventPO{}, domainshared.Internal("元数据序列化失败", err)
		}
		meta := string(b)
		po.Metadata = &meta
	}
	return po, nil
}

// poSliceToDomain 把 PO 列表转为领域事件
func poSliceToDomain(pos []AuditEventPO) []domainaudit.AuditEvent {
	events := make([]domainaudit.AuditEvent, 0, len(pos))
	for _, po := range pos {
		events = append(events, poToDomain(po))
	}
	return events
}

func poToDomain(po AuditEventPO) domainaudit.AuditEvent {
	var eventID uuid.UUID
	if po.EventID != "" {
		if parsed, err := uuid.Parse(po.EventID); err == nil {
			eventID = parsed
		}
	}
	action, _ := domainaudit.Parse(po.Action) // 脏数据降级为零值，读路径不 panic
	event := domainaudit.AuditEvent{
		EventID:    eventID,
		Action:     action,
		Actor: domainaudit.Actor{
			Type:      domainaudit.ActorType(po.ActorType),
			UserName:  po.ActorUserName,
			IPAddress: po.IPAddress,
			UserAgent: po.UserAgent,
		},
		Resource: domainaudit.ResourceRef{
			Type: po.ResourceType,
			ID:   po.ResourceID,
			Name: po.ResourceName,
		},
		OccurredAt: po.OccurredAt,
	}
	if po.Changes != nil {
		var changes []domainaudit.FieldChange
		if json.Unmarshal([]byte(*po.Changes), &changes) == nil {
			event.Changes = changes
		}
	}
	if po.Metadata != nil {
		var meta map[string]any
		if json.Unmarshal([]byte(*po.Metadata), &meta) == nil {
			event.Metadata = meta
		}
	}
	if po.ActorUserID != nil {
		event.Actor.UserID = *po.ActorUserID
	}
	return event
}
