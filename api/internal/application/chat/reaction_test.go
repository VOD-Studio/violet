package chat

import (
	"context"
	"testing"
	"time"

	domainchat "blog-api/internal/domain/chat"
	domainchatreaction "blog-api/internal/domain/chatreaction"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
)

type reactionStoreStub struct {
	byMessage map[string][]domainchatreaction.AggregatedReaction
	added     []struct {
		messageID domainshared.ID
		userID    domainshared.ID
		emojiID   int32
	}
}

func (s *reactionStoreStub) ListByMessages(_ context.Context, messageIDs []domainshared.ID, _ domainshared.ID) (map[string][]domainchatreaction.AggregatedReaction, error) {
	result := make(map[string][]domainchatreaction.AggregatedReaction, len(messageIDs))
	for _, messageID := range messageIDs {
		result[messageID.String()] = s.byMessage[messageID.String()]
	}
	return result, nil
}

func (s *reactionStoreStub) Add(_ context.Context, messageID, userID domainshared.ID, emojiID int32) error {
	s.added = append(s.added, struct {
		messageID domainshared.ID
		userID    domainshared.ID
		emojiID   int32
	}{messageID: messageID, userID: userID, emojiID: emojiID})
	return nil
}

func (s *reactionStoreStub) Remove(context.Context, domainshared.ID, domainshared.ID, int32) error {
	return nil
}

func (s *reactionStoreStub) RemoveByMessage(context.Context, domainshared.ID) error {
	return nil
}

type reactionChatRepo struct {
	domainchat.ConversationRepository
	conversation *domainchat.Conversation

	message   *domainchat.Message
	messages  []*domainchat.Message
	member    *domainchat.Member
	eventType domainchat.ChatEventType
}

func (r *reactionChatRepo) FindByIDForMember(context.Context, domainshared.ID, domainshared.ID) (*domainchat.Conversation, error) {
	return r.conversation, nil
}

func (r *reactionChatRepo) FindMessage(_ context.Context, conversationID, messageID domainshared.ID) (*domainchat.Message, error) {
	if r.message != nil && r.message.ConversationID().Equal(conversationID) && r.message.ID().Equal(messageID) {
		return r.message, nil
	}
	return nil, domainchat.ErrMessageNotFound
}

func (r *reactionChatRepo) ListMembers(context.Context, domainshared.ID, bool) ([]*domainchat.Member, error) {
	return []*domainchat.Member{r.member}, nil
}

func (r *reactionChatRepo) ListMessages(context.Context, domainshared.ID, *domainchat.MessageCursor, int) ([]*domainchat.Message, error) {
	if r.messages != nil {
		return r.messages, nil
	}
	if r.message == nil {
		return nil, nil
	}
	return []*domainchat.Message{r.message}, nil
}

func (r *reactionChatRepo) SaveEvent(_ context.Context, userIDs []domainshared.ID, eventType domainchat.ChatEventType, payload map[string]any) ([]domainchat.Event, error) {
	r.eventType = eventType
	events := make([]domainchat.Event, 0, len(userIDs))
	for index, userID := range userIDs {
		events = append(events, domainchat.Event{Sequence: int64(index + 1), UserID: userID, Type: eventType, Payload: payload, CreatedAt: time.Now()})
	}
	return events, nil
}

type reactionUserRepo struct {
	UserRepository
	user *domainuser.User
}

func (r *reactionUserRepo) FindByID(context.Context, domainshared.ID) (*domainuser.User, error) {
	return r.user, nil
}

func (r *reactionUserRepo) FindByIDs(context.Context, []domainshared.ID) ([]*domainuser.User, error) {
	return []*domainuser.User{r.user}, nil
}

func newReactionService(t *testing.T, message *domainchat.Message, userID, conversationID domainshared.ID, store *reactionStoreStub) (*Service, *reactionChatRepo) {
	t.Helper()
	now := time.Date(2026, 8, 21, 10, 0, 0, 0, time.UTC)
	conversation, err := domainchat.NewConversation(domainchat.ConversationDirect, userID, "", now)
	if err != nil {
		t.Fatal(err)
	}
	member, err := domainchat.NewMember(conversationID, userID, domainchat.MemberOwner, now)
	if err != nil {
		t.Fatal(err)
	}
	user := newReplyUser(userID, "alice")
	repo := &reactionChatRepo{conversation: conversation, message: message, member: member}
	svc := NewService(repo, &reactionUserRepo{user: user}, nil, nil, nil, "", func() time.Time { return now }, nil, store, nil)
	return svc, repo
}

func TestAddMessageReactionRequiresContentMessageAndPublishesEvent(t *testing.T) {
	conversationID := domainshared.NewID()
	userID := domainshared.NewID()
	now := time.Date(2026, 8, 21, 10, 0, 0, 0, time.UTC)
	message, err := domainchat.NewTextMessage(conversationID, userID, "hello", "message", now, nil)
	if err != nil {
		t.Fatal(err)
	}
	store := &reactionStoreStub{}
	svc, repo := newReactionService(t, message, userID, conversationID, store)

	err = svc.AddMessageReaction(context.Background(), AddMessageReactionInput{
		UserID:         userID,
		ConversationID: conversationID,
		MessageID:      message.ID(),
		EmojiID:        42,
	})
	if err != nil {
		t.Fatalf("AddMessageReaction() error = %v", err)
	}
	if len(store.added) != 1 || store.added[0].emojiID != 42 {
		t.Fatalf("added reactions = %+v, want one emoji 42", store.added)
	}
	if repo.eventType != domainchat.EventMessageReactionUpdated {
		t.Fatalf("event type = %q, want %q", repo.eventType, domainchat.EventMessageReactionUpdated)
	}
}

func TestAddMessageReactionRejectsSystemMessage(t *testing.T) {
	conversationID := domainshared.NewID()
	userID := domainshared.NewID()
	now := time.Date(2026, 8, 21, 10, 0, 0, 0, time.UTC)
	message, err := domainchat.NewSystemMessage(conversationID, userID, "Alice 加入了群聊", "system-1", now)
	if err != nil {
		t.Fatal(err)
	}
	store := &reactionStoreStub{}
	svc, _ := newReactionService(t, message, userID, conversationID, store)

	err = svc.AddMessageReaction(context.Background(), AddMessageReactionInput{
		UserID: userID, ConversationID: conversationID, MessageID: message.ID(), EmojiID: 42,
	})
	if err == nil {
		t.Fatal("AddMessageReaction() error = nil, want system message rejection")
	}
	if len(store.added) != 0 {
		t.Fatalf("added reactions = %+v, want none", store.added)
	}
}

func TestListMessagesIncludesAggregatedReactions(t *testing.T) {
	conversationID := domainshared.NewID()
	userID := domainshared.NewID()
	now := time.Date(2026, 8, 21, 10, 0, 0, 0, time.UTC)
	message, err := domainchat.NewTextMessage(conversationID, userID, "hello", "message", now, nil)
	if err != nil {
		t.Fatal(err)
	}
	store := &reactionStoreStub{byMessage: map[string][]domainchatreaction.AggregatedReaction{
		message.ID().String(): {{EmojiID: 42, EmojiName: "[笑]", Count: 2, Self: true}},
	}}
	svc, repo := newReactionService(t, message, userID, conversationID, store)
	repo.messages = []*domainchat.Message{message}

	result, err := svc.ListMessages(context.Background(), userID, conversationID, "", 20)
	if err != nil {
		t.Fatalf("ListMessages() error = %v", err)
	}
	if len(result.Items) != 1 || len(result.Items[0].Reactions) != 1 {
		t.Fatalf("message reactions = %+v, want one reaction", result.Items)
	}
	if got := result.Items[0].Reactions[0].Count; got != 2 {
		t.Fatalf("reaction count = %d, want 2", got)
	}
}
