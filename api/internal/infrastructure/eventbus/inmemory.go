// Package eventbus 提供事件总线的具体实现。
//
// 当前提供进程内同步实现（InMemory），P3 阶段可扩展 Redis Stream
// 或 MQ 异步实现而无需改动应用层代码。
package eventbus

import (
	"context"
	"sync"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/shared"
)

// Handler 事件处理函数签名
type Handler func(ctx context.Context, event shared.DomainEvent) error

// InMemory 进程内同步事件总线
//
// 实现：发布时遍历订阅者并同步调用 handler。
// 适用场景：单进程应用、事件处理快速且无跨服务依赖。
//
// 容错策略：单 handler 失败仅记录日志，不影响其他 handler（容错隔离）。
// 但所有 handler 串行执行，慢 handler 会阻塞后续——若需异步可改用 goroutine 池。
type InMemory struct {
	mu       sync.RWMutex
	handlers map[string][]Handler // eventName -> handlers
}

// NewInMemory 创建进程内事件总线
func NewInMemory() *InMemory {
	return &InMemory{
		handlers: make(map[string][]Handler),
	}
}

// Subscribe 订阅指定类型的事件
//
// eventName 为空表示订阅所有事件（通配）。
func (b *InMemory) Subscribe(eventName string, handler Handler) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.handlers[eventName] = append(b.handlers[eventName], handler)
}

// Publish 同步发布事件给所有匹配的订阅者
func (b *InMemory) Publish(ctx context.Context, events []shared.DomainEvent) error {
	b.mu.RLock()
	defer b.mu.RUnlock()

	for _, event := range events {
		// 精确匹配的 handler
		name := event.EventName()
		b.dispatch(ctx, name, event)
		// 通配订阅者（eventName 为空）
		b.dispatch(ctx, "", event)
	}
	return nil
}

// dispatch 调用单个 eventName 下的所有 handler（容错隔离）
func (b *InMemory) dispatch(ctx context.Context, eventName string, event shared.DomainEvent) {
	handlers, ok := b.handlers[eventName]
	if !ok {
		return
	}
	for _, h := range handlers {
		if err := h(ctx, event); err != nil {
			// 单个 handler 失败不影响其他 handler
			log.Error().
				Err(err).
				Str("event", event.EventName()).
				Str("event_id", event.EventID().String()).
				Str("aggregate_id", event.AggregateID().String()).
				Msg("事件处理失败")
		}
	}
}

// 编译期断言：InMemory 实现应用层 EventBus 端口
var _ appshared.EventBus = (*InMemory)(nil)
