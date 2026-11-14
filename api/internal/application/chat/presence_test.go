package chat

import (
	"context"
	"io"
	"testing"
	"time"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
	"github.com/rs/zerolog"
)

type presenceRepo struct {
	domainchat.ConversationRepository
	conversation *domainchat.Conversation
	members      []*domainchat.Member
	coMembers    map[domainshared.ID][]domainshared.ID
}

func (r *presenceRepo) FindByIDForMember(context.Context, domainshared.ID, domainshared.ID) (*domainchat.Conversation, error) {
	return r.conversation, nil
}

func (r *presenceRepo) ListMembers(context.Context, domainshared.ID, bool) ([]*domainchat.Member, error) {
	return r.members, nil
}

func (r *presenceRepo) ListCoMemberIDs(_ context.Context, userID domainshared.ID) ([]domainshared.ID, error) {
	return r.coMembers[userID], nil
}

type memorySettings struct {
	hidden map[domainshared.ID]bool
}

func (s *memorySettings) HiddenOnline(_ context.Context, ids []domainshared.ID) (map[domainshared.ID]bool, error) {
	out := map[domainshared.ID]bool{}
	for _, id := range ids {
		if s.hidden[id] {
			out[id] = true
		}
	}
	return out, nil
}

func (s *memorySettings) SetHideOnline(_ context.Context, userID domainshared.ID, hide bool) error {
	s.hidden[userID] = hide
	return nil
}

type presenceFixture struct {
	svc      *Service
	manager  *ConnectionManager
	settings *memorySettings
	notifier *typingNotifier
	room     domainshared.ID
	viewer   domainshared.ID
	peer     domainshared.ID
	other    domainshared.ID
}

func newPresenceFixture(t *testing.T) *presenceFixture {
	t.Helper()
	now := time.Date(2026, 11, 14, 10, 0, 0, 0, time.UTC)
	viewer, peer, other := domainshared.NewID(), domainshared.NewID(), domainshared.NewID()
	conversation, err := domainchat.NewConversation(domainchat.ConversationRoom, viewer, "房间", now)
	if err != nil {
		t.Fatal(err)
	}
	repo := &presenceRepo{conversation: conversation, coMembers: map[domainshared.ID][]domainshared.ID{
		peer: {viewer, other}, viewer: {peer, other}, other: {viewer, peer},
	}}
	users := newFakeUserStore()
	for _, item := range []struct {
		id   domainshared.ID
		name string
	}{{viewer, "viewer"}, {peer, "peer"}, {other, "other"}} {
		member, err := domainchat.NewMember(conversation.ID(), item.id, domainchat.MemberMember, now)
		if err != nil {
			t.Fatal(err)
		}
		repo.members = append(repo.members, member)
		users.users[item.id] = domainuser.NewUser(item.id, mustEmail(t, item.name+"@example.com"), mustUsername(t, item.name), domainuser.NewPasswordHash("x"))
	}
	manager := NewConnectionManager(zerolog.New(io.Discard))
	settings := &memorySettings{hidden: map[domainshared.ID]bool{}}
	notifier := &typingNotifier{}
	svc := NewService(repo, users, nil, notifier, nil, "", func() time.Time { return now }, nil, nil, nil, nil).WithPresence(manager, settings)
	return &presenceFixture{svc: svc, manager: manager, settings: settings, notifier: notifier, room: conversation.ID(), viewer: viewer, peer: peer, other: other}
}

func (f *presenceFixture) online(t *testing.T, viewer domainshared.ID) map[domainshared.ID]bool {
	t.Helper()
	members, err := f.svc.ListMembers(context.Background(), viewer, f.room)
	if err != nil {
		t.Fatal(err)
	}
	out := map[domainshared.ID]bool{}
	for _, member := range members {
		out[domainshared.MustParseID(member.User.ID)] = member.Online
	}
	return out
}

func TestMemberOnlineFollowsChatConnections(t *testing.T) {
	f := newPresenceFixture(t)
	if got := f.online(t, f.viewer); got[f.peer] || got[f.other] {
		t.Fatalf("没有连接时所有成员离线: %+v", got)
	}
	_, cleanup := f.manager.Register(f.peer)
	if got := f.online(t, f.viewer); !got[f.peer] || got[f.other] {
		t.Fatalf("有 SSE 连接的成员在线: %+v", got)
	}
	cleanup()
	if got := f.online(t, f.viewer); got[f.peer] {
		t.Fatalf("连接断开后离线: %+v", got)
	}
}

func TestHiddenMemberLooksOfflineToOthersButNotToSelf(t *testing.T) {
	f := newPresenceFixture(t)
	_, cleanup := f.manager.Register(f.peer)
	defer cleanup()
	if err := f.svc.SetHideOnline(context.Background(), f.peer, true); err != nil {
		t.Fatal(err)
	}
	if got := f.online(t, f.viewer); got[f.peer] {
		t.Fatalf("隐身成员对其他成员显示离线: %+v", got)
	}
	if got := f.online(t, f.peer); !got[f.peer] {
		t.Fatalf("隐身者看自己仍是真实状态: %+v", got)
	}
	if err := f.svc.SetHideOnline(context.Background(), f.peer, false); err != nil {
		t.Fatal(err)
	}
	if got := f.online(t, f.viewer); !got[f.peer] {
		t.Fatalf("取消隐身后恢复在线: %+v", got)
	}
}

func TestPresenceChangePushesEphemeralEventToCoMembers(t *testing.T) {
	f := newPresenceFixture(t)
	f.manager.SetPresenceListener(func(userID domainshared.ID) { f.svc.PresenceChanged(context.Background(), userID) })
	_, cleanup := f.manager.Register(f.peer)
	cleanup()
	if len(f.notifier.pushed) != 4 {
		t.Fatalf("上线与下线各通知 2 位共同成员: %d", len(f.notifier.pushed))
	}
	first, last := f.notifier.pushed[0], f.notifier.pushed[len(f.notifier.pushed)-1]
	if first.event.Type != string(domainchat.EventPresenceUpdated) || first.event.ID != "" || first.event.Data["online"] != true || first.event.Data["user_id"] != f.peer.String() {
		t.Fatalf("上线事件: %+v", first.event)
	}
	if last.event.Data["online"] != false {
		t.Fatalf("下线事件: %+v", last.event)
	}
	for _, push := range f.notifier.pushed {
		if push.userID == f.peer {
			t.Fatal("不能把自己的状态变化推给自己")
		}
	}
}

func TestHiddenUserConnectionActivityPushesNothing(t *testing.T) {
	f := newPresenceFixture(t)
	f.settings.hidden[f.peer] = true
	f.manager.SetPresenceListener(func(userID domainshared.ID) { f.svc.PresenceChanged(context.Background(), userID) })
	_, cleanup := f.manager.Register(f.peer)
	cleanup()
	if len(f.notifier.pushed) != 0 {
		t.Fatalf("隐身用户的上线与下线对外不可见，不得产生事件: %+v", f.notifier.pushed)
	}
}

func TestHideOnlinePushesVisibilityChangeToCoMembers(t *testing.T) {
	f := newPresenceFixture(t)
	_, cleanup := f.manager.Register(f.peer)
	defer cleanup()
	if err := f.svc.SetHideOnline(context.Background(), f.peer, true); err != nil {
		t.Fatal(err)
	}
	if len(f.notifier.pushed) != 2 || f.notifier.pushed[0].event.Data["online"] != false {
		t.Fatalf("隐身后向共同成员推送离线: %+v", f.notifier.pushed)
	}
	f.notifier.pushed = nil
	if err := f.svc.SetHideOnline(context.Background(), f.peer, false); err != nil {
		t.Fatal(err)
	}
	if len(f.notifier.pushed) != 2 || f.notifier.pushed[0].event.Data["online"] != true {
		t.Fatalf("取消隐身后仍在线则推送在线: %+v", f.notifier.pushed)
	}
}
