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

// mentionChatRepo 最小 ConversationRepository 替身，覆盖 SendMessage + notifyEvents
// 路径（同 reply_test.go / customemote_test.go 的嵌入式接口写法）。
type mentionChatRepo struct {
	domainchat.ConversationRepository
	conversation *domainchat.Conversation
	members      map[domainshared.ID]*domainchat.Member
	subs         map[domainshared.ID][]*domainchat.PushSubscription
	events       []domainchat.Event
	savedPayload map[string]any
}

func (r *mentionChatRepo) FindByIDForMember(context.Context, domainshared.ID, domainshared.ID) (*domainchat.Conversation, error) {
	return r.conversation, nil
}

func (r *mentionChatRepo) ListMemberReadStates(context.Context, domainshared.ID) ([]domainchat.MemberReadState, error) {
	return nil, nil
}

func (r *mentionChatRepo) FindMessageByIdempotency(context.Context, domainshared.ID, domainshared.ID, string) (*domainchat.Message, error) {
	return nil, domainchat.ErrMessageNotFound
}

func (r *mentionChatRepo) FindMember(_ context.Context, _ domainshared.ID, userID domainshared.ID) (*domainchat.Member, error) {
	member, ok := r.members[userID]
	if !ok {
		return nil, domainchat.ErrMemberNotFound
	}
	return member, nil
}

func (r *mentionChatRepo) ListMembers(context.Context, domainshared.ID, bool) ([]*domainchat.Member, error) {
	out := make([]*domainchat.Member, 0, len(r.members))
	for _, member := range r.members {
		out = append(out, member)
	}
	return out, nil
}

func (r *mentionChatRepo) SaveMessage(_ context.Context, _ *domainchat.Message, _ []domainshared.ID, payload map[string]any) ([]domainchat.Event, error) {
	r.savedPayload = payload
	return r.events, nil
}

func (r *mentionChatRepo) ListPushSubscriptions(_ context.Context, userID domainshared.ID) ([]*domainchat.PushSubscription, error) {
	return r.subs[userID], nil
}

func (r *mentionChatRepo) DeletePushSubscription(context.Context, domainshared.ID, string) error {
	return nil
}

// mentionUserRepo UserRepository 替身：提供 resolveMentions 需要的批量查询。
type mentionUserRepo struct {
	UserRepository
	users map[domainshared.ID]*domainuser.User
}

func (r *mentionUserRepo) FindByID(_ context.Context, id domainshared.ID) (*domainuser.User, error) {
	return r.users[id], nil
}

func (r *mentionUserRepo) FindByIDs(_ context.Context, ids []domainshared.ID) ([]*domainuser.User, error) {
	out := make([]*domainuser.User, 0, len(ids))
	for _, id := range ids {
		if user, ok := r.users[id]; ok {
			out = append(out, user)
		}
	}
	return out, nil
}

// capturePushSender 记录每次 Web Push 调用的目标订阅与载荷。
type capturePushSender struct {
	sent []capturedPush
}

type capturedPush struct {
	userID  domainshared.ID
	payload PushPayload
}

func (p *capturePushSender) Send(_ context.Context, subscription *domainchat.PushSubscription, payload PushPayload) error {
	p.sent = append(p.sent, capturedPush{userID: subscription.UserID, payload: payload})
	return nil
}

func mentionToken(username string, id domainshared.ID) string {
	return "@(" + username + ":" + id.String() + ")"
}

func TestParseMentionTokens(t *testing.T) {
	first := domainshared.NewID()
	second := domainshared.NewID()
	token := mentionToken("luai", first)

	t.Run("同一用户多次提及归并为一个 ID、保留全部 token", func(t *testing.T) {
		ids, tokens := parseMentionTokens(token + " 和 " + token + " 还有 " + mentionToken("bob", second))

		require.Equal(t, []domainshared.ID{first, second}, ids)
		assert.Equal(t, []string{token, token}, tokens[first])
	})

	t.Run("非法 uuid 段不产生提及", func(t *testing.T) {
		ids, tokens := parseMentionTokens("@(luai:not-a-uuid) @(luai:0b8e6c62-9a1c-4a3b-9f1e-2c7a5d0e1f2) 你好")

		assert.Nil(t, ids)
		assert.Nil(t, tokens)
	})

	t.Run("humanize 还原为 @username", func(t *testing.T) {
		assert.Equal(t, "@luai 看下这个", humanizeMentionTokens(token+" 看下这个"))
	})
}

func newMentionService(t *testing.T, now time.Time, repo *mentionChatRepo, users map[domainshared.ID]*domainuser.User, push PushSender) *Service {
	t.Helper()
	return NewService(repo, &mentionUserRepo{users: users}, nil, nil, push, "", func() time.Time { return now }, nil, nil, nil, nil)
}

// 提及非会话成员必须在落库前被拒：正文不能当成向任意用户投递通知的通道。
func TestSendMessage_MentionOutsideConversation_Rejected(t *testing.T) {
	now := time.Date(2026, 9, 14, 10, 0, 0, 0, time.UTC)
	conversationID := domainshared.NewID()
	senderID := domainshared.NewID()
	outsiderID := domainshared.NewID()
	sender, err := domainchat.NewMember(conversationID, senderID, domainchat.MemberOwner, now)
	require.NoError(t, err)
	repo := &mentionChatRepo{
		conversation: domainchat.ReconstructConversation(conversationID, senderID, domainchat.ConversationDirect, "", nil, now, now),
		members:      map[domainshared.ID]*domainchat.Member{senderID: sender},
	}
	svc := newMentionService(t, now, repo, map[domainshared.ID]*domainuser.User{
		senderID:   newReplyUser(senderID, "alice"),
		outsiderID: newReplyUser(outsiderID, "outsider"),
	}, nil)

	_, err = svc.SendMessage(context.Background(), SendMessageInput{
		UserID: senderID, ConversationID: conversationID, Type: domainchat.MessageText,
		Content: mentionToken("outsider", outsiderID) + " 来看看", IdempotencyKey: "msg-1",
	})

	require.Error(t, err)
	assert.True(t, domainshared.IsDomainError(err, domainshared.CodeBadRequest))
	assert.Nil(t, repo.savedPayload, "校验失败的消息不应落库")
}

// 提及会话成员时返回的 DTO 以完整 token 为 key 携带该成员资料。
func TestSendMessage_MentionMember_ResolvedInDTO(t *testing.T) {
	now := time.Date(2026, 9, 14, 10, 0, 0, 0, time.UTC)
	conversationID := domainshared.NewID()
	senderID := domainshared.NewID()
	targetID := domainshared.NewID()
	sender, err := domainchat.NewMember(conversationID, senderID, domainchat.MemberOwner, now)
	require.NoError(t, err)
	target, err := domainchat.NewMember(conversationID, targetID, domainchat.MemberMember, now)
	require.NoError(t, err)
	repo := &mentionChatRepo{
		conversation: domainchat.ReconstructConversation(conversationID, senderID, domainchat.ConversationDirect, "", nil, now, now),
		members:      map[domainshared.ID]*domainchat.Member{senderID: sender, targetID: target},
	}
	svc := newMentionService(t, now, repo, map[domainshared.ID]*domainuser.User{
		senderID: newReplyUser(senderID, "alice"),
		targetID: newReplyUser(targetID, "luai"),
	}, nil)
	token := mentionToken("luai", targetID)

	dto, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID: senderID, ConversationID: conversationID, Type: domainchat.MessageText,
		Content: token + " 看下这个", IdempotencyKey: "msg-1",
	})

	require.NoError(t, err)
	require.Contains(t, dto.Mentions, token)
	assert.Equal(t, targetID.String(), dto.Mentions[token].ID)
	assert.Equal(t, "luai", dto.Mentions[token].Username)
	assert.Equal(t, "@luai 看下这个", repo.savedPayload["preview"], "推送预览应还原为可读的 @username")
}

// 静音只压制日常消息：被提及的静音成员仍要收到专属文案的 Web Push，
// 同一会话里未被提及的静音成员则保持静音。
func TestNotifyEvents_MentionBypassesMute(t *testing.T) {
	now := time.Date(2026, 9, 14, 10, 0, 0, 0, time.UTC)
	conversationID := domainshared.NewID()
	senderID := domainshared.NewID()
	mentionedID := domainshared.NewID()
	bystanderID := domainshared.NewID()
	repo := &mentionChatRepo{
		members: map[domainshared.ID]*domainchat.Member{
			mentionedID: domainchat.ReconstructMember(conversationID, mentionedID, domainchat.MemberMember, now, nil, true),
			bystanderID: domainchat.ReconstructMember(conversationID, bystanderID, domainchat.MemberMember, now, nil, true),
		},
		subs: map[domainshared.ID][]*domainchat.PushSubscription{
			mentionedID: {{UserID: mentionedID, Endpoint: "https://push.example/mentioned"}},
			bystanderID: {{UserID: bystanderID, Endpoint: "https://push.example/bystander"}},
		},
	}
	push := &capturePushSender{}
	svc := newMentionService(t, now, repo, nil, push)
	payload := map[string]any{
		"conversation_id": conversationID.String(),
		"sender_id":       senderID.String(),
		"preview":         "@luai 看下这个",
		"mentions":        []any{mentionedID.String()},
	}
	events := []domainchat.Event{
		{Sequence: 1, UserID: mentionedID, Type: domainchat.EventMessageCreated, Payload: payload, CreatedAt: now},
		{Sequence: 2, UserID: bystanderID, Type: domainchat.EventMessageCreated, Payload: payload, CreatedAt: now},
	}

	svc.notifyEvents(context.Background(), events)

	require.Len(t, push.sent, 1)
	assert.Equal(t, mentionedID, push.sent[0].userID)
	assert.Equal(t, "violet-chat-mention", push.sent[0].payload.Tag)
	assert.Equal(t, "有人提到了你", push.sent[0].payload.Title)
	assert.Equal(t, "在聊天中提到了你", push.sent[0].payload.Body, "订阅未开启预览时不泄露正文")
}
