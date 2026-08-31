package chat

import (
	"context"
	"testing"
	"time"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
)

// receiptChatRepo stub：已读回执所需的最小接口，阅读位置落内存以支持推进检测。
type receiptChatRepo struct {
	domainchat.ConversationRepository
	conversation *domainchat.Conversation
	members      []*domainchat.Member
	messages     map[domainshared.ID]*domainchat.Message
	listed       []*domainchat.Message
	states       []domainchat.MemberReadState
	positions    map[domainshared.ID]*domainchat.ReadPosition
	savedEvents  []savedEvent
}

func (r *receiptChatRepo) FindByIDForMember(context.Context, domainshared.ID, domainshared.ID) (*domainchat.Conversation, error) {
	if r.conversation == nil {
		return nil, domainchat.ErrConversationNotFound
	}
	return r.conversation, nil
}

func (r *receiptChatRepo) FindMessage(_ context.Context, conversationID domainshared.ID, messageID domainshared.ID) (*domainchat.Message, error) {
	message, ok := r.messages[messageID]
	if !ok || !message.ConversationID().Equal(conversationID) {
		return nil, domainchat.ErrMessageNotFound
	}
	return message, nil
}

func (r *receiptChatRepo) ListMessages(context.Context, domainshared.ID, *domainchat.MessageCursor, int) ([]*domainchat.Message, error) {
	return r.listed, nil
}

func (r *receiptChatRepo) ListMembers(context.Context, domainshared.ID, bool) ([]*domainchat.Member, error) {
	return r.members, nil
}

func (r *receiptChatRepo) FindReadPosition(_ context.Context, _ domainshared.ID, userID domainshared.ID) (*domainchat.ReadPosition, error) {
	return r.positions[userID], nil
}

func (r *receiptChatRepo) SaveReadPosition(_ context.Context, position *domainchat.ReadPosition) error {
	r.positions[position.UserID()] = position
	return nil
}

func (r *receiptChatRepo) ListMemberReadStates(context.Context, domainshared.ID) ([]domainchat.MemberReadState, error) {
	return r.states, nil
}

func (r *receiptChatRepo) CountUnread(context.Context, domainshared.ID, domainshared.ID) (int64, error) {
	return 0, nil
}

func (r *receiptChatRepo) SaveEvent(_ context.Context, userIDs []domainshared.ID, kind domainchat.ChatEventType, payload map[string]any) ([]domainchat.Event, error) {
	r.savedEvents = append(r.savedEvents, savedEvent{userIDs: userIDs, kind: kind, payload: payload})
	out := make([]domainchat.Event, 0, len(userIDs))
	for _, id := range userIDs {
		out = append(out, domainchat.Event{UserID: id, Type: kind, Payload: payload, CreatedAt: time.Now()})
	}
	return out, nil
}

func newReceiptService(now time.Time, repo *receiptChatRepo, users map[domainshared.ID]*domainuser.User) (*Service, *captureNotifier) {
	notifier := &captureNotifier{}
	svc := NewService(repo, &notifyUserRepo{users: users}, nil, notifier, nil, "", func() time.Time { return now }, nil, nil, nil, nil)
	return svc, notifier
}

func readAdvancedEvents(repo *receiptChatRepo) []savedEvent {
	var out []savedEvent
	for _, event := range repo.savedEvents {
		if event.kind == domainchat.EventReadPositionAdvanced {
			out = append(out, event)
		}
	}
	return out
}

// 水位推进必须实时广播，否则发送者看不到「已读」；重复标记同一位置不重复广播。
func TestMarkReadBroadcastsReadAdvanced(t *testing.T) {
	now := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	conversationID := domainshared.NewID()
	reader := domainshared.NewID()
	other := domainshared.NewID()
	third := domainshared.NewID()

	memberOf := func(userID domainshared.ID) *domainchat.Member {
		member, err := domainchat.NewMember(conversationID, userID, domainchat.MemberMember, now.Add(-time.Hour))
		if err != nil {
			t.Fatal(err)
		}
		return member
	}
	message, err := domainchat.NewTextMessage(conversationID, other, "你好", "rr-1", now.Add(-time.Minute), nil)
	if err != nil {
		t.Fatal(err)
	}
	repo := &receiptChatRepo{
		conversation: domainchat.ReconstructConversation(conversationID, reader, domainchat.ConversationRoom, "房间", nil, now.Add(-time.Hour), now.Add(-time.Hour)),
		members:      []*domainchat.Member{memberOf(reader), memberOf(other), memberOf(third)},
		messages:     map[domainshared.ID]*domainchat.Message{message.ID(): message},
		positions:    map[domainshared.ID]*domainchat.ReadPosition{},
	}
	svc, notifier := newReceiptService(now, repo, nil)

	if _, err := svc.MarkRead(context.Background(), reader, conversationID, message.ID()); err != nil {
		t.Fatal(err)
	}
	events := readAdvancedEvents(repo)
	if len(events) != 1 {
		t.Fatalf("read.advanced events = %d, want 1", len(events))
	}
	event := events[0]
	if len(event.userIDs) != 2 {
		t.Fatalf("recipients = %v, want 2 members excluding reader", event.userIDs)
	}
	for _, id := range event.userIDs {
		if id == reader {
			t.Fatalf("reader must not receive own read.advanced event")
		}
	}
	if event.payload["conversation_id"] != conversationID.String() ||
		event.payload["user_id"] != reader.String() ||
		event.payload["last_message_id"] != message.ID().String() {
		t.Fatalf("unexpected payload: %+v", event.payload)
	}
	pushed := 0
	for _, p := range notifier.pushed {
		if p.dto.Type == string(domainchat.EventReadPositionAdvanced) {
			pushed++
		}
	}
	if pushed != 2 {
		t.Fatalf("pushed read.advanced = %d, want 2", pushed)
	}

	// 重复标记同一位置：不推进水位，不重复广播。
	if _, err := svc.MarkRead(context.Background(), reader, conversationID, message.ID()); err != nil {
		t.Fatal(err)
	}
	if got := len(readAdvancedEvents(repo)); got != 1 {
		t.Fatalf("read.advanced events after duplicate mark = %d, want 1", got)
	}
}

// 已读回执只附在发送者本人消息上：私聊看对方水位，房间聚合计数排除自己。
func TestListMessagesAttachesReadState(t *testing.T) {
	now := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	conversationID := domainshared.NewID()
	viewer := domainshared.NewID()
	other := domainshared.NewID()
	third := domainshared.NewID()

	own, err := domainchat.NewTextMessage(conversationID, viewer, "我发的", "rr-own", now.Add(-10*time.Minute), nil)
	if err != nil {
		t.Fatal(err)
	}
	others, err := domainchat.NewTextMessage(conversationID, other, "对方发的", "rr-other", now.Add(-9*time.Minute), nil)
	if err != nil {
		t.Fatal(err)
	}
	system, err := domainchat.NewSystemMessage(conversationID, viewer, "系统事件", "rr-sys", now.Add(-8*time.Minute))
	if err != nil {
		t.Fatal(err)
	}

	// other 已读（水位晚于消息）；third 从未标记。
	otherReadAt := now.Add(-5 * time.Minute)
	otherWatermark := now.Add(-6 * time.Minute)
	repo := &receiptChatRepo{
		conversation: domainchat.ReconstructConversation(conversationID, viewer, domainchat.ConversationRoom, "房间", nil, now.Add(-time.Hour), now.Add(-time.Hour)),
		listed:       []*domainchat.Message{system, others, own},
		states: []domainchat.MemberReadState{
			{UserID: viewer, LastMessageID: messageIDPtr(system), LastReadAt: &otherWatermark, ReadAt: &otherReadAt},
			{UserID: other, LastMessageID: messageIDPtr(others), LastReadAt: &otherWatermark, ReadAt: &otherReadAt},
			{UserID: third},
		},
	}
	users := map[domainshared.ID]*domainuser.User{
		viewer: newReplyUser(viewer, "viewer"),
		other:  newReplyUser(other, "other"),
	}
	svc, _ := newReceiptService(now, repo, users)

	result, err := svc.ListMessages(context.Background(), viewer, conversationID, "", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Items) != 3 {
		t.Fatalf("items = %d, want 3", len(result.Items))
	}
	byID := make(map[string]MessageDTO, len(result.Items))
	for _, item := range result.Items {
		byID[item.ID] = item
	}
	ownState := byID[own.ID().String()].ReadState
	if ownState == nil {
		t.Fatal("own message missing read_state")
	}
	if ownState.ReadCount != 1 || ownState.MemberCount != 2 {
		t.Fatalf("own read_state = %+v, want read_count=1 member_count=2", ownState)
	}
	if byID[others.ID().String()].ReadState != nil {
		t.Fatal("other's message must not carry read_state")
	}
	if byID[system.ID().String()].ReadState != nil {
		t.Fatal("system message must not carry read_state")
	}
}

// 已读名单按标记时间倒序，仅发送者可见。
func TestListMessageReaders(t *testing.T) {
	now := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	conversationID := domainshared.NewID()
	viewer := domainshared.NewID()
	other := domainshared.NewID()
	third := domainshared.NewID()

	message, err := domainchat.NewTextMessage(conversationID, viewer, "我发的", "rr-readers", now.Add(-10*time.Minute), nil)
	if err != nil {
		t.Fatal(err)
	}
	readEarly := now.Add(-8 * time.Minute)
	readLate := now.Add(-2 * time.Minute)
	watermark := now.Add(-5 * time.Minute)
	repo := &receiptChatRepo{
		conversation: domainchat.ReconstructConversation(conversationID, viewer, domainchat.ConversationRoom, "房间", nil, now.Add(-time.Hour), now.Add(-time.Hour)),
		messages:     map[domainshared.ID]*domainchat.Message{message.ID(): message},
		states: []domainchat.MemberReadState{
			{UserID: viewer, LastMessageID: messageIDPtr(message), LastReadAt: &watermark, ReadAt: &readEarly},
			{UserID: other, LastMessageID: messageIDPtr(message), LastReadAt: &watermark, ReadAt: &readEarly},
			{UserID: third, LastMessageID: messageIDPtr(message), LastReadAt: &watermark, ReadAt: &readLate},
		},
	}
	users := map[domainshared.ID]*domainuser.User{
		viewer: newReplyUser(viewer, "viewer"),
		other:  newReplyUser(other, "other"),
		third:  newReplyUser(third, "third"),
	}
	svc, _ := newReceiptService(now, repo, users)

	readers, err := svc.ListMessageReaders(context.Background(), viewer, conversationID, message.ID())
	if err != nil {
		t.Fatal(err)
	}
	if len(readers) != 2 {
		t.Fatalf("readers = %d, want 2 (sender excluded)", len(readers))
	}
	if readers[0].User.ID != third.String() || readers[1].User.ID != other.String() {
		t.Fatalf("readers order = [%s %s], want latest read first", readers[0].User.ID, readers[1].User.ID)
	}
	if readers[0].ReadAt == "" {
		t.Fatal("reader missing read_at")
	}

	if _, err := svc.ListMessageReaders(context.Background(), other, conversationID, message.ID()); err == nil {
		t.Fatal("non-sender listing readers must fail")
	}
}

func messageIDPtr(message *domainchat.Message) *domainshared.ID {
	id := message.ID()
	return &id
}
