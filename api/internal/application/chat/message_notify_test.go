package chat

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appshared "blog-api/internal/application/shared"
	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
)

// captureBus 记录 Publish 调用，验证聊天事件进入站内通知通道。
type captureBus struct {
	published []domainshared.DomainEvent
}

func (b *captureBus) Publish(_ context.Context, events []domainshared.DomainEvent) error {
	b.published = append(b.published, events...)
	return nil
}

func (b *captureBus) Subscribe(string, appshared.EventHandler) {}

// messageNotifyRepo 提供 SendMessage/MarkRead 所需的最小仓储行为。
type messageNotifyRepo struct {
	domainchat.ConversationRepository
	conversation *domainchat.Conversation
	members      []*domainchat.Member
	message      *domainchat.Message
}

func (r *messageNotifyRepo) FindByIDForMember(context.Context, domainshared.ID, domainshared.ID) (*domainchat.Conversation, error) {
	return r.conversation, nil
}

func (r *messageNotifyRepo) FindMessageByIdempotency(context.Context, domainshared.ID, domainshared.ID, string) (*domainchat.Message, error) {
	return nil, domainchat.ErrMessageNotFound
}

func (r *messageNotifyRepo) FindMessage(context.Context, domainshared.ID, domainshared.ID) (*domainchat.Message, error) {
	return r.message, nil
}

func (r *messageNotifyRepo) ListMembers(context.Context, domainshared.ID, bool) ([]*domainchat.Member, error) {
	return r.members, nil
}

func (r *messageNotifyRepo) SaveMessage(_ context.Context, message *domainchat.Message, recipientIDs []domainshared.ID, payload map[string]any) ([]domainchat.Event, error) {
	out := make([]domainchat.Event, 0, len(recipientIDs))
	for _, id := range recipientIDs {
		out = append(out, domainchat.Event{UserID: id, Type: domainchat.EventMessageCreated, Payload: payload, CreatedAt: time.Now()})
	}
	return out, nil
}

func (r *messageNotifyRepo) SaveReadPosition(context.Context, *domainchat.ReadPosition) error {
	return nil
}

func (r *messageNotifyRepo) CountUnread(context.Context, domainshared.ID, domainshared.ID) (int64, error) {
	return 0, nil
}

func newMessageNotifyService(bus *captureBus, repo *messageNotifyRepo, users map[domainshared.ID]*domainuser.User) *Service {
	return NewService(repo, &notifyUserRepo{users: users}, nil, nil, nil, "", time.Now, bus, nil, nil, nil)
}

// 新消息只给「活跃、未静音、非发送者」的成员发站内通知事件。
func TestSendMessagePublishesNotificationToUnmutedRecipients(t *testing.T) {
	now := time.Date(2026, 8, 25, 12, 0, 0, 0, time.UTC)
	senderID := domainshared.NewID()
	recipientID := domainshared.NewID()
	mutedID := domainshared.NewID()
	leftID := domainshared.NewID()
	conversationID := domainshared.NewID()

	conversation := domainchat.ReconstructConversation(conversationID, senderID, domainchat.ConversationRoom, "前端夜谈", nil, now, now)
	leftAt := now
	repo := &messageNotifyRepo{
		conversation: conversation,
		members: []*domainchat.Member{
			domainchat.ReconstructMember(conversationID, senderID, domainchat.MemberOwner, now, nil, false),
			domainchat.ReconstructMember(conversationID, recipientID, domainchat.MemberMember, now, nil, false),
			domainchat.ReconstructMember(conversationID, mutedID, domainchat.MemberMember, now, nil, true),
			domainchat.ReconstructMember(conversationID, leftID, domainchat.MemberMember, now, &leftAt, false),
		},
	}
	users := map[domainshared.ID]*domainuser.User{senderID: newReplyUser(senderID, "sender")}
	bus := &captureBus{}
	svc := newMessageNotifyService(bus, repo, users)

	_, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID:         senderID,
		ConversationID: conversationID,
		Type:           domainchat.MessageText,
		Content:        "这个方案可行",
		IdempotencyKey: "k1",
	})
	require.NoError(t, err)

	var received []domainchat.MessageReceived
	for _, e := range bus.published {
		if m, ok := e.(domainchat.MessageReceived); ok {
			received = append(received, m)
		}
	}
	require.Len(t, received, 1)
	assert.Equal(t, recipientID, received[0].RecipientID)
	assert.Equal(t, conversationID, received[0].AggregateID())
	assert.Equal(t, domainchat.ConversationRoom, received[0].Kind)
	assert.Equal(t, "前端夜谈", received[0].ConversationTitle)
	assert.Equal(t, "这个方案可行", received[0].Preview)
	assert.NotEmpty(t, received[0].SenderName)
}

// 会话已读要发布 ConversationRead，让通知 subscriber 同步清掉铃铛未读。
func TestMarkReadPublishesConversationRead(t *testing.T) {
	now := time.Date(2026, 8, 25, 12, 0, 0, 0, time.UTC)
	userID := domainshared.NewID()
	conversationID := domainshared.NewID()
	message, err := domainchat.NewTextMessage(conversationID, userID, "hi", "k2", now, nil)
	require.NoError(t, err)

	repo := &messageNotifyRepo{
		conversation: domainchat.ReconstructConversation(conversationID, userID, domainchat.ConversationDirect, "", nil, now, now),
		message:      message,
	}
	bus := &captureBus{}
	svc := newMessageNotifyService(bus, repo, map[domainshared.ID]*domainuser.User{})

	_, err = svc.MarkRead(context.Background(), userID, conversationID, message.ID())
	require.NoError(t, err)

	require.Len(t, bus.published, 1)
	read, ok := bus.published[0].(domainchat.ConversationRead)
	require.True(t, ok, "expected ConversationRead, got %T", bus.published[0])
	assert.Equal(t, userID, read.ReaderID)
	assert.Equal(t, conversationID, read.AggregateID())
}
