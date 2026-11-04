package chat

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
)

func newBotToolCallService(t *testing.T) (*Service, *botReadRepo, domainshared.ID, domainshared.ID) {
	t.Helper()
	svc, repo, conversationID, _, botUserID, targetID := newBotReadService(t)
	now := time.Date(2026, 9, 23, 12, 0, 0, 0, time.UTC)
	bot, _, err := domainchat.NewBot(domainshared.NewID(), botUserID, "Saber", nil, now)
	if err != nil {
		t.Fatal(err)
	}
	botRepo := newFakeBotRepo()
	botRepo.bots[bot.ID()] = bot
	svc.WithBotRepository(botRepo)
	if _, err := svc.SendBotMessage(context.Background(), SendMessageInput{
		UserID: botUserID, ConversationID: conversationID, Type: domainchat.MessageText,
		ReplyToID: targetID, IdempotencyKey: "tool-calls", BotPending: true,
	}); err != nil {
		t.Fatal(err)
	}
	return svc, repo, conversationID, botUserID
}

func TestUpdateBotReplyStoresToolCalls(t *testing.T) {
	svc, repo, conversationID, botUserID := newBotToolCallService(t)
	ctx := context.Background()
	calls := []domainchat.BotToolCall{{ID: " call_1 ", Name: " web_search ", Arguments: `{"q":"x"}`}}
	in := UpdateBotReplyInput{
		UserID: botUserID, ConversationID: conversationID, MessageID: repo.saved.ID(),
		ToolCalls: calls, Status: domainchat.BotReplyStreaming, Revision: 1,
	}

	dto, err := svc.UpdateBotReply(ctx, in)
	require.NoError(t, err)
	require.Equal(t, []BotToolCallDTO{{ID: "call_1", Name: "web_search", Status: "completed", Arguments: `{"q":"x"}`}}, dto.BotReply.ToolCalls)
	require.Equal(t, []domainchat.BotToolCall{{ID: "call_1", Name: "web_search", Status: domainchat.BotToolCallCompleted, Arguments: `{"q":"x"}`}}, repo.saved.BotReply().ToolCalls())

	retried, err := svc.UpdateBotReply(ctx, in)
	require.NoError(t, err, "规范化后相同的重试应按同一快照幂等返回")
	require.EqualValues(t, 1, retried.BotReply.Revision)
	require.Equal(t, dto.BotReply.ToolCalls, retried.BotReply.ToolCalls)

	in.Revision, in.ToolCalls = 2, nil
	cleared, err := svc.UpdateBotReply(ctx, in)
	require.NoError(t, err)
	require.Empty(t, cleared.BotReply.ToolCalls)
	require.Empty(t, repo.saved.BotReply().ToolCalls())

	changed := in
	changed.ToolCalls = []domainchat.BotToolCall{{ID: "call_2", Name: "fetch_url"}}
	_, err = svc.UpdateBotReply(ctx, changed)
	require.Error(t, err, "同版本但调用不同不应被当成同一快照")
	require.True(t, domainshared.IsDomainError(err, domainshared.CodeConflict))
}
