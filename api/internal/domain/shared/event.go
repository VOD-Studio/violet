package shared

import (
	"time"

	"github.com/google/uuid"
)

// DomainEvent 领域事件接口
//
// 领域事件表示领域中已经发生的、对业务有意义的事实。
// 例如：用户已注册、文章已发布、评论已审核通过。
//
// 事件以过去时命名（UserRegistered 而非 RegisterUser），
// 不可变（发生后不可修改），携带发生时间与相关聚合标识。
//
// 事件通常由聚合根在状态变更时通过 RecordEvent 记录，
// 应用层在事务提交后通过 EventBus 发布给订阅者，
// 实现跨聚合的松耦合通信（如注册成功后发送邮件、写审计日志）。
type DomainEvent interface {
	// EventName 事件类型名称（用于路由订阅，如 "user.registered"）
	EventName() string
	// EventID 事件唯一标识（用于幂等去重）
	EventID() uuid.UUID
	// OccurredAt 事件发生时间
	OccurredAt() time.Time
	// AggregateID 触发事件的聚合根 ID
	AggregateID() ID
}

// BaseEvent 领域事件基类，可被具体事件嵌入
//
// 用法:
//
//	type UserRegistered struct {
//	    shared.BaseEvent
//	    Email string
//	}
//	// 构造：UserRegistered{BaseEvent: shared.NewBaseEvent("user.registered", userID)}
type BaseEvent struct {
	// eventName 事件类型名称，用于路由订阅（如 "user.registered"）
	eventName string
	// eventID 事件唯一标识，供消费者做幂等去重
	eventID uuid.UUID
	// occurredAt 事件发生时间（聚合根记录事件的时刻）
	occurredAt time.Time
	// aggregateID 触发该事件的聚合根 ID
	aggregateID ID
}

// NewBaseEvent 创建事件基类
func NewBaseEvent(name string, aggregateID ID) BaseEvent {
	return BaseEvent{
		eventName:   name,
		eventID:     uuid.New(),
		occurredAt:  time.Now(),
		aggregateID: aggregateID,
	}
}

// EventName 事件类型名称
func (e BaseEvent) EventName() string { return e.eventName }

// EventID 事件唯一标识
func (e BaseEvent) EventID() uuid.UUID { return e.eventID }

// OccurredAt 事件发生时间
func (e BaseEvent) OccurredAt() time.Time { return e.occurredAt }

// AggregateID 触发事件的聚合根 ID
func (e BaseEvent) AggregateID() ID { return e.aggregateID }
