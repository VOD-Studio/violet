package chat

import (
	"context"
	"testing"
	"time"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
)

type typingChatRepo struct {
	domainchat.ConversationRepository
	conversation    *domainchat.Conversation
	members         []*domainchat.Member
	findErr         error
	saveEventCalled bool
}

func (r *typingChatRepo) FindByIDForMember(context.Context, domainshared.ID, domainshared.ID) (*domainchat.Conversation, error) {
	if r.findErr != nil {
		return nil, r.findErr
	}
	return r.conversation, nil
}

func (r *typingChatRepo) ListMembers(context.Context, domainshared.ID, bool) ([]*domainchat.Member, error) {
	return r.members, nil
}

func (r *typingChatRepo) SaveEvent(context.Context, []domainshared.ID, domainchat.ChatEventType, map[string]any) ([]domainchat.Event, error) {
	r.saveEventCalled = true
	return nil, nil
}

type typingPush struct {
	userID domainshared.ID
	event  EventDTO
}

type typingNotifier struct {
	pushed []typingPush
}

func (n *typingNotifier) Push(userID domainshared.ID, event EventDTO) {
	n.pushed = append(n.pushed, typingPush{userID: userID, event: event})
}

func newTypingService(t *testing.T, conversationID domainshared.ID, members []*domainchat.Member, findErr error) (*Service, *typingChatRepo, *typingNotifier) {
	t.Helper()
	now := time.Date(2026, 8, 24, 10, 0, 0, 0, time.UTC)
	conversation, err := domainchat.NewConversation(domainchat.ConversationRoom, conversationID, "房间", now)
	if err != nil {
		t.Fatal(err)
	}
	repo := &typingChatRepo{conversation: conversation, members: members, findErr: findErr}
	notifier := &typingNotifier{}
	svc := NewService(repo, nil, nil, notifier, nil, "", func() time.Time { return now }, nil, nil, nil, nil)
	return svc, repo, notifier
}

func newTypingMember(t *testing.T, conversationID, userID domainshared.ID, active bool) *domainchat.Member {
	t.Helper()
	now := time.Date(2026, 8, 24, 10, 0, 0, 0, time.UTC)
	member, err := domainchat.NewMember(conversationID, userID, domainchat.MemberMember, now)
	if err != nil {
		t.Fatal(err)
	}
	if !active {
		member.Leave(now)
	}
	return member
}

func TestSetTypingRequiresMembership(t *testing.T) {
	conversationID := domainshared.NewID()
	userID := domainshared.NewID()
	svc, _, notifier := newTypingService(t, conversationID, nil, domainchat.ErrConversationNotFound)

	err := svc.SetTyping(context.Background(), SetTypingInput{UserID: userID, ConversationID: conversationID, IsTyping: true})

	if err == nil {
		t.Fatal("expected error for non-member")
	}
	if len(notifier.pushed) != 0 {
		t.Fatalf("expected no broadcast for rejected request, got %d", len(notifier.pushed))
	}
}

func TestSetTypingBroadcastsToOtherActiveMembersExcludingSenderAndLeft(t *testing.T) {
	conversationID := domainshared.NewID()
	sender := domainshared.NewID()
	other1 := domainshared.NewID()
	other2 := domainshared.NewID()
	left := domainshared.NewID()
	members := []*domainchat.Member{
		newTypingMember(t, conversationID, sender, true),
		newTypingMember(t, conversationID, other1, true),
		newTypingMember(t, conversationID, other2, true),
		newTypingMember(t, conversationID, left, false),
	}
	svc, repo, notifier := newTypingService(t, conversationID, members, nil)

	err := svc.SetTyping(context.Background(), SetTypingInput{UserID: sender, ConversationID: conversationID, IsTyping: true})
	if err != nil {
		t.Fatal(err)
	}

	if len(notifier.pushed) != 2 {
		t.Fatalf("expected 2 broadcasts (excluding sender and left member), got %d", len(notifier.pushed))
	}
	recipients := map[domainshared.ID]bool{}
	for _, push := range notifier.pushed {
		recipients[push.userID] = true
		if push.event.Type != string(domainchat.EventTypingUpdated) {
			t.Fatalf("expected typing.updated event, got %s", push.event.Type)
		}
		if push.event.ID != "" {
			t.Fatalf("expected ephemeral event without replay id, got %q", push.event.ID)
		}
		if push.event.Data["conversation_id"] != conversationID.String() {
			t.Fatalf("unexpected conversation_id in payload: %v", push.event.Data["conversation_id"])
		}
		if push.event.Data["user_id"] != sender.String() {
			t.Fatalf("unexpected user_id in payload: %v", push.event.Data["user_id"])
		}
		if push.event.Data["is_typing"] != true {
			t.Fatalf("expected is_typing=true, got %v", push.event.Data["is_typing"])
		}
	}
	if !recipients[other1] || !recipients[other2] {
		t.Fatalf("expected other1 and other2 to receive broadcast, got %v", recipients)
	}
	if recipients[sender] || recipients[left] {
		t.Fatalf("sender or left member should not receive broadcast, got %v", recipients)
	}
	if repo.saveEventCalled {
		t.Fatal("typing must not be persisted via SaveEvent")
	}
}

func TestSetTypingStoppedBroadcastsFalseFlag(t *testing.T) {
	conversationID := domainshared.NewID()
	sender := domainshared.NewID()
	other := domainshared.NewID()
	members := []*domainchat.Member{
		newTypingMember(t, conversationID, sender, true),
		newTypingMember(t, conversationID, other, true),
	}
	svc, _, notifier := newTypingService(t, conversationID, members, nil)

	err := svc.SetTyping(context.Background(), SetTypingInput{UserID: sender, ConversationID: conversationID, IsTyping: false})
	if err != nil {
		t.Fatal(err)
	}

	if len(notifier.pushed) != 1 {
		t.Fatalf("expected 1 broadcast, got %d", len(notifier.pushed))
	}
	if notifier.pushed[0].event.Data["is_typing"] != false {
		t.Fatalf("expected is_typing=false, got %v", notifier.pushed[0].event.Data["is_typing"])
	}
}
