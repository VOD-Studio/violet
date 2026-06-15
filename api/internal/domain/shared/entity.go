// Package shared 提供领域层的共享基础类型与抽象。
//
// 本包不依赖任何具体技术实现（无 GORM/Redis/HTTP），
// 仅定义领域层契约，供各聚合（user/post/comment...）复用。
package shared

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

// ============================================================
// 实体与聚合根
// ============================================================

// Entity 所有领域实体的基类
//
// 实体（Entity）由身份标识（ID）定义相等性，而非属性值。
// 例如两个 User 即使所有字段相同但 ID 不同也是不同实体。
type Entity interface {
	// GetID 返回实体的唯一标识
	GetID() ID
}

// AggregateRoot 聚合根基类，可被各具体聚合嵌入
//
// 聚合（Aggregate）是一组相关实体的一致性边界，聚合根是唯一的外部引用入口。
// 聚合根负责：维护内部一致性、记录领域事件、控制对内实体的访问。
//
// 用法:
//
//	type User struct {
//	    shared.AggregateRoot
//	    email Email // 值对象
//	    ...
//	}
type AggregateRoot struct {
	// id 聚合唯一标识
	id ID
	// events 待发布的领域事件列表（聚合根变更时累积，由应用层统一发布）
	events []DomainEvent
}

// GetID 返回聚合根 ID
func (a *AggregateRoot) GetID() ID { return a.id }

// SetID 设置聚合根 ID（仅在创建/重建时调用）
func (a *AggregateRoot) SetID(id ID) { a.id = id }

// RecordEvent 记录一个领域事件，待应用层在事务提交后发布
//
// 设计原则：领域事件在聚合状态变更时记录，而非直接发布，
// 以保证"状态变更"与"事件发布"在同一事务边界内一致完成。
func (a *AggregateRoot) RecordEvent(event DomainEvent) {
	if a.events == nil {
		a.events = make([]DomainEvent, 0, 4)
	}
	a.events = append(a.events, event)
}

// PullEvents 取出并清空所有待发布事件
//
// 应用层调用此方法收集事件，事务提交后通过 EventBus 发布。
func (a *AggregateRoot) PullEvents() []DomainEvent {
	events := a.events
	a.events = nil
	return events
}

// HasEvents 是否有待发布事件
func (a *AggregateRoot) HasEvents() bool { return len(a.events) > 0 }

// ============================================================
// 标识类型
// ============================================================

// ID 领域标识符，基于 UUID v4
//
// 使用值类型而非裸 string/uuid.UUID，便于：
// 1. 在领域层表达"这是身份标识"而非任意字符串
// 2. 未来切换 ID 生成策略时只改一处
type ID struct {
	value uuid.UUID
}

// NewID 生成新的随机 ID
func NewID() ID { return ID{value: uuid.New()} }

// ParseID 从字符串解析 ID，格式非法返回错误
func ParseID(s string) (ID, error) {
	v, err := uuid.Parse(s)
	if err != nil {
		return ID{}, ErrInvalidID.WithErr(err)
	}
	return ID{value: v}, nil
}

// MustParseID 从字符串解析 ID，格式非法 panic（仅用于测试或常量）
func MustParseID(s string) ID {
	id, err := ParseID(s)
	if err != nil {
		panic(err)
	}
	return id
}

// String 返回 ID 的字符串表示
func (i ID) String() string { return i.value.String() }

// IsZero 是否为零值（未设置）
func (i ID) IsZero() bool { return i.value == uuid.UUID{} }

// Equal 比较两个 ID 是否相等
func (i ID) Equal(other ID) bool { return i.value == other.value }

// UUID 返回底层 uuid.UUID（基础设施层序列化用）
func (i ID) UUID() uuid.UUID { return i.value }

// ErrInvalidID 非法 ID 错误
var ErrInvalidID = NewError("INVALID_ID", "ID 格式非法", 0)

// ============================================================
// 审计字段（可被聚合嵌入）
// ============================================================

// Timestamps 创建/更新时间戳，可被聚合或实体嵌入
type Timestamps struct {
	CreatedAt time.Time
	UpdatedAt time.Time
}

// ============================================================
// 错误辅助
// ============================================================

// Ensure err 变量在 errors 包中可见（避免 unused import）
var _ = errors.Is
