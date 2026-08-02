package audit

import (
	"context"
	"errors"
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appshared "blog-api/internal/application/shared"

	domainaudit "blog-api/internal/domain/audit"
	domainrole "blog-api/internal/domain/role"
	"blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
	"blog-api/internal/middleware"
)

// fakeStore EventStore 的内存 stub，捕获 Append 的 AuditEvent。
type fakeStore struct {
	appended []domainaudit.AuditEvent
	err      error
}

func (f *fakeStore) Append(_ context.Context, event domainaudit.AuditEvent) error {
	if f.err != nil {
		return f.err
	}
	f.appended = append(f.appended, event)
	return nil
}

func (f *fakeStore) List(context.Context, int, int) (domainaudit.ListResult, error) {
	return domainaudit.ListResult{}, nil
}

func (f *fakeStore) ListByActor(context.Context, string, int, int) (domainaudit.ListResult, error) {
	return domainaudit.ListResult{}, nil
}

func newTestSubscriber(store *fakeStore) *Subscriber {
	return NewSubscriber(store, zerolog.Nop())
}

// auditCtx 构造带审计上下文的 ctx（模拟 session 中间件注入）。
func auditCtx(t *testing.T, userID, email, ip, ua string) context.Context {
	t.Helper()
	ctx := context.Background()
	ctx = context.WithValue(ctx, middleware.UserIDKey, userID)
	ctx = context.WithValue(ctx, middleware.UserEmailKey, email)
	ctx = context.WithValue(ctx, middleware.ClientIPKey, ip)
	ctx = context.WithValue(ctx, middleware.UserAgentKey, ua)
	return ctx
}

func TestSubscriber_UserRegistered_RecordsCreateEvent(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "Go-http-client")

	userID := shared.NewID()
	email, _ := domainuser.ParseEmail("alice@example.com")
	err := sub.Handle(ctx, domainuser.NewUserRegistered(userID, email))
	require.NoError(t, err)

	require.Len(t, store.appended, 1)
	e := store.appended[0]
	assert.Equal(t, domainaudit.ActionCreate, e.Action)
	assert.Equal(t, "user", e.Resource.Type)
	assert.Equal(t, userID.String(), e.Resource.ID)
	assert.Equal(t, "alice@example.com", e.Resource.Name)
	// Actor 从 ctx 提取
	assert.Equal(t, "actor-1", e.Actor.UserID)
	assert.Equal(t, "admin@blog.com", e.Actor.UserName)
	assert.Equal(t, "1.2.3.4", e.Actor.IPAddress)
	assert.Equal(t, "Go-http-client", e.Actor.UserAgent)
}

func TestSubscriber_UserPasswordChanged_RecordsUpdateWithChange(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "ua")

	userID := shared.NewID()
	require.NoError(t, sub.Handle(ctx, domainuser.NewUserPasswordChanged(userID)))

	require.Len(t, store.appended, 1)
	e := store.appended[0]
	assert.Equal(t, domainaudit.ActionUpdate, e.Action)
	require.Len(t, e.Changes, 1)
	assert.Equal(t, "password", e.Changes[0].Field)
}

func TestSubscriber_RoleCreated_RecordsCreateWithRoleName(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "ua")

	name, err := domainrole.ParseRoleName("admin")
	require.NoError(t, err)
	require.NoError(t, sub.Handle(ctx, domainrole.NewRoleCreated(42, name)))

	require.Len(t, store.appended, 1)
	e := store.appended[0]
	assert.Equal(t, domainaudit.ActionCreate, e.Action)
	assert.Equal(t, "role", e.Resource.Type)
	assert.Equal(t, "42", e.Resource.ID)
	assert.Equal(t, "admin", e.Resource.Name)
}

func TestSubscriber_UnknownEvent_Ignored(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := context.Background()

	// 任意未映射的领域事件（用 BaseEvent 构造）
	ev := shared.NewBaseEvent("unknown.event", shared.NewID())
	require.NoError(t, sub.Handle(ctx, ev))
	assert.Empty(t, store.appended, "未知事件不应写入审计")
}

func TestSubscriber_AppendFailure_ReturnsError(t *testing.T) {
	store := &fakeStore{err: errors.New("db down")}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "ua")

	userID := shared.NewID()
	email, _ := domainuser.ParseEmail("alice@example.com")
	err := sub.Handle(ctx, domainuser.NewUserRegistered(userID, email))
	require.Error(t, err, "写库失败应返回 error（EventBus 记录处理失败）")
}

func TestSubscriber_Subscribe_UsesWildcard(t *testing.T) {
	// 通配订阅：空 eventName，保证未来新增事件无需改装配
	sub := &Subscriber{store: &fakeStore{}, log: zerolog.Nop()}

	// 用 InMemory bus 验证订阅后事件可达
	bus := &recordingBus{}
	sub.Subscribe(bus)
	require.Equal(t, "", bus.subscribedName, "应通配订阅全部事件")
}

// recordingBus 仅记录 Subscribe 参数。
type recordingBus struct {
	subscribedName string
}

func (b *recordingBus) Publish(context.Context, []shared.DomainEvent) error { return nil }
func (b *recordingBus) Subscribe(eventName string, _ appshared.EventHandler) {
	b.subscribedName = eventName
}
