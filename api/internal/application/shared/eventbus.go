// Package shared 提供应用层的共享契约（端口）。
//
// 应用层（application）定义用例编排逻辑，依赖领域层接口与
// 本包定义的端口（EventBus / UnitOfWork），具体实现由基础设施层提供。
package shared

import (
	"context"

	"blog-api/internal/domain/shared"
)

// EventHandler 领域事件处理函数。
//
// 订阅者实现此类型，通过 EventBus.Subscribe 注册到指定事件名。
// 返回 error 表示处理失败；EventBus 实现负责容错隔离（单 handler 失败
// 不影响其他 handler），并记录降级日志。
type EventHandler func(ctx context.Context, event shared.DomainEvent) error

// EventBus 事件总线端口
//
// 应用层通过此接口发布领域事件，无需关心是进程内同步还是
// Redis/MQ 异步分发——由基础设施层决定实现策略。
//
// 订阅者通过 Subscribe 注册到事件名（EventName），可通配（空 eventName
// 订阅全部事件）。审计订阅者、邮件通知等跨聚合关注点在此挂载。
type EventBus interface {
	// Publish 发布一组事件给所有匹配的订阅者
	// 实现应保证：任一订阅者失败不影响其他订阅者（容错隔离）
	Publish(ctx context.Context, events []shared.DomainEvent) error

	// Subscribe 订阅指定类型的事件。
	// eventName 为空字符串表示订阅所有事件（通配）。
	Subscribe(eventName string, handler EventHandler)
}

// NoopEventBus 空实现，用于无需事件的场景或测试
type NoopEventBus struct{}

// Publish 不做任何事
func (NoopEventBus) Publish(_ context.Context, _ []shared.DomainEvent) error { return nil }

// Subscribe 不做任何事
func (NoopEventBus) Subscribe(_ string, _ EventHandler) {}
