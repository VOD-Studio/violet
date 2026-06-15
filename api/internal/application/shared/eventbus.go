// Package shared 提供应用层的共享契约（端口）。
//
// 应用层（application）定义用例编排逻辑，依赖领域层接口与
// 本包定义的端口（EventBus / UnitOfWork），具体实现由基础设施层提供。
package shared

import (
	"context"

	"blog-api/internal/domain/shared"
)

// EventBus 事件总线端口
//
// 应用层通过此接口发布领域事件，无需关心是进程内同步还是
// Redis/MQ 异步分发——由基础设施层决定实现策略。
type EventBus interface {
	// Publish 发布一组事件给所有订阅者
	// 实现应保证：任一订阅者失败不影响其他订阅者（容错隔离）
	Publish(ctx context.Context, events []shared.DomainEvent) error
}

// NoopEventBus 空实现，用于无需事件的场景或测试
type NoopEventBus struct{}

// Publish 不做任何事
func (NoopEventBus) Publish(_ context.Context, _ []shared.DomainEvent) error { return nil }
