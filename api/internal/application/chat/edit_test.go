package chat

import (
	"context"
	"strconv"
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
	events       []domainchat.Event
}

func (r *editChatRepo) FindByIDForMember(context.Context, domainshared.ID, domainshared.ID) (*domainchat.Conversation, error) {
	return r.conversation, nil
}
func (r *editChatRepo) ListMemberReadStates(context.Context, domainshared.ID) ([]domainchat.MemberReadState, error) {
	return nil, nil
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

func (r *editChatRepo) SaveEvent(_ context.Context, userIDs []domainshared.ID, eventType domainchat.ChatEventType, payload map[string]any) ([]domainchat.Event, error) {
	r.eventType = eventType
	events := make([]domainchat.Event, 0, len(userIDs))
	for _, userID := range userIDs {
		event := domainchat.Event{Sequence: int64(len(r.events) + 1), UserID: userID, Type: eventType, Payload: payload, CreatedAt: time.Now()}
		r.events = append(r.events, event)
		events = append(events, event)
	}
	return events, nil
}

func (r *editChatRepo) FindEventsAfter(_ context.Context, _ domainshared.ID, afterSequence int64, _ int) ([]domainchat.Event, error) {
	var events []domainchat.Event
	for _, event := range r.events {
		if event.Sequence > afterSequence {
			events = append(events, event)
		}
	}
	return events, nil
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

func TestEditMessageStreamsSavedTextWithoutPersistingSnapshots(t *testing.T) {
	conversationID, userID := domainshared.NewID(), domainshared.NewID()
	now := time.Date(2026, 9, 23, 10, 0, 0, 0, time.UTC)
	message, err := domainchat.NewTextMessage(conversationID, userID, "原始内容", "edit-stream", now, nil)
	if err != nil {
		t.Fatal(err)
	}
	svc, repo := newEditService(t, message, userID, conversationID, now.Add(time.Second))
	notifier := &captureNotifier{}
	svc.notifier = notifier
	for _, content := range []string{"第一段", "第一段第二段"} {
		if _, err := svc.EditMessage(context.Background(), EditMessageInput{
			UserID: userID, ConversationID: conversationID, MessageID: message.ID(), Content: content,
		}); err != nil {
			t.Fatal(err)
		}
	}
	if len(notifier.pushed) != 2 {
		t.Fatalf("实时事件数 = %d, want 2", len(notifier.pushed))
	}
	for i, content := range []string{"第一段", "第一段第二段"} {
		got := notifier.pushed[i].dto
		if got.Type != string(domainchat.EventMessageUpdated) || got.Data["content"] != content || got.Data["edited_at"] == nil {
			t.Fatalf("实时事件 %d = %+v", i, got)
		}
		if got.Data["message_id"] != message.ID().String() || got.ID != strconv.Itoa(i+1) {
			t.Fatalf("实时事件缺少原有标识: %+v", got)
		}
		if _, ok := repo.events[i].Payload["content"]; ok {
			t.Fatalf("持久化事件 %d 不应保存正文", i)
		}
	}
	replayed, err := svc.EventsAfter(context.Background(), userID, 0, 10)
	if err != nil {
		t.Fatal(err)
	}
	for _, event := range replayed {
		if _, ok := event.Data["content"]; ok {
			t.Fatalf("补发事件不应携带旧正文: %+v", event)
		}
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

func TestEditMessageMentionAllRoomOnlyWithoutPush(t *testing.T) {
	for _, kind := range []domainchat.ConversationKind{domainchat.ConversationDirect, domainchat.ConversationRoom} {
		t.Run(string(kind), func(t *testing.T) {
			now := time.Now()
			conversationID, userID := domainshared.NewID(), domainshared.NewID()
			message, err := domainchat.NewTextMessage(conversationID, userID, "原文", "edit-all", now, nil)
			if err != nil {
				t.Fatal(err)
			}
			svc, repo := newEditService(t, message, userID, conversationID, now.Add(time.Minute))
			repo.conversation = domainchat.ReconstructConversation(conversationID, userID, kind, "房间", nil, now, now)
			push := &capturePushSender{}
			svc.push = push
			dto, err := svc.EditMessage(context.Background(), EditMessageInput{
				UserID: userID, ConversationID: conversationID, MessageID: message.ID(), Content: "@(all:all) 新内容",
			})
			if kind == domainchat.ConversationDirect {
				if err == nil || repo.updated != nil {
					t.Fatal("私聊全体提及必须在更新前被拒绝")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if dto.Content != "@(all:all) 新内容" || repo.eventType != domainchat.EventMessageUpdated {
				t.Fatal("房间编辑必须保留全体提及并仅广播更新事件")
			}
			svc.notifyEvents(context.Background(), []domainchat.Event{{UserID: userID, Type: repo.eventType}})
			if len(push.sent) != 0 {
				t.Fatal("编辑不能触发提及推送")
			}
		})
	}
}
