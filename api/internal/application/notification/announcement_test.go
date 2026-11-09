package notification

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainannouncement "blog-api/internal/domain/announcement"
	domainnotification "blog-api/internal/domain/notification"
	domainshared "blog-api/internal/domain/shared"
)

// --- 公告通知 ---

type fakeAnnouncementLookup struct {
	a   *domainannouncement.Announcement
	err error
}

func (f fakeAnnouncementLookup) FindByID(context.Context, int32) (*domainannouncement.Announcement, error) {
	return f.a, f.err
}

type fakeEnabledUsers struct {
	ids []domainshared.ID
	err error
}

func (f fakeEnabledUsers) FindEnabledUserIDs(context.Context) ([]domainshared.ID, error) {
	return f.ids, f.err
}

// failingForUserStore 对指定接收者写入失败，其余正常落库。
type failingForUserStore struct {
	fakeStoreCorrect
	failUser domainshared.ID
}

func (f *failingForUserStore) Save(ctx context.Context, n *domainnotification.Notification) error {
	if n.UserID() == f.failUser {
		return errors.New("db hiccup")
	}
	return f.fakeStoreCorrect.Save(ctx, n)
}

func newAnnouncement(t *testing.T, title, content string) *domainannouncement.Announcement {
	t.Helper()
	a, err := domainannouncement.NewAnnouncement(7, title, content, domainannouncement.SeverityInfo)
	require.NoError(t, err)
	return a
}

func announcementSubscriber(store domainnotification.NotificationRepository, a *domainannouncement.Announcement, users ...domainshared.ID) *Subscriber {
	lookups := stubLookups()
	lookups.Announcement = fakeAnnouncementLookup{a: a}
	lookups.EnabledUsers = fakeEnabledUsers{ids: users}
	sub := NewSubscriber(store, lookups, zerolog.Nop())
	sub.now = func() time.Time { return time.Date(2026, 11, 9, 12, 0, 0, 0, time.UTC) }
	return sub
}

func TestSubscriber_AnnouncementCreated_NotifiesEveryEnabledUser(t *testing.T) {
	store := &fakeStoreCorrect{}
	u1, u2, u3 := newID(), newID(), newID()
	a := newAnnouncement(t, "站点升级", "今晚 23:00 起\n维护 30 分钟")
	sub := announcementSubscriber(store, a, u1, u2, u3)
	event := domainannouncement.NewAnnouncementCreated(7)

	require.NoError(t, sub.Handle(context.Background(), event))

	require.Len(t, store.saved, 3)
	for i, wantUser := range []domainshared.ID{u1, u2, u3} {
		n := store.saved[i]
		assert.Equal(t, wantUser, n.UserID())
		assert.Equal(t, domainnotification.SourceAnnouncement, n.SourceType())
		assert.Equal(t, domainshared.IDFromUUID(event.EventID()), n.SourceID(), "source_id 取触发事件 ID")
		assert.Equal(t, domainshared.IDFromUUID(event.EventID()), n.EventID())
		assert.Equal(t, "新公告「站点升级」", n.Title())

		dto := toDTO(viaDB(t, n))
		assert.Equal(t, "announcement", dto.SourceType)
		assert.Nil(t, dto.Actor, "公告是系统消息，没有行为人")
		assert.Equal(t, "站点升级", dto.ObjectTitle)
		assert.Equal(t, "今晚 23:00 起 维护 30 分钟", dto.Quote)
		assert.Equal(t, float64(7), dto.Payload["announcement_id"], "公告主键以数字放进 payload")
	}
}

func TestSubscriber_AnnouncementCreated_ArticleFallsBackToExcerpt(t *testing.T) {
	store := &fakeStoreCorrect{}
	user := newID()
	a := domainannouncement.ReconstructAnnouncement(7, "长文公告", "", domainannouncement.SeverityInfo,
		domainannouncement.DisplayArticle, true, nil, nil, 0, nil,
		"# md", "<h1>md</h1>", "", "纯文本摘要", nil, time.Now(), time.Now())
	sub := announcementSubscriber(store, a, user)

	require.NoError(t, sub.Handle(context.Background(), domainannouncement.NewAnnouncementCreated(7)))

	require.Len(t, store.saved, 1)
	assert.Equal(t, "纯文本摘要", toDTO(viaDB(t, store.saved[0])).Quote)
}

func TestSubscriber_AnnouncementCreated_NotInEffect_NoNotification(t *testing.T) {
	now := time.Date(2026, 11, 9, 12, 0, 0, 0, time.UTC)
	future, past := now.Add(24*time.Hour), now.Add(-24*time.Hour)

	disabled := newAnnouncement(t, "草稿", "内容")
	disabled.SetActive(false)
	scheduled := newAnnouncement(t, "定时", "内容")
	require.NoError(t, scheduled.SetTimeRange(&future, nil))
	expired := newAnnouncement(t, "过期", "内容")
	require.NoError(t, expired.SetTimeRange(nil, &past))

	for name, a := range map[string]*domainannouncement.Announcement{"停用": disabled, "未到开始时间": scheduled, "已过结束时间": expired} {
		t.Run(name, func(t *testing.T) {
			store := &fakeStoreCorrect{}
			sub := announcementSubscriber(store, a, newID())

			require.NoError(t, sub.Handle(context.Background(), domainannouncement.NewAnnouncementCreated(7)))
			assert.Empty(t, store.saved)
		})
	}
}

func TestSubscriber_AnnouncementCreated_LookupFailures_NoNotificationNoError(t *testing.T) {
	a := newAnnouncement(t, "公告", "内容")

	t.Run("公告读取失败", func(t *testing.T) {
		store := &fakeStoreCorrect{}
		lookups := stubLookups()
		lookups.Announcement = fakeAnnouncementLookup{err: errors.New("not found")}
		lookups.EnabledUsers = fakeEnabledUsers{ids: []domainshared.ID{newID()}}
		sub := NewSubscriber(store, lookups, zerolog.Nop())

		require.NoError(t, sub.Handle(context.Background(), domainannouncement.NewAnnouncementCreated(7)))
		assert.Empty(t, store.saved)
	})
	t.Run("用户枚举失败", func(t *testing.T) {
		store := &fakeStoreCorrect{}
		lookups := stubLookups()
		lookups.Announcement = fakeAnnouncementLookup{a: a}
		lookups.EnabledUsers = fakeEnabledUsers{err: errors.New("db down")}
		sub := NewSubscriber(store, lookups, zerolog.Nop())

		require.NoError(t, sub.Handle(context.Background(), domainannouncement.NewAnnouncementCreated(7)))
		assert.Empty(t, store.saved)
	})
	t.Run("没有启用用户", func(t *testing.T) {
		store := &fakeStoreCorrect{}
		sub := announcementSubscriber(store, a)

		require.NoError(t, sub.Handle(context.Background(), domainannouncement.NewAnnouncementCreated(7)))
		assert.Empty(t, store.saved)
	})
}

// 某一行写入失败不影响其余接收者。
func TestSubscriber_AnnouncementCreated_OneRowFailureDoesNotAbortRest(t *testing.T) {
	u1, u2, u3 := newID(), newID(), newID()
	store := &failingForUserStore{failUser: u2}
	sub := announcementSubscriber(store, newAnnouncement(t, "公告", "内容"), u1, u2, u3)

	require.NoError(t, sub.Handle(context.Background(), domainannouncement.NewAnnouncementCreated(7)))

	require.Len(t, store.saved, 2)
	assert.Equal(t, u1, store.saved[0].UserID())
	assert.Equal(t, u3, store.saved[1].UserID())
}

// 公告通知同样走 SSE 实时推送。
func TestPushingSubscriber_AnnouncementCreated_PushesToEachUser(t *testing.T) {
	store := &fakeStoreCorrect{}
	notif := &fakeNotifier{}
	u1, u2 := newID(), newID()
	lookups := stubLookups()
	lookups.Announcement = fakeAnnouncementLookup{a: newAnnouncement(t, "站点升级", "内容")}
	lookups.EnabledUsers = fakeEnabledUsers{ids: []domainshared.ID{u1, u2}}
	sub := NewPushingSubscriber(store, lookups, notif, nil, zerolog.Nop())

	require.NoError(t, sub.Handle(context.Background(), domainannouncement.NewAnnouncementCreated(7)))

	assert.Equal(t, []domainshared.ID{u1, u2}, notif.pushed)
	require.Len(t, notif.events, 2)
	assert.Equal(t, "announcement", notif.events[0].SourceType)
	assert.Equal(t, "站点升级", notif.events[0].ObjectTitle)
	assert.Equal(t, "内容", notif.events[0].Quote)
}

// 未装配公告端口（旧装配）时公告事件静默跳过，不影响其他类型。
func TestSubscriber_AnnouncementCreated_WithoutPortsIsSkipped(t *testing.T) {
	store := &fakeStoreCorrect{}
	sub := NewSubscriber(store, stubLookups(), zerolog.Nop())

	require.NoError(t, sub.Handle(context.Background(), domainannouncement.NewAnnouncementCreated(7)))
	assert.Empty(t, store.saved)
}
