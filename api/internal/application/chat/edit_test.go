package chat

import (
	"context"
	"testing"
	"time"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
)

type editChatRepo struct {
	domainchat.ConversationRepository
	conversation *domainchat.Conversation
	message      *domainchat.Message
	member       *domainchat.Member
	updated      *domainchat.Message
	eventType    domainchat.ChatEventType
}

func (r *editChatRepo) FindByIDForMember(context.Context, domainshared.ID, domainshared.ID) (*domainchat.Conversation, error) {
	return r.conversation, nil
}

func (r *editChatRepo) FindMessage(context.Context, domainshared.ID, domainshared.ID) (*domainchat.Message, error) {
	return r.message, nil
}

func (r *editChatRepo) ListMembers(context.Context, domainshared.ID, bool) ([]*domainchat.Member, error) {
	return []*domainchat.Member{r.member}, nil
}

func (r *editChatRepo) UpdateMessage(_ context.Context, message *domainchat.Message) error {
	r.updated = message
	return nil
}

func (r *editChatRepo) SaveEvent(_ context.Context, _ []domainshared.ID, eventType domainchat.ChatEventType, _ map[string]any) ([]domainchat.Event, error) {
	r.eventType = eventType
	return nil, nil
}

func newEditService(t *testing.T, message *domainchat.Message, userID, conversationID domainshared.ID, now time.Time) (*Service, *editChatRepo) {
	t.Helper()
	conversation, err := domainchat.NewConversation(domainchat.ConversationDirect, userID, "", now)
	if err != nil {
		t.Fatal(err)
	}
	member, err := domainchat.NewMember(conversationID, userID, domainchat.MemberOwner, now)
	if err != nil {
		t.Fatal(err)
	}
	repo := &editChatRepo{conversation: conversation, message: message, member: member}
	users := &replyUserRepo{users: map[domainshared.ID]*domainuser.User{
		userID:             newReplyUser(userID, "alice"),
		message.SenderID(): newReplyUser(message.SenderID(), "sender"),
	}}
	return NewService(repo, users, nil, nil, nil, "", func() time.Time { return now }, nil, nil, nil, nil), repo
}

func TestEditMessageStampsEditedAtAndBroadcasts(t *testing.T) {
	conversationID := domainshared.NewID()
	userID := domainshared.NewID()
	now := time.Date(2026, 8, 27, 10, 0, 0, 0, time.UTC)
	message, err := domainchat.NewTextMessage(conversationID, userID, "原始内容", "edit-src", now, nil)
	if err != nil {
		t.Fatal(err)
	}
	svc, repo := newEditService(t, message, userID, conversationID, now.Add(time.Hour))

	dto, err := svc.EditMessage(context.Background(), EditMessageInput{UserID: userID, ConversationID: conversationID, MessageID: message.ID(), Content: "修订内容"})
	if err != nil {
		t.Fatal(err)
	}
	if dto.EditedAt == nil || dto.Content != "修订内容" {
		t.Fatalf("dto = %+v, want edited content with edited_at", dto)
	}
	if repo.updated == nil {
		t.Fatal("expected UpdateMessage to be called")
	}
	if repo.eventType != domainchat.EventMessageUpdated {
		t.Fatalf("event type = %q, want %q", repo.eventType, domainchat.EventMessageUpdated)
	}
}

func TestEditMessageRejectsNonAuthor(t *testing.T) {
	conversationID := domainshared.NewID()
	authorID := domainshared.NewID()
	strangerID := domainshared.NewID()
	now := time.Date(2026, 8, 27, 10, 0, 0, 0, time.UTC)
	message, err := domainchat.NewTextMessage(conversationID, authorID, "原始内容", "edit-src", now, nil)
	if err != nil {
		t.Fatal(err)
	}
	svc, repo := newEditService(t, message, strangerID, conversationID, now.Add(time.Hour))

	if _, err := svc.EditMessage(context.Background(), EditMessageInput{UserID: strangerID, ConversationID: conversationID, MessageID: message.ID(), Content: "篡改"}); err == nil {
		t.Fatal("expected forbidden error for non-author edit")
	}
	if repo.updated != nil || repo.eventType != "" {
		t.Fatal("rejected edit must not persist or broadcast")
	}
}

func TestEditMessageNoopSkipsPersistAndEvent(t *testing.T) {
	conversationID := domainshared.NewID()
	userID := domainshared.NewID()
	now := time.Date(2026, 8, 27, 10, 0, 0, 0, time.UTC)
	message, err := domainchat.NewTextMessage(conversationID, userID, "原始内容", "edit-src", now, nil)
	if err != nil {
		t.Fatal(err)
	}
	svc, repo := newEditService(t, message, userID, conversationID, now.Add(time.Hour))

	dto, err := svc.EditMessage(context.Background(), EditMessageInput{UserID: userID, ConversationID: conversationID, MessageID: message.ID(), Content: "原始内容"})
	if err != nil {
		t.Fatal(err)
	}
	if dto.EditedAt != nil {
		t.Fatal("noop edit must not stamp edited_at")
	}
	if repo.updated != nil || repo.eventType != "" {
		t.Fatal("noop edit must not persist or broadcast")
	}
}
