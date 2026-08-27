package chat

import (
	"context"
	"strings"
	"testing"
	"time"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
)

type replyChatRepo struct {
	domainchat.ConversationRepository
	conversation *domainchat.Conversation
	target       *domainchat.Message
	member       *domainchat.Member
	saved        *domainchat.Message
}

func (r *replyChatRepo) FindByIDForMember(context.Context, domainshared.ID, domainshared.ID) (*domainchat.Conversation, error) {
	return r.conversation, nil
}

func (r *replyChatRepo) FindMessageByIdempotency(context.Context, domainshared.ID, domainshared.ID, string) (*domainchat.Message, error) {
	return nil, domainchat.ErrMessageNotFound
}

func (r *replyChatRepo) FindMessage(_ context.Context, conversationID, messageID domainshared.ID) (*domainchat.Message, error) {
	if r.target != nil && r.target.ConversationID().Equal(conversationID) && r.target.ID().Equal(messageID) {
		return r.target, nil
	}
	return nil, domainchat.ErrMessageNotFound
}

func (r *replyChatRepo) ListMembers(context.Context, domainshared.ID, bool) ([]*domainchat.Member, error) {
	return []*domainchat.Member{r.member}, nil
}

func (r *replyChatRepo) SaveMessage(_ context.Context, message *domainchat.Message, _ []domainshared.ID, _ map[string]any) ([]domainchat.Event, error) {
	r.saved = message
	return nil, nil
}

func (r *replyChatRepo) ListMessages(context.Context, domainshared.ID, *domainchat.MessageCursor, int) ([]*domainchat.Message, error) {
	if r.saved == nil {
		return nil, nil
	}
	return []*domainchat.Message{r.saved}, nil
}

func TestListMessagesRedactsDeletedReplyTarget(t *testing.T) {
	conversationID := domainshared.NewID()
	userID := domainshared.NewID()
	targetSenderID := domainshared.NewID()
	now := time.Date(2026, 8, 21, 10, 0, 0, 0, time.UTC)
	target, err := domainchat.NewTextMessage(conversationID, targetSenderID, "原始内容", "target", now, nil)
	if err != nil {
		t.Fatal(err)
	}
	targetID := target.ID()
	reply, err := domainchat.NewTextMessage(conversationID, userID, "回复内容", "reply", now.Add(time.Minute), &targetID)
	if err != nil {
		t.Fatal(err)
	}
	svc, repo := newReplyService(t, target, userID, targetSenderID, conversationID)
	repo.saved = reply
	if err := target.Delete(domainshared.NewID(), now.Add(2*time.Minute)); err != nil {
		t.Fatal(err)
	}

	result, err := svc.ListMessages(context.Background(), userID, conversationID, "", 20)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Items) != 1 || result.Items[0].ReplyTo == nil {
		t.Fatal("expected a deleted reply target preview")
	}
	if !result.Items[0].ReplyTo.IsDeleted || result.Items[0].ReplyTo.Content != "" {
		t.Fatalf("deleted reply target preview = %+v, want redacted placeholder", result.Items[0].ReplyTo)
	}
}

type replyUserRepo struct {
	UserRepository
	users map[domainshared.ID]*domainuser.User
}

func (r *replyUserRepo) FindByID(_ context.Context, id domainshared.ID) (*domainuser.User, error) {
	return r.users[id], nil
}

func newReplyUser(id domainshared.ID, username string) *domainuser.User {
	email, _ := domainuser.ParseEmail(username + "@example.com")
	name, _ := domainuser.ParseUsername(username)
	return domainuser.NewUser(id, email, name, domainuser.PasswordHash{})
}

func newReplyService(t *testing.T, target *domainchat.Message, userID, targetSenderID, conversationID domainshared.ID) (*Service, *replyChatRepo) {
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
	repo := &replyChatRepo{conversation: conversation, target: target, member: member}
	users := &replyUserRepo{users: map[domainshared.ID]*domainuser.User{
		userID:         newReplyUser(userID, "alice"),
		targetSenderID: newReplyUser(targetSenderID, "bob"),
	}}
	return NewService(repo, users, nil, nil, nil, "", func() time.Time { return now }, nil, nil, nil, nil), repo
}

func TestSendMessageIncludesDynamicReplyPreview(t *testing.T) {
	conversationID := domainshared.NewID()
	userID := domainshared.NewID()
	targetSenderID := domainshared.NewID()
	now := time.Date(2026, 8, 21, 10, 0, 0, 0, time.UTC)
	targetContent := strings.Repeat("你", 121)
	target, err := domainchat.NewTextMessage(conversationID, targetSenderID, targetContent, "target", now, nil)
	if err != nil {
		t.Fatal(err)
	}
	svc, repo := newReplyService(t, target, userID, targetSenderID, conversationID)

	got, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID:         userID,
		ConversationID: conversationID,
		Type:           domainchat.MessageText,
		Content:        "收到",
		ReplyToID:      target.ID(),
		IdempotencyKey: "reply-1",
	})
	if err != nil {
		t.Fatal(err)
	}

	if repo.saved == nil || repo.saved.ReplyToID() == nil {
		t.Fatal("expected saved message to keep its reply target")
	}
	if !repo.saved.ReplyToID().Equal(target.ID()) {
		t.Fatalf("saved reply target = %s, want %s", repo.saved.ReplyToID(), target.ID())
	}
	if got.ReplyTo == nil {
		t.Fatal("expected response to include reply preview")
	}
	if got.ReplyTo.ID != target.ID().String() {
		t.Fatalf("reply preview ID = %q, want %q", got.ReplyTo.ID, target.ID().String())
	}
	if got.ReplyTo.Content != strings.Repeat("你", 120)+"…" {
		t.Fatalf("reply preview content = %q, want 120-rune preview", got.ReplyTo.Content)
	}
}

func TestSendMessageRejectsDeletedReplyTarget(t *testing.T) {
	conversationID := domainshared.NewID()
	userID := domainshared.NewID()
	targetSenderID := domainshared.NewID()
	now := time.Date(2026, 8, 21, 10, 0, 0, 0, time.UTC)
	target, err := domainchat.NewTextMessage(conversationID, targetSenderID, "已删除", "target", now, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := target.Delete(domainshared.NewID(), now); err != nil {
		t.Fatal(err)
	}
	svc, repo := newReplyService(t, target, userID, targetSenderID, conversationID)

	_, err = svc.SendMessage(context.Background(), SendMessageInput{
		UserID:         userID,
		ConversationID: conversationID,
		Type:           domainchat.MessageText,
		Content:        "无法引用",
		ReplyToID:      target.ID(),
		IdempotencyKey: "reply-deleted",
	})
	if err == nil {
		t.Fatal("expected deleted reply target to be rejected")
	}
	if repo.saved != nil {
		t.Fatal("deleted reply target must not save a message")
	}
}
