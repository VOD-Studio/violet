package chat_test

import (
	"strings"
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

	require.NoError(t, message.AdvanceBotReply("", "先检查输入", nil, chat.BotReplyThinking, 1, now.Add(time.Second)))
	require.NoError(t, message.AdvanceBotReply("第一段", "先检查输入", nil, chat.BotReplyStreaming, 2, now.Add(2*time.Second)))
	require.Error(t, message.AdvanceBotReply("旧段落", "", nil, chat.BotReplyStreaming, 1, now.Add(3*time.Second)))
	require.Equal(t, "第一段", message.Content())
	require.Error(t, message.AdvanceBotReply("", "", nil, chat.BotReplyCompleted, 3, now.Add(3*time.Second)))
	require.NoError(t, message.AdvanceBotReply("最终回复", "先检查输入", nil, chat.BotReplyCompleted, 3, now.Add(3*time.Second)))
	require.Error(t, message.AdvanceBotReply("迟到的增量", "", nil, chat.BotReplyStreaming, 4, now.Add(4*time.Second)))
	require.Equal(t, "最终回复", message.Content())
	require.EqualValues(t, 3, message.BotReply().Revision())
}

func TestBotReplyCanFailWithoutContent(t *testing.T) {
	now := time.Now()
	message, err := chat.NewPendingBotMessage(shared.NewID(), shared.NewID(), "bot-reply-2", now, nil)
	require.NoError(t, err)
	require.NoError(t, message.AdvanceBotReply("", "", nil, chat.BotReplyFailed, 1, now))
	require.Equal(t, chat.BotReplyFailed, message.BotReply().Status())
}

func TestNormalizeBotToolCallsDefaultsAndCopies(t *testing.T) {
	in := []chat.BotToolCall{
		{ID: " call_1 ", Name: " web_search ", Arguments: `{"q":"x"}`},
		{Name: "fetch_url", Status: chat.BotToolCallRunning, Result: "ok", DurationMS: 12},
	}
	out, err := chat.NormalizeBotToolCalls(in)
	require.NoError(t, err)
	require.Equal(t, []chat.BotToolCall{
		{ID: "call_1", Name: "web_search", Status: chat.BotToolCallCompleted, Arguments: `{"q":"x"}`},
		{Name: "fetch_url", Status: chat.BotToolCallRunning, Result: "ok", DurationMS: 12},
	}, out)
	require.Equal(t, " call_1 ", in[0].ID, "规范化不得修改入参")
	out[0].Name = "mutated"
	require.Equal(t, " web_search ", in[0].Name, "返回切片应与入参隔离")

	empty, err := chat.NormalizeBotToolCalls(nil)
	require.NoError(t, err)
	require.NotNil(t, empty)
	require.Empty(t, empty)
}

func TestNormalizeBotToolCallsRejectsInvalidValues(t *testing.T) {
	many := make([]chat.BotToolCall, chat.MaxBotToolCalls+1)
	for i := range many {
		many[i] = chat.BotToolCall{Name: "web_search"}
	}
	tooManyFieldCalls := make([]chat.BotToolCall, 9)
	for i := range tooManyFieldCalls {
		tooManyFieldCalls[i] = chat.BotToolCall{Name: "web_search", Arguments: strings.Repeat("a", chat.MaxBotToolCallTextLength)}
	}

	cases := []struct {
		name  string
		calls []chat.BotToolCall
	}{
		{"超过调用数上限", many},
		{"工具名为空", []chat.BotToolCall{{Name: "   "}}},
		{"工具名过长", []chat.BotToolCall{{Name: strings.Repeat("a", chat.MaxBotToolCallNameLength+1)}}},
		{"ID 过长", []chat.BotToolCall{{ID: strings.Repeat("a", chat.MaxBotToolCallIDLength+1), Name: "web_search"}}},
		{"ID 重复", []chat.BotToolCall{{ID: "call_1", Name: "web_search"}, {ID: "call_1", Name: "fetch_url"}}},
		{"状态无效", []chat.BotToolCall{{Name: "web_search", Status: "queued"}}},
		{"参数过长", []chat.BotToolCall{{Name: "web_search", Arguments: strings.Repeat("a", chat.MaxBotToolCallTextLength+1)}}},
		{"结果过长", []chat.BotToolCall{{Name: "web_search", Result: strings.Repeat("a", chat.MaxBotToolCallTextLength+1)}}},
		{"错误过长", []chat.BotToolCall{{Name: "web_search", Error: strings.Repeat("a", chat.MaxBotToolCallTextLength+1)}}},
		{"耗时负数", []chat.BotToolCall{{Name: "web_search", DurationMS: -1}}},
		{"耗时超上限", []chat.BotToolCall{{Name: "web_search", DurationMS: chat.MaxBotToolCallDurationMS + 1}}},
		{"序列化超上限", tooManyFieldCalls},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := chat.NormalizeBotToolCalls(tc.calls)
			require.Error(t, err)
		})
	}

	allowed := []chat.BotToolCall{{Name: "web_search", DurationMS: chat.MaxBotToolCallDurationMS}, {Name: "fetch_url", Status: chat.BotToolCallFailed, Error: "boom"}}
	_, err := chat.NormalizeBotToolCalls(allowed)
	require.NoError(t, err)
}

func TestBotReplySnapshotPersistsToolCalls(t *testing.T) {
	now := time.Date(2026, 9, 23, 0, 0, 0, 0, time.UTC)
	message, err := chat.NewPendingBotMessage(shared.NewID(), shared.NewID(), "bot-calls", now, nil)
	require.NoError(t, err)
	calls := []chat.BotToolCall{{ID: "call_1", Name: "web_search", Status: chat.BotToolCallRunning}}
	require.NoError(t, message.AdvanceBotReply("", "", calls, chat.BotReplyThinking, 1, now.Add(time.Second)))
	require.Equal(t, calls, message.BotReply().ToolCalls())

	stored := message.BotReply().ToolCalls()
	stored[0].Name = "mutated"
	require.Equal(t, "web_search", message.BotReply().ToolCalls()[0].Name, "快照读取应返回副本")

	require.NoError(t, message.AdvanceBotReply("", "", nil, chat.BotReplyThinking, 2, now.Add(2*time.Second)))
	require.Empty(t, message.BotReply().ToolCalls(), "空列表应清空已存调用")
	require.Error(t, message.AdvanceBotReply("", "", []chat.BotToolCall{{Name: ""}}, chat.BotReplyThinking, 3, now.Add(3*time.Second)))
}

func TestBotReplyReconstructsToolCalls(t *testing.T) {
	now := time.Date(2026, 9, 23, 0, 0, 0, 0, time.UTC)
	calls := []chat.BotToolCall{{ID: "call_1", Name: "web_search", Status: chat.BotToolCallCompleted, Arguments: `{"q":"x"}`, Result: "ok", DurationMS: 9}}
	reply := chat.ReconstructBotReply(chat.BotReplyCompleted, "思考", calls, 7, now)
	message := chat.ReconstructMessage(shared.NewID(), shared.NewID(), shared.NewID(), chat.MessageText, "正文", nil, nil, nil, "idem", nil, nil, nil, reply, now, now)
	require.Equal(t, chat.BotReplyCompleted, message.BotReply().Status())
	require.Equal(t, "思考", message.BotReply().Thinking())
	require.EqualValues(t, 7, message.BotReply().Revision())
	require.Equal(t, calls, message.BotReply().ToolCalls())
}
