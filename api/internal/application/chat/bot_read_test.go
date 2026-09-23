package chat

import (
	"context"
	"errors"
	"testing"
	"time"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
)

type botReadRepo struct {
	*receiptChatRepo
	existing *domainchat.Message
	saved    *domainchat.Message
	saveErr  error
	readErr  error
}

func (r *botReadRepo) FindMessageByIdempotency(context.Context, domainshared.ID, domainshared.ID, string) (*domainchat.Message, error) {
	if r.existing != nil {
		return r.existing, nil
	}
	return nil, domainchat.ErrMessageNotFound
}

func (r *botReadRepo) SaveMessage(_ context.Context, message *domainchat.Message, _ []domainshared.ID, _ map[string]any) ([]domainchat.Event, error) {
	if r.saveErr != nil {
		return nil, r.saveErr
	}
	r.saved = message
	r.messages[message.ID()] = message
	r.listed = append([]*domainchat.Message{message}, r.listed...)
	return nil, nil
}

func (r *botReadRepo) UpdateBotReply(ctx context.Context, message *domainchat.Message, _ int64, recipientIDs []domainshared.ID) ([]domainchat.Event, error) {
	r.messages[message.ID()] = message
	return r.SaveEvent(ctx, recipientIDs, domainchat.EventMessageUpdated, map[string]any{
		"conversation_id": message.ConversationID().String(), "message_id": message.ID().String(),
	})
}

func (r *botReadRepo) SaveReadPosition(ctx context.Context, position *domainchat.ReadPosition) (bool, error) {
	if r.readErr != nil {
		return false, r.readErr
	}
	return r.receiptChatRepo.SaveReadPosition(ctx, position)
}

func newBotReadService(t *testing.T) (*Service, *botReadRepo, domainshared.ID, domainshared.ID, domainshared.ID, domainshared.ID) {
	t.Helper()
	now := time.Date(2026, 9, 23, 12, 0, 0, 0, time.UTC)
	conversationID, humanID, botID := domainshared.NewID(), domainshared.NewID(), domainshared.NewID()
	target, err := domainchat.NewTextMessage(conversationID, humanID, "先回答这条", "human-1", now.Add(-2*time.Minute), nil)
	if err != nil {
		t.Fatal(err)
	}
	later, err := domainchat.NewTextMessage(conversationID, humanID, "排队中的下一条", "human-2", now.Add(-time.Minute), nil)
	if err != nil {
		t.Fatal(err)
	}
	members := make([]*domainchat.Member, 0, 2)
	for _, userID := range []domainshared.ID{humanID, botID} {
		member, err := domainchat.NewMember(conversationID, userID, domainchat.MemberMember, now.Add(-time.Hour))
		if err != nil {
			t.Fatal(err)
		}
		members = append(members, member)
	}
	repo := &botReadRepo{receiptChatRepo: &receiptChatRepo{
		conversation: domainchat.ReconstructConversation(conversationID, humanID, domainchat.ConversationDirect, "", nil, now.Add(-time.Hour), now.Add(-time.Hour)),
		members:      members,
		messages:     map[domainshared.ID]*domainchat.Message{target.ID(): target, later.ID(): later},
		listed:       []*domainchat.Message{later, target},
		positions:    map[domainshared.ID]*domainchat.ReadPosition{},
	}}
	users := &replyUserRepo{users: map[domainshared.ID]*domainuser.User{
		humanID: newReplyUser(humanID, "human"),
		botID:   newReplyUser(botID, "saber"),
	}}
	svc := NewService(repo, users, nil, &captureNotifier{}, nil, "", func() time.Time { return now }, nil, nil, nil, nil)
	return svc, repo, conversationID, humanID, botID, target.ID()
}

func TestSendBotMessageMarksOnlyRepliedMessageRead(t *testing.T) {
	svc, repo, conversationID, humanID, botID, targetID := newBotReadService(t)
	in := SendMessageInput{UserID: botID, ConversationID: conversationID, Type: domainchat.MessageText, Content: "第一段回复", ReplyToID: targetID, IdempotencyKey: "bot-reply"}
	if _, err := svc.SendBotMessage(context.Background(), in); err != nil {
		t.Fatal(err)
	}
	position := repo.positions[botID]
	if position == nil || position.LastMessageID() == nil || !position.LastMessageID().Equal(targetID) {
		t.Fatalf("bot 已读位置 = %+v, want 被回复的人类消息", position)
	}
	events := readAdvancedEvents(repo.receiptChatRepo)
	if len(events) != 1 || len(events[0].userIDs) != 1 || !events[0].userIDs[0].Equal(humanID) {
		t.Fatalf("已读事件接收者 = %+v, want 人类发送者", events)
	}
	if events[0].payload["last_message_id"] != targetID.String() {
		t.Fatalf("已读位置推进到了其他消息: %+v", events[0].payload)
	}

	repo.positions = map[domainshared.ID]*domainchat.ReadPosition{}
	repo.existing = repo.saved
	if _, err := svc.SendBotMessage(context.Background(), in); err != nil {
		t.Fatal(err)
	}
	if repo.positions[botID] == nil {
		t.Fatal("幂等重试也应补做已读推进")
	}
}

func TestSendBotMessageDoesNotMarkProactiveOrFailedSend(t *testing.T) {
	svc, repo, conversationID, _, botID, targetID := newBotReadService(t)
	in := SendMessageInput{UserID: botID, ConversationID: conversationID, Type: domainchat.MessageText, Content: "主动发言", IdempotencyKey: "proactive"}
	if _, err := svc.SendBotMessage(context.Background(), in); err != nil {
		t.Fatal(err)
	}
	if len(repo.positions) != 0 {
		t.Fatal("无引用的主动消息不应推进已读")
	}
	repo.saveErr = errors.New("写消息失败")
	in.ReplyToID, in.IdempotencyKey = targetID, "failed-reply"
	if _, err := svc.SendBotMessage(context.Background(), in); err == nil {
		t.Fatal("消息保存失败应返回错误")
	}
	if len(repo.positions) != 0 {
		t.Fatal("消息未保存时不应推进已读")
	}
	repo.saveErr = nil
	repo.readErr = errors.New("写已读失败")
	if _, err := svc.SendBotMessage(context.Background(), in); err != nil {
		t.Fatalf("回复已保存时已读写入失败不应让 bot 重试发送: %v", err)
	}
}

func TestPendingBotReplyReportsStateAndMarksReadOnFirstText(t *testing.T) {
	svc, repo, conversationID, _, botUserID, targetID := newBotReadService(t)
	now := time.Date(2026, 9, 23, 12, 0, 0, 0, time.UTC)
	bot, _, err := domainchat.NewBot(domainshared.NewID(), botUserID, "Saber", nil, now)
	if err != nil {
		t.Fatal(err)
	}
	bot.SetShowThinking(true, now)
	bot.SetThinkingDefaultExpanded(true, now)
	botRepo := newFakeBotRepo()
	botRepo.bots[bot.ID()] = bot
	svc.WithBotRepository(botRepo)
	created, err := svc.SendBotMessage(context.Background(), SendMessageInput{
		UserID: botUserID, ConversationID: conversationID, Type: domainchat.MessageText,
		ReplyToID: targetID, IdempotencyKey: "pending-reply", BotPending: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if created.BotReply == nil || created.BotReply.Status != "pending" || !created.BotReply.ThinkingDefaultExpanded || repo.positions[botUserID] != nil {
		t.Fatalf("占位回复不应提前推进已读: %+v", created)
	}
	update := UpdateBotReplyInput{UserID: botUserID, ConversationID: conversationID, MessageID: repo.saved.ID(), Thinking: "正在检查", Status: domainchat.BotReplyThinking, Revision: 1}
	thought, err := svc.UpdateBotReply(context.Background(), update)
	if err != nil || thought.BotReply == nil || thought.BotReply.Thinking != "正在检查" || !thought.BotReply.ThinkingDefaultExpanded || repo.positions[botUserID] != nil {
		t.Fatalf("思考阶段状态或已读错误: %+v %v", thought, err)
	}
	update.Content, update.Status, update.Revision = "第一段", domainchat.BotReplyStreaming, 2
	streaming, err := svc.UpdateBotReply(context.Background(), update)
	if err != nil || streaming.Content != "第一段" {
		t.Fatalf("正文快照错误: %+v %v", streaming, err)
	}
	position := repo.positions[botUserID]
	if position == nil || position.LastMessageID() == nil || !position.LastMessageID().Equal(targetID) {
		t.Fatalf("首段正文出现时应推进引用消息已读: %+v", position)
	}
	bot.SetShowThinking(false, now)
	update.Content, update.Revision, update.Status = "最终回复", 3, domainchat.BotReplyCompleted
	completed, err := svc.UpdateBotReply(context.Background(), update)
	if err != nil || completed.BotReply == nil || completed.BotReply.Thinking != "" || completed.BotReply.Status != "completed" {
		t.Fatalf("关闭展示后应过滤 thinking 且结束 loading: %+v %v", completed, err)
	}
	if _, err := svc.UpdateBotReply(context.Background(), update); err != nil {
		t.Fatalf("相同 revision 的重试应返回现有快照: %v", err)
	}
}
