// Package gorm 提供 audit 模块的 GORM 存储实现。
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

	// actor 操作人字段
	ActorUserID   string `gorm:"type:uuid;index;column:actor_user_id" json:"actor_user_id"`
	ActorUserName string `gorm:"type:varchar(50);column:actor_user_name" json:"actor_user_name"`
	IPAddress     string `gorm:"type:varchar(45);column:ip_address" json:"ip_address"`
	UserAgent     string `gorm:"type:varchar(255);column:user_agent" json:"user_agent"`

	// resource 资源字段
	ResourceType string `gorm:"type:varchar(50);index;column:resource_type" json:"resource_type"`
	ResourceID   string `gorm:"type:varchar(255);column:resource_id" json:"resource_id"`
	ResourceName string `gorm:"type:varchar(255);column:resource_name" json:"resource_name"`

	// changes 字段变更列表（jsonb，结构化 before/after）
	Changes string `gorm:"type:jsonb;column:changes" json:"changes"`
	// metadata 兜底元数据
	Metadata string `gorm:"type:jsonb;column:metadata" json:"metadata"`

	CreatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP;column:created_at" json:"created_at"`
}

// TableName 表名
func (AuditEventPO) TableName() string { return "audit_events" }

// EventStore 实现领域 EventStore 端口（append-only）。
type EventStore struct {
	db *gorm.DB
}

// NewEventStore 创建审计日志存储
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
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit
	var total int64
	if err := s.db.WithContext(ctx).Model(&AuditEventPO{}).Count(&total).Error; err != nil {
		return domainaudit.ListResult{}, domainshared.Internal("审计事件计数失败", err)
	}
	var pos []AuditEventPO
	if err := s.db.WithContext(ctx).
		Model(&AuditEventPO{}).
		Order("occurred_at DESC").
		Offset(offset).Limit(limit).
		Find(&pos).Error; err != nil {
		return domainaudit.ListResult{}, domainshared.Internal("查询审计事件失败", err)
	}
	events := poSliceToDomain(pos)
	return domainaudit.ListResult{Events: events, Total: total}, nil
}

// ListByActor 分页查询指定操作人的事件
func (s *EventStore) ListByActor(ctx context.Context, userID string, page, limit int) (domainaudit.ListResult, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit
	var total int64
	if err := s.db.WithContext(ctx).Model(&AuditEventPO{}).Where("actor_user_id = ?", userID).Count(&total).Error; err != nil {
		return domainaudit.ListResult{}, domainshared.Internal("用户审计事件计数失败", err)
	}
	var pos []AuditEventPO
	if err := s.db.WithContext(ctx).
		Model(&AuditEventPO{}).
		Where("actor_user_id = ?", userID).
		Order("occurred_at DESC").
		Offset(offset).Limit(limit).
		Find(&pos).Error; err != nil {
		return domainaudit.ListResult{}, domainshared.Internal("查询用户审计事件失败", err)
	}
	events := poSliceToDomain(pos)
	return domainaudit.ListResult{Events: events, Total: total}, nil
}

// buildPO 把领域事件转换为 PO。Changes/Metadata 序列化为 JSON。
func buildPO(e domainaudit.AuditEvent) (AuditEventPO, error) {
	po := AuditEventPO{
		EventID:       e.EventID.String(),
		Action:        e.Action.String(),
		ActorUserID:   e.Actor.UserID,
		ActorUserName: e.Actor.UserName,
		IPAddress:     e.Actor.IPAddress,
		UserAgent:     e.Actor.UserAgent,
		ResourceType:  e.Resource.Type,
		ResourceID:    e.Resource.ID,
		ResourceName:  e.Resource.Name,
		OccurredAt:    e.OccurredAt,
	}
	if len(e.Changes) > 0 {
		b, err := json.Marshal(e.Changes)
		if err != nil {
			return AuditEventPO{}, domainshared.Internal("变更字段序列化失败", err)
		}
		po.Changes = string(b)
	}
	if len(e.Metadata) > 0 {
		b, err := json.Marshal(e.Metadata)
		if err != nil {
			return AuditEventPO{}, domainshared.Internal("元数据序列化失败", err)
		}
		po.Metadata = string(b)
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
	event := domainaudit.AuditEvent{
		EventID:    eventID,
		Action:     domainaudit.MustParse(po.Action),
		Actor: domainaudit.Actor{
			UserID:    po.ActorUserID,
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
	if po.Changes != "" {
		var changes []domainaudit.FieldChange
		if json.Unmarshal([]byte(po.Changes), &changes) == nil {
			event.Changes = changes
		}
	}
	if po.Metadata != "" {
		var meta map[string]any
		if json.Unmarshal([]byte(po.Metadata), &meta) == nil {
			event.Metadata = meta
		}
	}
	return event
}
