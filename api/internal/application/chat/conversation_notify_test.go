package chat

import (
	"context"
	"testing"
	"time"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
)

// notifyChatRepo stub：只实现私聊创建与事件落库所需的最小接口。
type notifyChatRepo struct {
	domainchat.ConversationRepository
	existingDirect *domainchat.Conversation
	savedEvents    []savedEvent
}

type savedEvent struct {
	userIDs []domainshared.ID
	kind    domainchat.ChatEventType
	payload map[string]any
}

func (r *notifyChatRepo) FindDirect(context.Context, domainshared.ID, domainshared.ID) (*domainchat.Conversation, error) {
	if r.existingDirect != nil {
		return r.existingDirect, nil
	}
	return nil, domainchat.ErrConversationNotFound
}

func (r *notifyChatRepo) SaveConversation(context.Context, *domainchat.Conversation, []*domainchat.Member) error {
	return nil
}

func (r *notifyChatRepo) SaveMember(context.Context, *domainchat.Member) error {
	return nil
}

func (r *notifyChatRepo) CountUnread(context.Context, domainshared.ID, domainshared.ID) (int64, error) {
	return 0, nil
}

func (r *notifyChatRepo) ListMessages(context.Context, domainshared.ID, *domainchat.MessageCursor, int) ([]*domainchat.Message, error) {
	return nil, nil
}

func (r *notifyChatRepo) ListMembers(context.Context, domainshared.ID, bool) ([]*domainchat.Member, error) {
	return nil, nil
}

func (r *notifyChatRepo) SaveEvent(_ context.Context, userIDs []domainshared.ID, kind domainchat.ChatEventType, payload map[string]any) ([]domainchat.Event, error) {
	r.savedEvents = append(r.savedEvents, savedEvent{userIDs: userIDs, kind: kind, payload: payload})
	out := make([]domainchat.Event, 0, len(userIDs))
	for _, id := range userIDs {
		out = append(out, domainchat.Event{UserID: id, Type: kind, Payload: payload, CreatedAt: time.Now()})
	}
	return out, nil
}

type pushedEvent struct {
	userID domainshared.ID
	dto    EventDTO
}

// captureNotifier 捕获实时推送。
type captureNotifier struct {
	pushed []pushedEvent
}

func (n *captureNotifier) Push(userID domainshared.ID, event EventDTO) {
	n.pushed = append(n.pushed, pushedEvent{userID: userID, dto: event})
}

type notifyUserRepo struct {
	UserRepository
	users map[domainshared.ID]*domainuser.User
}

func (r *notifyUserRepo) FindByID(_ context.Context, id domainshared.ID) (*domainuser.User, error) {
	return r.users[id], nil
}

func (r *notifyUserRepo) FindByIDs(_ context.Context, ids []domainshared.ID) ([]*domainuser.User, error) {
	out := make([]*domainuser.User, 0, len(ids))
	for _, id := range ids {
		if u := r.users[id]; u != nil {
			out = append(out, u)
		}
	}
	return out, nil
}

func newNotifyService(t *testing.T, existing *domainchat.Conversation, users map[domainshared.ID]*domainuser.User) (*Service, *notifyChatRepo, *captureNotifier) {
	t.Helper()
	now := time.Date(2026, 8, 25, 10, 0, 0, 0, time.UTC)
	repo := &notifyChatRepo{existingDirect: existing}
	userRepo := &notifyUserRepo{users: users}
	notifier := &captureNotifier{}
	return NewService(repo, userRepo, nil, notifier, nil, "", func() time.Time { return now }, nil, nil, nil, nil), repo, notifier
}

// 私聊创建必须广播会话事件，否则接收方只能靠刷新看到新会话。
func TestCreateDirectConversationNotifiesRecipient(t *testing.T) {
	senderID := domainshared.NewID()
	recipientID := domainshared.NewID()
	users := map[domainshared.ID]*domainuser.User{
		senderID:   newReplyUser(senderID, "sender"),
		recipientID: newReplyUser(recipientID, "recipient"),
	}
	svc, repo, notifier := newNotifyService(t, nil, users)
	_, err := svc.CreateConversation(context.Background(), CreateConversationInput{
		UserID:         senderID,
		Kind:           domainchat.ConversationDirect,
		ParticipantIDs: []domainshared.ID{recipientID},
	})
	if err != nil {
		t.Fatal(err)
	}

	found := false
	for _, p := range notifier.pushed {
		if p.userID == recipientID && p.dto.Type == string(domainchat.EventConversationCreated) {
			found = true
		}
	}
	if !found {
		t.Fatalf("recipient realtime push missing, got %+v", notifier.pushed)
	}
	for _, e := range repo.savedEvents {
		if e.kind == domainchat.EventConversationCreated {
			for _, id := range e.userIDs {
				if id == recipientID {
					return
				}
			}
		}
	}
	t.Fatalf("recipient persisted event missing, saved = %+v", repo.savedEvents)
}
