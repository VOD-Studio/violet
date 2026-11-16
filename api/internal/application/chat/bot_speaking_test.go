package chat

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
)

type speakingRepo struct {
	domainchat.ConversationRepository
	conversation *domainchat.Conversation
	members      []*domainchat.Member
}

func (r *speakingRepo) FindByIDForMember(context.Context, domainshared.ID, domainshared.ID) (*domainchat.Conversation, error) {
	return r.conversation, nil
}

func (r *speakingRepo) ListMembers(context.Context, domainshared.ID, bool) ([]*domainchat.Member, error) {
	return r.members, nil
}

func (r *speakingRepo) FindMember(_ context.Context, _, userID domainshared.ID) (*domainchat.Member, error) {
	for _, member := range r.members {
		if member.UserID().Equal(userID) {
			return member, nil
		}
	}
	return nil, domainchat.ErrMemberNotFound
}

func (r *speakingRepo) SetMemberSilenced(_ context.Context, _, userID domainshared.ID, silenced bool) error {
	for _, member := range r.members {
		if member.UserID().Equal(userID) {
			member.SetSilenced(silenced)
		}
	}
	return nil
}

func newSpeakingFixture(t *testing.T) (svc *Service, owner, guest, bot, room domainshared.ID) {
	t.Helper()
	now := time.Date(2026, 11, 14, 10, 0, 0, 0, time.UTC)
	owner, guest, bot = domainshared.NewID(), domainshared.NewID(), domainshared.NewID()
	conversation, err := domainchat.NewConversation(domainchat.ConversationRoom, owner, "房间", now)
	require.NoError(t, err)
	repo := &speakingRepo{conversation: conversation}
	for id, role := range map[domainshared.ID]domainchat.MemberRole{owner: domainchat.MemberOwner, guest: domainchat.MemberMember, bot: domainchat.MemberMember} {
		member, err := domainchat.NewMember(conversation.ID(), id, role, now)
		require.NoError(t, err)
		repo.members = append(repo.members, member)
	}
	users := newFakeUserStore()
	users.users[owner] = newReplyUser(owner, "owner")
	users.users[guest] = newReplyUser(guest, "guest")
	botEmail, err := domainuser.ParseEmail("bot+" + bot.String() + "@" + domainuser.BotUserEmailDomain)
	require.NoError(t, err)
	botName, err := domainuser.ParseUsername("rua")
	require.NoError(t, err)
	users.users[bot] = domainuser.NewUser(bot, botEmail, botName, domainuser.PasswordHash{})
	svc = NewService(repo, users, nil, nil, nil, "", func() time.Time { return now }, nil, nil, nil, nil)
	return svc, owner, guest, bot, conversation.ID()
}

func canSpeak(t *testing.T, svc *Service, viewer, room, user domainshared.ID) bool {
	t.Helper()
	members, err := svc.ListMembers(context.Background(), viewer, room)
	require.NoError(t, err)
	for _, member := range members {
		if member.User.ID == user.String() {
			return member.CanSpeak
		}
	}
	t.Fatalf("成员 %s 不在列表中", user)
	return false
}

func TestRoomOwnerSilencesAndRestoresBot(t *testing.T) {
	svc, owner, _, bot, room := newSpeakingFixture(t)
	assert.True(t, canSpeak(t, svc, owner, room, bot), "默认允许发言")

	require.NoError(t, svc.SetBotSilenced(context.Background(), owner, room, bot, true))
	assert.False(t, canSpeak(t, svc, owner, room, bot))

	require.NoError(t, svc.SetBotSilenced(context.Background(), owner, room, bot, false))
	assert.True(t, canSpeak(t, svc, owner, room, bot))
}

func TestOnlyRoomOwnerCanSilenceAndOnlyBots(t *testing.T) {
	svc, owner, guest, bot, room := newSpeakingFixture(t)
	assert.Error(t, svc.SetBotSilenced(context.Background(), guest, room, bot, true), "非房主不能禁言角色")
	assert.True(t, canSpeak(t, svc, owner, room, bot))
	assert.Error(t, svc.SetBotSilenced(context.Background(), owner, room, guest, true), "真人成员不能被禁言")
}

func TestSilencedBotCannotSendMessagesInThatConversation(t *testing.T) {
	userID, conversationID := domainshared.NewID(), domainshared.NewID()
	svc, repo := newShareService(t, nil, userID, domainshared.NewID(), conversationID)
	repo.member.SetSilenced(true)

	_, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID: userID, ConversationID: conversationID, Type: domainchat.MessageText,
		Content: "我还想说话", IdempotencyKey: "silenced-1",
	})
	require.Error(t, err)
	assert.Nil(t, repo.saved, "被禁言时消息不得落库")
}

func TestDispatcherSkipsSilencedBotMembers(t *testing.T) {
	botUser := domainshared.NewID()
	bot := newTestBotForUser(t, botUser, "Rua", true)
	dispatcher, conversation := newDispatcher(t, domainchat.ConversationDirect, []dispatchMember{{userID: botUser, active: true}}, map[domainshared.ID]*domainchat.Bot{bot.ID(): bot})
	assert.Len(t, dispatchedBotIDs(t, dispatcher, conversation, domainshared.NewID(), nil), 1)

	repo := dispatcher.repo.(*notifierChatRepo)
	repo.members[0].SetSilenced(true)
	assert.Empty(t, dispatchedBotIDs(t, dispatcher, conversation, domainshared.NewID(), nil), "被禁言的角色不再收到该会话的事件")
}
