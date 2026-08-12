package audit

import (
	"context"
	"errors"
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appshared "blog-api/internal/application/shared"
	authcmd "blog-api/internal/application/auth/command"

	domainannouncement "blog-api/internal/domain/announcement"
	domainapitoken "blog-api/internal/domain/api_token"
	domainaudit "blog-api/internal/domain/audit"
	domaincomment "blog-api/internal/domain/comment"
	domainpost "blog-api/internal/domain/post"
	domainrole "blog-api/internal/domain/role"
	domainsubscription "blog-api/internal/domain/subscription"
	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
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

func (f *fakeStore) ListFiltered(context.Context, domainaudit.ListFilter, int, int) (domainaudit.ListResult, error) {
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
	assert.Equal(t, domainaudit.ActionChangePassword, e.Action)
	assert.Equal(t, "password", e.Changes[0].Field)
	assert.Equal(t, "修改用户密码", e.Summary)
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

func TestSubscriber_UserLoggedIn_RecordsLoginWithProvider(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "Go-http-client")

	userID := shared.NewID()
	require.NoError(t, sub.Handle(ctx, authcmd.NewUserLoggedIn(userID, "password")))

	require.Len(t, store.appended, 1)
	e := store.appended[0]
	assert.Equal(t, domainaudit.ActionLogin, e.Action)
	assert.Equal(t, "auth", e.Resource.Type)
	assert.Equal(t, userID.String(), e.Resource.ID)
	assert.Equal(t, "password", e.Metadata["provider"])
	// 登录发布在 session 创建前，Actor.UserID 从事件 payload 取（被登录用户）
	assert.Equal(t, userID.String(), e.Actor.UserID)
	assert.Equal(t, "1.2.3.4", e.Actor.IPAddress)
}

func TestSubscriber_UserLoggedOut_RecordsLogout(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "ua")

	userID := shared.NewID()
	require.NoError(t, sub.Handle(ctx, authcmd.NewUserLoggedOut(userID)))

	require.Len(t, store.appended, 1)
	assert.Equal(t, domainaudit.ActionLogout, store.appended[0].Action)
}

func TestSubscriber_UserLoginFailed_RecordsFailureWithReason(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "", "", "9.9.9.9", "ua")

	require.NoError(t, sub.Handle(ctx, authcmd.NewUserLoginFailed("密码错误")))

	require.Len(t, store.appended, 1)
	e := store.appended[0]
	assert.Equal(t, domainaudit.ActionLoginFailed, e.Action)
	assert.Equal(t, "密码错误", e.Metadata["reason"])
}

func TestSubscriber_UserRoleChanged_RecordsUpdateRoleWithBeforeAfter(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "ua")

	userID := shared.NewID()
	require.NoError(t, sub.Handle(ctx, domainuser.NewUserRoleChanged(userID, domainuser.RoleUser, domainuser.RoleAdmin, "victim")))

	require.Len(t, store.appended, 1)
	e := store.appended[0]
	assert.Equal(t, domainaudit.ActionUpdateRole, e.Action)
	require.Len(t, e.Changes, 1)
	assert.Equal(t, "role", e.Changes[0].Field)
	assert.Equal(t, string(domainuser.RoleUser), e.Changes[0].From)
	assert.Equal(t, string(domainuser.RoleAdmin), e.Changes[0].To)
}

func TestSubscriber_UserStatusChanged_RecordsUpdateStatus(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "ua")

	userID := shared.NewID()
	require.NoError(t, sub.Handle(ctx, domainuser.NewUserStatusChanged(userID, true, false, "victim")))

	require.Len(t, store.appended, 1)
	e := store.appended[0]
	assert.Equal(t, domainaudit.ActionUpdateStatus, e.Action)
	require.Len(t, e.Changes, 1)
	assert.Equal(t, "is_active", e.Changes[0].Field)
	assert.Equal(t, true, e.Changes[0].From)
	assert.Equal(t, false, e.Changes[0].To)
}

func TestSubscriber_UserDeleted_RecordsDelete(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "ua")

	userID := shared.NewID()
	require.NoError(t, sub.Handle(ctx, domainuser.NewUserDeleted(userID, "victim")))

	require.Len(t, store.appended, 1)
	e := store.appended[0]
	assert.Equal(t, domainaudit.ActionDelete, e.Action)
	assert.Equal(t, userID.String(), e.Resource.ID)
}

func TestSubscriber_BatchUserStatusChanged_RecordsCount(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "ua")

	require.NoError(t, sub.Handle(ctx, domainuser.NewBatchUserStatusChanged(5, false)))

	require.Len(t, store.appended, 1)
	e := store.appended[0]
	assert.Equal(t, domainaudit.ActionBatchUpdate, e.Action)
	assert.Equal(t, int64(5), e.Metadata["count"])
	assert.Equal(t, false, e.Metadata["is_active"])
}

func TestSubscriber_PostPublished_RecordsPublish(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "ua")

	postID := shared.NewID()
	require.NoError(t, sub.Handle(ctx, domainpost.NewPostPublished(postID, "测试文章")))

	require.Len(t, store.appended, 1)
	e := store.appended[0]
	assert.Equal(t, domainaudit.ActionPublish, e.Action)
	assert.Equal(t, "post", e.Resource.Type)
	assert.Equal(t, postID.String(), e.Resource.ID)
}

func TestSubscriber_PostArchived_RecordsArchive(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "ua")

	require.NoError(t, sub.Handle(ctx, domainpost.NewPostArchived(shared.NewID(), "测试文章")))
	require.Len(t, store.appended, 1)
	assert.Equal(t, domainaudit.ActionArchive, store.appended[0].Action)
}

func TestSubscriber_RoleUpdated_RecordsNameChange(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "ua")

	require.NoError(t, sub.Handle(ctx, domainrole.NewRoleUpdated(7, "old-name", "new-name")))
	require.Len(t, store.appended, 1)
	e := store.appended[0]
	assert.Equal(t, domainaudit.ActionUpdate, e.Action)
	require.Len(t, e.Changes, 1)
	assert.Equal(t, "name", e.Changes[0].Field)
	assert.Equal(t, "old-name", e.Changes[0].From)
	assert.Equal(t, "new-name", e.Changes[0].To)
}

func TestSubscriber_AnnouncementCreated_RecordsCreate(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "ua")

	require.NoError(t, sub.Handle(ctx, domainannouncement.NewAnnouncementCreated(42)))
	require.Len(t, store.appended, 1)
	e := store.appended[0]
	assert.Equal(t, domainaudit.ActionCreate, e.Action)
	assert.Equal(t, "announcement", e.Resource.Type)
	assert.Equal(t, "42", e.Resource.ID)
}

func TestSubscriber_AnnouncementDeleted_RecordsDelete(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "ua")

	require.NoError(t, sub.Handle(ctx, domainannouncement.NewAnnouncementDeleted(9)))
	require.Len(t, store.appended, 1)
	assert.Equal(t, domainaudit.ActionDelete, store.appended[0].Action)
}

func TestSubscriber_TweetCreated_RecordsCreate(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "alice@blog.com", "1.2.3.4", "ua")

	tw := newTweetForAudit(t, "推文内容快照")
	require.NoError(t, sub.Handle(ctx, domaintweet.NewTweetCreated(tw)))
	require.Len(t, store.appended, 1)
	e := store.appended[0]
	assert.Equal(t, domainaudit.ActionCreate, e.Action)
	assert.Equal(t, "tweet", e.Resource.Type)
	assert.Equal(t, tw.ID().String(), e.Resource.ID)
	assert.Equal(t, "推文内容快照", e.Resource.Name)
}

func TestSubscriber_TweetDeleted_RecordsDeleteWithAuthor(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "ua")

	tw := newTweetForAudit(t, "被删推文")
	require.NoError(t, sub.Handle(ctx, domaintweet.NewTweetDeleted(tw)))
	require.Len(t, store.appended, 1)
	e := store.appended[0]
	assert.Equal(t, domainaudit.ActionDelete, e.Action)
	assert.Equal(t, "tweet", e.Resource.Type)
	// 原作者进 metadata：管理员删他人推文时可追溯归属
	assert.Equal(t, tw.AuthorID().String(), e.Metadata["author_id"])
}

// newTweetForAudit 构造审计测试用推文。
func newTweetForAudit(t *testing.T, content string) *domaintweet.Tweet {
	t.Helper()
	tw, err := domaintweet.NewTweet(shared.NewID(), content, nil, nil)
	require.NoError(t, err)
	tw.PullEvents() // 丢弃创建事件，测试只关心被 Handle 的那个
	return tw
}

func TestSubscriber_CommentApproved_RecordsApprove(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "ua")

	commentID := shared.NewID()
	require.NoError(t, sub.Handle(ctx, domaincomment.NewCommentApproved(commentID)))

	require.Len(t, store.appended, 1)
	e := store.appended[0]
	assert.Equal(t, domainaudit.ActionApprove, e.Action)
	assert.Equal(t, "comment", e.Resource.Type)
	assert.Equal(t, commentID.String(), e.Resource.ID)
}

func TestSubscriber_CommentSpammed_RecordsReject(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "ua")

	require.NoError(t, sub.Handle(ctx, domaincomment.NewCommentSpammed(shared.NewID())))
	require.Len(t, store.appended, 1)
	assert.Equal(t, domainaudit.ActionReject, store.appended[0].Action)
}

func TestSubscriber_PATCreated_RecordsCreateWithName(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "ua")

	userID := shared.NewID()
	require.NoError(t, sub.Handle(ctx, domainapitoken.NewPATCreated(userID, "ci-token")))

	require.Len(t, store.appended, 1)
	e := store.appended[0]
	assert.Equal(t, domainaudit.ActionCreate, e.Action)
	assert.Equal(t, "api_token", e.Resource.Type)
	assert.Equal(t, "ci-token", e.Resource.Name)
}

func TestSubscriber_SettingsUpdated_RecordsChangedKeys(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "ua")

	require.NoError(t, sub.Handle(ctx, domainsettings.NewSettingsUpdated([]string{"site_name", "bio"})))

	require.Len(t, store.appended, 1)
	e := store.appended[0]
	assert.Equal(t, domainaudit.ActionUpdateConfig, e.Action)
	assert.Equal(t, "settings", e.Resource.Type)
	changed, ok := e.Metadata["changed_keys"].([]string)
	require.True(t, ok)
	assert.ElementsMatch(t, []string{"site_name", "bio"}, changed)
	assert.Contains(t, e.Summary, "更新站点设置")
}

func TestSubscriber_Subscribe_UsesWildcard(t *testing.T) {
	// 通配订阅：空 eventName，保证未来新增事件无需改装配
	sub := &Subscriber{store: &fakeStore{}, log: zerolog.Nop()}

	// 用 InMemory bus 验证订阅后事件可达
	bus := &recordingBus{}
	sub.Subscribe(bus)
	require.Equal(t, "", bus.subscribedName, "应通配订阅全部事件")
}

// ---- subscription 事件 ----

func TestSubscriber_SubscriptionCreated_RecordsCreate(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "ua")

	sid := shared.NewID()
	require.NoError(t, sub.Handle(ctx, domainsubscription.NewSubscriptionCreated(sid, "https://feed.example.com/rss", "我的源")))

	require.Len(t, store.appended, 1)
	e := store.appended[0]
	assert.Equal(t, domainaudit.ActionCreate, e.Action)
	assert.Equal(t, "subscription", e.Resource.Type)
	assert.Equal(t, sid.String(), e.Resource.ID)
	assert.Equal(t, "我的源", e.Resource.Name)
	assert.Equal(t, domainaudit.ActorTypeUser, e.Actor.Type)
}

func TestSubscriber_SubscriptionFetched_SystemActor(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "ua")

	sid := shared.NewID()
	ev := domainsubscription.NewSubscriptionFetched(sid, "源", true, 3, 0, "", true)
	require.NoError(t, sub.Handle(ctx, ev))
	e := store.appended[0]
	assert.Equal(t, domainaudit.ActionFetchFeed, e.Action, "抓取应映射 fetch_feed 而非 create/update")
	assert.Contains(t, e.Summary, "成功", "成功抓取摘要应包含「成功」")
	assert.Equal(t, domainaudit.ActorTypeSystem, e.Actor.Type, "调度器抓取应为 system actor")
	assert.Equal(t, "subscription_job", e.Actor.UserName, "system actor 的 UserName 借用存作业名")
}

func TestSubscriber_SubscriptionFetched_UserActor(t *testing.T) {
	store := &fakeStore{}
	sub := newTestSubscriber(store)
	ctx := auditCtx(t, "actor-1", "admin@blog.com", "1.2.3.4", "ua")

	sid := shared.NewID()
	ev := domainsubscription.NewSubscriptionFetched(sid, "源", true, 3, 0, "", false)
	require.NoError(t, sub.Handle(ctx, ev))
	e := store.appended[0]
	assert.Equal(t, domainaudit.ActionFetchFeed, e.Action, "手动抓取同样映射 fetch_feed")
	assert.Equal(t, domainaudit.ActorTypeUser, e.Actor.Type, "手动触发应为 user actor")
}

// recordingBus 仅记录 Subscribe 参数。
type recordingBus struct {
	subscribedName string
}

func (b *recordingBus) Publish(context.Context, []shared.DomainEvent) error { return nil }
func (b *recordingBus) Subscribe(eventName string, _ appshared.EventHandler) {
	b.subscribedName = eventName
}
