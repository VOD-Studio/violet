package eventbus

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/shared"
)

// fakeEvent 简单的领域事件实现，供测试路由用。
type fakeEvent struct {
	shared.BaseEvent
	payload string
}

func newFakeEvent(name string, payload string) *fakeEvent {
	return &fakeEvent{BaseEvent: shared.NewBaseEvent(name, shared.NewID()), payload: payload}
}

func newFakeEventWithAggregate(name string, aggregateID shared.ID, payload string) *fakeEvent {
	return &fakeEvent{BaseEvent: shared.NewBaseEvent(name, aggregateID), payload: payload}
}

func TestInMemory_Publish_NoSubscribersIsNoop(t *testing.T) {
	bus := NewInMemory()
	err := bus.Publish(context.Background(), []shared.DomainEvent{
		newFakeEvent("user.registered", "alice"),
	})
	require.NoError(t, err)
}

func TestInMemory_SubscribeAndPublish_RoutesByEventName(t *testing.T) {
	bus := NewInMemory()

	var (
		mu      sync.Mutex
		got     []string
		orderMu sync.Mutex
		order   []string
	)
	capture := func(name string) appshared.EventHandler {
		return func(_ context.Context, event shared.DomainEvent) error {
			mu.Lock()
			got = append(got, event.EventName()+":"+name)
			mu.Unlock()
			orderMu.Lock()
			order = append(order, name)
			orderMu.Unlock()
			return nil
		}
	}
	bus.Subscribe("user.registered", capture("A"))
	bus.Subscribe("post.published", capture("B"))

	require.NoError(t, bus.Publish(context.Background(), []shared.DomainEvent{
		newFakeEvent("user.registered", "alice"),
		newFakeEvent("post.published", "hello"),
		newFakeEvent("role.created", "admin"), // 无订阅者
	}))

	mu.Lock()
	defer mu.Unlock()
	assert.ElementsMatch(t, []string{"user.registered:A", "post.published:B"}, got)
}

func TestInMemory_Subscribe_MultipleHandlersOnSameEvent_AllInvoked(t *testing.T) {
	bus := NewInMemory()

	var counter int32
	makeCount := func() appshared.EventHandler {
		return func(_ context.Context, _ shared.DomainEvent) error {
			atomic.AddInt32(&counter, 1)
			return nil
		}
	}
	bus.Subscribe("user.registered", makeCount())
	bus.Subscribe("user.registered", makeCount())
	bus.Subscribe("user.registered", makeCount())

	require.NoError(t, bus.Publish(context.Background(), []shared.DomainEvent{
		newFakeEvent("user.registered", "alice"),
	}))
	assert.Equal(t, int32(3), atomic.LoadInt32(&counter))
}

func TestInMemory_Publish_HandlerErrorDoesNotBlockOthers(t *testing.T) {
	bus := NewInMemory()

	var aCalled, cCalled int32
	bus.Subscribe("user.registered", func(_ context.Context, _ shared.DomainEvent) error {
		atomic.AddInt32(&aCalled, 1)
		return nil
	})
	bus.Subscribe("user.registered", func(_ context.Context, _ shared.DomainEvent) error {
		return errors.New("boom")
	})
	bus.Subscribe("user.registered", func(_ context.Context, _ shared.DomainEvent) error {
		atomic.AddInt32(&cCalled, 1)
		return nil
	})

	require.NoError(t, bus.Publish(context.Background(), []shared.DomainEvent{
		newFakeEvent("user.registered", "alice"),
	}))

	// A 和 C 都应被调用，即使 B 失败
	assert.Equal(t, int32(1), atomic.LoadInt32(&aCalled))
	assert.Equal(t, int32(1), atomic.LoadInt32(&cCalled))
}

func TestInMemory_Publish_EmptyEventListIsNoop(t *testing.T) {
	bus := NewInMemory()
	var called int32
	bus.Subscribe("user.registered", func(_ context.Context, _ shared.DomainEvent) error {
		atomic.AddInt32(&called, 1)
		return nil
	})

	require.NoError(t, bus.Publish(context.Background(), nil))
	assert.Equal(t, int32(0), atomic.LoadInt32(&called))
}

func TestInMemory_WildcardSubscribe_ReceivesAllEvents(t *testing.T) {
	bus := NewInMemory()

	var got []string
	bus.Subscribe("", func(_ context.Context, event shared.DomainEvent) error {
		got = append(got, event.EventName())
		return nil
	})

	require.NoError(t, bus.Publish(context.Background(), []shared.DomainEvent{
		newFakeEvent("user.registered", "alice"),
		newFakeEvent("post.published", "hello"),
		newFakeEvent("role.created", "admin"),
	}))

	assert.ElementsMatch(t, []string{"user.registered", "post.published", "role.created"}, got)
}

func TestInMemory_Publish_BothExactAndWildcardFire(t *testing.T) {
	bus := NewInMemory()

	var exact, wild int32
	bus.Subscribe("user.registered", func(_ context.Context, _ shared.DomainEvent) error {
		atomic.AddInt32(&exact, 1)
		return nil
	})
	bus.Subscribe("", func(_ context.Context, _ shared.DomainEvent) error {
		atomic.AddInt32(&wild, 1)
		return nil
	})

	require.NoError(t, bus.Publish(context.Background(), []shared.DomainEvent{
		newFakeEvent("user.registered", "alice"),
	}))

	assert.Equal(t, int32(1), atomic.LoadInt32(&exact))
	assert.Equal(t, int32(1), atomic.LoadInt32(&wild))
}

func TestInMemory_HandlerReceivesAggregateIDAndPayload(t *testing.T) {
	bus := NewInMemory()

	aggID := shared.NewID()
	var seenID shared.ID
	var seenPayload string
	bus.Subscribe("user.registered", func(_ context.Context, e shared.DomainEvent) error {
		seenID = e.AggregateID()
		if fe, ok := e.(*fakeEvent); ok {
			seenPayload = fe.payload
		}
		return nil
	})

	require.NoError(t, bus.Publish(context.Background(), []shared.DomainEvent{
		newFakeEventWithAggregate("user.registered", aggID, "alice"),
	}))

	assert.Equal(t, aggID, seenID)
	assert.Equal(t, "alice", seenPayload)
}

func TestInMemory_ConcurrentPublishAndSubscribe_NoRace(t *testing.T) {
	bus := NewInMemory()

	var counter int32
	bus.Subscribe("user.registered", func(_ context.Context, _ shared.DomainEvent) error {
		atomic.AddInt32(&counter, 1)
		return nil
	})

	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				_ = bus.Publish(context.Background(), []shared.DomainEvent{
					newFakeEvent("user.registered", "alice"),
				})
			}
		}()
	}
	// 中途并发新增订阅者（不同事件名，验证 Subscribe 锁正确）
	wg.Add(1)
	go func() {
		defer wg.Done()
		bus.Subscribe("post.published", func(_ context.Context, _ shared.DomainEvent) error {
			return nil
		})
	}()

	wg.Wait()
	assert.Equal(t, int32(800), atomic.LoadInt32(&counter))
}
