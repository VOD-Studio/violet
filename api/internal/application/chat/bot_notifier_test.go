package chat

import (
	"context"
	"testing"
	"time"

	"github.com/rs/zerolog"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
)

func TestBotConnectionManagerRegisterPushCleanup(t *testing.T) {
	manager := NewBotConnectionManager(zerolog.Nop())
	botID, otherID := domainshared.NewID(), domainshared.NewID()

	first, cleanupFirst := manager.Register(botID)
	second, cleanupSecond := manager.Register(botID)
	other, cleanupOther := manager.Register(otherID)
	t.Cleanup(func() { cleanupFirst(); cleanupSecond(); cleanupOther() })

	event := NewBotEvent(domainchat.EventMessageCreated, map[string]any{"message": "hi"}, time.Now())
	manager.Push(botID, event)

	for _, received := range []struct {
		name string
		ch   <-chan EventDTO
	}{{"first", first}, {"second", second}} {
		select {
		case got := <-received.ch:
			if got.Type != string(domainchat.EventMessageCreated) {
				t.Fatalf("%s 收到错误事件类型: %s", received.name, got.Type)
			}
		default:
			t.Fatalf("%s 未收到推送", received.name)
		}
	}
	select {
	case <-other:
		t.Fatal("别的 bot 不该收到这个事件")
	default:
	}

	cleanupFirst()
	select {
	case _, open := <-first:
		if open {
			t.Fatal("清理后不该还能读到事件")
		}
	default:
		t.Fatal("清理后通道应关闭")
	}

	manager.Push(botID, event)
	select {
	case <-second:
	default:
		t.Fatal("同 bot 的其余连接仍应收到")
	}
}

func TestBotConnectionManagerDropsWhenBufferFull(t *testing.T) {
	manager := NewBotConnectionManager(zerolog.Nop())
	botID := domainshared.NewID()
	ch, cleanup := manager.Register(botID)
	defer cleanup()

	for i := 0; i < 200; i++ { // 远超 32 的缓冲：慢消费者必须被丢弃而不是写阻塞。
		manager.Push(botID, NewBotEvent(domainchat.EventMessageCreated, nil, time.Now()))
	}
	select {
	case <-ch:
	default:
		t.Fatal("至少应留下缓冲内的事件")
	}
}

// --- 分发规则 ---

type dispatchMember struct {
	userID domainshared.ID
	active bool
}

// notifierChatRepo 只提供分发器要用的 FindByIDForMember / ListMembers。
type notifierChatRepo struct {
	domainchat.ConversationRepository
	conversation *domainchat.Conversation
	members      []*domainchat.Member
	membersErr   error
}

func (r *notifierChatRepo) ListMembers(context.Context, domainshared.ID, bool) ([]*domainchat.Member, error) {
	return r.members, r.membersErr
}

func newDispatcher(t *testing.T, kind domainchat.ConversationKind, members []dispatchMember, bots map[domainshared.ID]*domainchat.Bot) (*BotEventDispatcher, *domainchat.Conversation) {
	t.Helper()
	now := time.Date(2026, 9, 22, 10, 0, 0, 0, time.UTC)
	owner := domainshared.NewID()
	conversation, err := domainchat.NewConversation(kind, owner, "会话", now)
	if err != nil {
		t.Fatal(err)
	}
	repo := &notifierChatRepo{conversation: conversation}
	for _, member := range members {
		item, err := domainchat.NewMember(conversation.ID(), member.userID, domainchat.MemberMember, now)
		if err != nil {
			t.Fatal(err)
		}
		if !member.active {
			item.Leave(now)
		}
		repo.members = append(repo.members, item)
	}
	botRepo := newFakeBotRepo()
	botRepo.bots = bots
	manager := &BotConnectionManager{conns: map[domainshared.ID][]chan EventDTO{}, log: zerolog.Nop()}
	return NewBotEventDispatcher(repo, botRepo, manager, zerolog.Nop()), conversation
}

// dispatchRecorder 把分发器的目标读取替换成记录器：分发器只经 manager.Push 出口，
// 这里直接断言「哪些 bot 被判定为接收者」，不为测试引入额外端口。
func dispatchedBotIDs(t *testing.T, dispatcher *BotEventDispatcher, conversation *domainchat.Conversation, senderID domainshared.ID, mentioned []domainshared.ID) []domainshared.ID {
	t.Helper()
	ids, err := dispatcher.recipientIDs(context.Background(), conversation, senderID, mentioned)
	if err != nil {
		t.Fatal(err)
	}
	return ids
}

func newTestBotForUser(t *testing.T, userID domainshared.ID, name string, enabled bool) *domainchat.Bot {
	t.Helper()
	now := time.Now()
	bot, _, err := domainchat.NewBot(domainshared.NewID(), userID, name, nil, now)
	if err != nil {
		t.Fatal(err)
	}
	if !enabled {
		bot.Disable(now)
	}
	return bot
}

func TestDispatchDirectConversationTargetsBot(t *testing.T) {
	botUser, human := domainshared.NewID(), domainshared.NewID()
	bot := newTestBotForUser(t, botUser, "Saber", true)
	dispatcher, conversation := newDispatcher(t, domainchat.ConversationDirect,
		[]dispatchMember{{userID: human, active: true}, {userID: botUser, active: true}},
		map[domainshared.ID]*domainchat.Bot{bot.ID(): bot})

	got := dispatchedBotIDs(t, dispatcher, conversation, human, nil)
	if len(got) != 1 || got[0] != bot.ID() {
		t.Fatalf("私聊人类消息应投给 bot，实得 %v", got)
	}
}

func TestDispatchIgnoresBotSendersAndDisabledBots(t *testing.T) {
	botUser, human := domainshared.NewID(), domainshared.NewID()
	bot := newTestBotForUser(t, botUser, "Saber", true)
	dispatcher, conversation := newDispatcher(t, domainchat.ConversationDirect,
		[]dispatchMember{{userID: human, active: true}, {userID: botUser, active: true}},
		map[domainshared.ID]*domainchat.Bot{bot.ID(): bot})

	if got := dispatchedBotIDs(t, dispatcher, conversation, botUser, nil); len(got) != 0 {
		t.Fatalf("bot 自己发的消息不得回投: %v", got)
	}

	bot.Disable(time.Now())
	if got := dispatchedBotIDs(t, dispatcher, conversation, human, []domainshared.ID{botUser}); len(got) != 0 {
		t.Fatalf("禁用的 bot 不该被唤醒: %v", got)
	}
}

func TestDispatchRoomOnlyMentions(t *testing.T) {
	mentionedUser, ignoredUser, human := domainshared.NewID(), domainshared.NewID(), domainshared.NewID()
	mentionedBot := newTestBotForUser(t, mentionedUser, "Mentioned", true)
	ignoredBot := newTestBotForUser(t, ignoredUser, "Ignored", true)
	bots := map[domainshared.ID]*domainchat.Bot{mentionedBot.ID(): mentionedBot, ignoredBot.ID(): ignoredBot}
	members := []dispatchMember{
		{userID: human, active: true},
		{userID: mentionedUser, active: true},
		{userID: ignoredUser, active: true},
	}

	dispatcher, conversation := newDispatcher(t, domainchat.ConversationRoom, members, bots)
	if got := dispatchedBotIDs(t, dispatcher, conversation, human, nil); len(got) != 0 {
		t.Fatalf("群聊未 @ 任何 bot 时不该投递: %v", got)
	}
	got := dispatchedBotIDs(t, dispatcher, conversation, human, []domainshared.ID{mentionedUser})
	if len(got) != 1 || got[0] != mentionedBot.ID() {
		t.Fatalf("群聊只投被 @ 的 bot: %v", got)
	}

	// 已离开的成员即使是 bot 也不该收事件。
	dispatcherLeft, leftConversation := newDispatcher(t, domainchat.ConversationRoom,
		[]dispatchMember{{userID: human, active: true}, {userID: mentionedUser, active: false}}, bots)
	if got := dispatchedBotIDs(t, dispatcherLeft, leftConversation, human, []domainshared.ID{mentionedUser}); len(got) != 0 {
		t.Fatalf("已退出的 bot 成员不应收到事件: %v", got)
	}
}

// --- Service 侧接线 ---

type captureBotNotifier struct {
	calls []botDispatchCall
}

type botDispatchCall struct {
	conversationID domainshared.ID
	senderID       domainshared.ID
	mentioned      []domainshared.ID
	event          EventDTO
}

func (n *captureBotNotifier) Dispatch(_ context.Context, conversation *domainchat.Conversation, senderID domainshared.ID, mentioned []domainshared.ID, event EventDTO) {
	n.calls = append(n.calls, botDispatchCall{conversationID: conversation.ID(), senderID: senderID, mentioned: mentioned, event: event})
}

func TestDispatchBotMessageCarriesMessageSnapshot(t *testing.T) {
	now := time.Date(2026, 9, 22, 10, 0, 0, 0, time.UTC)
	botUser, human := domainshared.NewID(), domainshared.NewID()
	conversation, err := domainchat.NewConversation(domainchat.ConversationDirect, human, "会话", now)
	if err != nil {
		t.Fatal(err)
	}
	message, err := domainchat.NewTextMessage(conversation.ID(), human, "你好", "k-1", now, nil)
	if err != nil {
		t.Fatal(err)
	}
	users := newFakeUserStore()
	email, err := domainuser.ParseEmail("human@example.com")
	if err != nil {
		t.Fatal(err)
	}
	username, err := domainuser.ParseUsername("human")
	if err != nil {
		t.Fatal(err)
	}
	users.users[human] = domainuser.NewUser(human, email, username, domainuser.NewPasswordHash("x"))

	notifier := &captureBotNotifier{}
	svc := NewService(nil, users, nil, nil, nil, "", func() time.Time { return now }, nil, nil, nil, nil).WithBotNotifier(notifier)
	svc.dispatchBotMessage(context.Background(), conversation, message, []domainshared.ID{botUser})

	if len(notifier.calls) != 1 {
		t.Fatalf("应投递一次，实得 %d", len(notifier.calls))
	}
	call := notifier.calls[0]
	if call.event.Type != string(domainchat.EventMessageCreated) {
		t.Fatalf("事件类型 = %s", call.event.Type)
	}
	if call.event.ID != "" {
		t.Fatal("bot 事件不得带持久化序号：它不参与 Last-Event-ID 补发")
	}
	snapshot, ok := call.event.Data["message"].(MessageDTO)
	if !ok || snapshot.Content != "你好" || snapshot.ConversationID != conversation.ID().String() {
		t.Fatalf("事件需自带消息正文: %+v", call.event.Data["message"])
	}
	if len(call.mentioned) != 1 || call.mentioned[0] != botUser {
		t.Fatalf("mention 需透传给分发器: %v", call.mentioned)
	}
}

func TestServiceWithoutBotNotifierDoesNotDispatch(t *testing.T) {
	svc := NewService(nil, nil, nil, nil, nil, "", nil, nil, nil, nil, nil)
	if svc.bots != nil {
		t.Fatal("未注入分发器时字段必须为空")
	}
}
