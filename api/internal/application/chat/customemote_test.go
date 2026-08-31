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

// customEmoteChatRepo 最小 ConversationRepository 替身，只覆盖 SendMessage 路径
// 用到的方法（同 reply_test.go 的嵌入式接口写法）。
type customEmoteChatRepo struct {
	domainchat.ConversationRepository
	conversation *domainchat.Conversation
	member       *domainchat.Member
	saved        *domainchat.Message
	event        *domainchat.Event
	eventMessage *domainchat.Message
}

func (r *customEmoteChatRepo) FindByIDForMember(context.Context, domainshared.ID, domainshared.ID) (*domainchat.Conversation, error) {
	return r.conversation, nil
}
func (r *customEmoteChatRepo) ListMemberReadStates(context.Context, domainshared.ID) ([]domainchat.MemberReadState, error) {
	return nil, nil
}

func (r *customEmoteChatRepo) FindMessageByIdempotency(context.Context, domainshared.ID, domainshared.ID, string) (*domainchat.Message, error) {
	return nil, domainchat.ErrMessageNotFound
}
func (r *customEmoteChatRepo) FindMessage(_ context.Context, _ domainshared.ID, messageID domainshared.ID) (*domainchat.Message, error) {
	if r.eventMessage != nil && r.eventMessage.ID().Equal(messageID) {
		return r.eventMessage, nil
	}
	return nil, domainchat.ErrMessageNotFound
}

func (r *customEmoteChatRepo) FindEventsAfter(context.Context, domainshared.ID, int64, int) ([]domainchat.Event, error) {
	if r.event == nil {
		return nil, nil
	}
	return []domainchat.Event{*r.event}, nil
}

func (r *customEmoteChatRepo) ListMembers(context.Context, domainshared.ID, bool) ([]*domainchat.Member, error) {
	return []*domainchat.Member{r.member}, nil
}

func (r *customEmoteChatRepo) SaveMessage(_ context.Context, message *domainchat.Message, _ []domainshared.ID, _ map[string]any) ([]domainchat.Event, error) {
	r.saved = message
	return nil, nil
}

// fakeCustomEmojiResolver CustomEmojiResolver 替身：按 id 查表返回预设 ref，未命中静默跳过。
type fakeCustomEmojiResolver struct {
	refs map[domainshared.ID]CustomEmojiRefDTO
}

func (f *fakeCustomEmojiResolver) ResolveByIDs(_ context.Context, ids []domainshared.ID, _ domainshared.ID) (map[domainshared.ID]CustomEmojiRefDTO, error) {
	out := make(map[domainshared.ID]CustomEmojiRefDTO)
	for _, id := range ids {
		if ref, ok := f.refs[id]; ok {
			out[id] = ref
		}
	}
	return out, nil
}
func (f *fakeCustomEmojiResolver) ValidateContent(context.Context, string, domainshared.ID) error {
	return nil
}

func newCustomEmoteService(t *testing.T, userID, conversationID domainshared.ID, now time.Time, resolver CustomEmojiResolver) (*Service, *customEmoteChatRepo) {
	t.Helper()
	conversation := domainchat.ReconstructConversation(conversationID, userID, domainchat.ConversationDirect, "", nil, now, now)
	member, err := domainchat.NewMember(conversationID, userID, domainchat.MemberOwner, now)
	require.NoError(t, err)
	repo := &customEmoteChatRepo{conversation: conversation, member: member}
	users := &replyUserRepo{users: map[domainshared.ID]*domainuser.User{userID: newReplyUser(userID, "alice")}}
	svc := NewService(repo, users, nil, nil, nil, "", func() time.Time { return now }, nil, nil, nil, resolver)
	return svc, repo
}

// TestSendMessage_ResolvesCustomEmoteToken 覆盖 issue-255 验收：正文含 [name:uuid]
// 自定义表情 token 时，SendMessage 返回的 MessageDTO.CustomEmote 填充解析结果。
func TestSendMessage_ResolvesCustomEmoteToken(t *testing.T) {
	userID := domainshared.NewID()
	conversationID := domainshared.NewID()
	emojiID := domainshared.NewID()
	now := time.Date(2026, 8, 24, 10, 0, 0, 0, time.UTC)
	resolver := &fakeCustomEmojiResolver{refs: map[domainshared.ID]CustomEmojiRefDTO{
		emojiID: {URL: "/uploads/emoji/mycat.png", Relation: "owned"},
	}}
	svc, _ := newCustomEmoteService(t, userID, conversationID, now, resolver)
	token := "[mycat:" + emojiID.String() + "]"

	dto, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID: userID, ConversationID: conversationID, Type: domainchat.MessageText,
		Content: "你好 " + token, IdempotencyKey: "msg-1",
	})

	require.NoError(t, err)
	require.Contains(t, dto.CustomEmote, token)
	assert.Equal(t, "/uploads/emoji/mycat.png", dto.CustomEmote[token].URL)
	assert.Equal(t, emojiID.String(), dto.CustomEmote[token].CustomEmojiID)
	assert.Equal(t, "owned", dto.CustomEmote[token].Relation)
}

// TestSendMessage_SystemEmojiOnly_NoCustomEmote 零回归：正文只含系统表情 [name]
// （无冒号后缀 UUID）时不触发自定义表情解析，CustomEmote 为空。
func TestSendMessage_SystemEmojiOnly_NoCustomEmote(t *testing.T) {
	userID := domainshared.NewID()
	conversationID := domainshared.NewID()
	now := time.Date(2026, 8, 24, 10, 0, 0, 0, time.UTC)
	resolver := &fakeCustomEmojiResolver{refs: map[domainshared.ID]CustomEmojiRefDTO{}}
	svc, _ := newCustomEmoteService(t, userID, conversationID, now, resolver)

	dto, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID: userID, ConversationID: conversationID, Type: domainchat.MessageText,
		Content: "你好 [doge]", IdempotencyKey: "msg-2",
	})

	require.NoError(t, err)
	assert.Empty(t, dto.CustomEmote)
}

// TestSendMessage_UnresolvedCustomEmojiID_TokenOmitted ID 不存在/已下架时该 token
// 不出现在 CustomEmote 中（前端按占位文本兜底，见 domain/customemoji 的 ResolveByIDs 语义）。
func TestSendMessage_UnresolvedCustomEmojiID_TokenOmitted(t *testing.T) {
	userID := domainshared.NewID()
	conversationID := domainshared.NewID()
	now := time.Date(2026, 8, 24, 10, 0, 0, 0, time.UTC)
	resolver := &fakeCustomEmojiResolver{refs: map[domainshared.ID]CustomEmojiRefDTO{}}
	svc, _ := newCustomEmoteService(t, userID, conversationID, now, resolver)
	token := "[mycat:" + domainshared.NewID().String() + "]"

	dto, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID: userID, ConversationID: conversationID, Type: domainchat.MessageText,
		Content: "你好 " + token, IdempotencyKey: "msg-3",
	})

	require.NoError(t, err)
	assert.NotContains(t, dto.CustomEmote, token)
}
func TestEventsAfter_ResolvesCustomEmoteForRecipient(t *testing.T) {
	userID := domainshared.NewID()
	conversationID := domainshared.NewID()
	emojiID := domainshared.NewID()
	now := time.Date(2026, 8, 24, 10, 0, 0, 0, time.UTC)
	message, err := domainchat.NewTextMessage(
		conversationID,
		domainshared.NewID(),
		"[mycat:"+emojiID.String()+"]",
		"msg-event",
		now,
		nil,
	)
	require.NoError(t, err)
	event := domainchat.Event{
		Sequence: 7,
		UserID:   userID,
		Type:     domainchat.EventMessageCreated,
		Payload: map[string]any{
			"conversation_id": conversationID.String(),
			"message_id":      message.ID().String(),
		},
		CreatedAt: now,
	}
	resolver := &fakeCustomEmojiResolver{refs: map[domainshared.ID]CustomEmojiRefDTO{
		emojiID: {URL: "/uploads/emoji/mycat.png", Relation: "none"},
	}}
	svc, repo := newCustomEmoteService(t, userID, conversationID, now, resolver)
	repo.event = &event
	repo.eventMessage = message

	events, err := svc.EventsAfter(context.Background(), userID, 0, 10)

	require.NoError(t, err)
	require.Len(t, events, 1)
	assert.Equal(t, "/uploads/emoji/mycat.png", events[0].CustomEmote["[mycat:"+emojiID.String()+"]"].URL)
	assert.Equal(t, emojiID.String(), events[0].CustomEmote["[mycat:"+emojiID.String()+"]"].CustomEmojiID)
	assert.Equal(t, "none", events[0].CustomEmote["[mycat:"+emojiID.String()+"]"].Relation)
}
