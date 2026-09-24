package chat_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	chat "blog-api/internal/domain/chat"
	shared "blog-api/internal/domain/shared"
)

func TestBotReplyLifecycle(t *testing.T) {
	now := time.Date(2026, 9, 23, 0, 0, 0, 0, time.UTC)
	message, err := chat.NewPendingBotMessage(shared.NewID(), shared.NewID(), "bot-reply-1", now, nil)
	require.NoError(t, err)
	require.Empty(t, message.Content())
	require.Equal(t, chat.BotReplyPending, message.BotReply().Status())

	require.NoError(t, message.AdvanceBotReply("", "先检查输入", chat.BotReplyThinking, 1, now.Add(time.Second)))
	require.NoError(t, message.AdvanceBotReply("第一段", "先检查输入", chat.BotReplyStreaming, 2, now.Add(2*time.Second)))
	require.Error(t, message.AdvanceBotReply("旧段落", "", chat.BotReplyStreaming, 1, now.Add(3*time.Second)))
	require.Equal(t, "第一段", message.Content())
	require.Error(t, message.AdvanceBotReply("", "", chat.BotReplyCompleted, 3, now.Add(3*time.Second)))
	require.NoError(t, message.AdvanceBotReply("最终回复", "先检查输入", chat.BotReplyCompleted, 3, now.Add(3*time.Second)))
	require.Error(t, message.AdvanceBotReply("迟到的增量", "", chat.BotReplyStreaming, 4, now.Add(4*time.Second)))
	require.Equal(t, "最终回复", message.Content())
	require.EqualValues(t, 3, message.BotReply().Revision())
}

func TestBotReplyCanFailWithoutContent(t *testing.T) {
	now := time.Now()
	message, err := chat.NewPendingBotMessage(shared.NewID(), shared.NewID(), "bot-reply-2", now, nil)
	require.NoError(t, err)
	require.NoError(t, message.AdvanceBotReply("", "", chat.BotReplyFailed, 1, now))
	require.Equal(t, chat.BotReplyFailed, message.BotReply().Status())
}
