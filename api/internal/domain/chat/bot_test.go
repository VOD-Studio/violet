package chat_test

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/chat"
	"blog-api/internal/domain/shared"
)

func TestNewBotGeneratesTokenAndHash(t *testing.T) {
	now := time.Date(2026, 9, 22, 10, 0, 0, 0, time.UTC)
	id := shared.NewID()
	userID := shared.NewID()

	b, token, err := chat.NewBot(id, userID, "Saber", nil, now)
	require.NoError(t, err)
	require.NotEmpty(t, token.Value, "明文 token 必须返回")
	require.True(t, strings.HasPrefix(token.Value, "violet_bot_"), "token 需带前缀便于识别")

	require.Equal(t, id, b.ID())
	require.Equal(t, userID, b.UserID())
	require.Equal(t, "Saber", b.Name())
	require.Nil(t, b.AvatarID())
	require.True(t, b.IsEnabled(), "新建 bot 默认启用")

	// 哈希是 SHA-256 hex（64 字符），且不等于明文。
	expected := sha256.Sum256([]byte(token.Value))
	require.Equal(t, hex.EncodeToString(expected[:]), b.TokenHash())
	require.NotEqual(t, token.Value, b.TokenHash())
	require.Len(t, b.TokenHash(), 64)
	// 明文留在聚合上供持久层加密保存：拿不到它就存不出可回看的凭据。
	require.Equal(t, token.Value, b.Token())

	// 创建事件已记录。
	require.True(t, b.HasEvents(), "NewBot 应记录 BotCreated 事件")
}

func TestNewBotProducesUniqueTokens(t *testing.T) {
	now := time.Now()
	tokens := make(map[string]struct{}, 10)
	for i := 0; i < 10; i++ {
		_, token, err := chat.NewBot(shared.NewID(), shared.NewID(), "bot", nil, now)
		require.NoError(t, err)
		tokens[token.Value] = struct{}{}
	}
	require.Len(t, tokens, 10, "10 次生成必须产出 10 个互异 token")
}

func TestReconstructBotPreservesFieldsAndNoEvents(t *testing.T) {
	created := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	updated := time.Date(2026, 9, 10, 0, 0, 0, 0, time.UTC)
	id := shared.NewID()
	userID := shared.NewID()
	avatar := shared.NewID()

	b := chat.ReconstructBot(id, userID, "Saber", &avatar, "deadbeef", "violet_bot_plain", false, false, created, updated)
	require.Equal(t, id, b.ID())
	require.Equal(t, userID, b.UserID())
	require.Equal(t, "Saber", b.Name())
	require.Equal(t, &avatar, b.AvatarID())
	require.Equal(t, "deadbeef", b.TokenHash())
	require.Equal(t, "violet_bot_plain", b.Token())
	require.False(t, b.IsEnabled())
	require.Equal(t, created, b.CreatedAt)
	require.Equal(t, updated, b.UpdatedAt)
	require.False(t, b.HasEvents(), "重建不应记录事件")
}

func TestRegenerateTokenReplacesHashAndRecordsEvent(t *testing.T) {
	now := time.Date(2026, 9, 22, 10, 0, 0, 0, time.UTC)
	b, original, err := chat.NewBot(shared.NewID(), shared.NewID(), "Saber", nil, now)
	require.NoError(t, err)
	oldHash := b.TokenHash()

	b.PullEvents() // 清掉创建事件，只观察重置事件

	later := now.Add(time.Hour)
	newToken, err := b.RegenerateToken(later)
	require.NoError(t, err)
	require.NotEqual(t, original.Value, newToken.Value, "新明文必须不同于旧明文")
	require.NotEqual(t, oldHash, b.TokenHash(), "哈希必须替换")
	require.Equal(t, newToken.Value, b.Token(), "聚合上的明文必须跟着换成新 token")

	// 新明文与新哈希一致。
	expected := sha256.Sum256([]byte(newToken.Value))
	require.Equal(t, hex.EncodeToString(expected[:]), b.TokenHash())

	// 旧明文不再匹配当前哈希——旧 token 失效。
	require.NotEqual(t, b.TokenHash(), hashHex(original.Value), "当前哈希不再匹配旧明文——旧 token 失效")

	require.Equal(t, later, b.UpdatedAt)
	events := b.PullEvents()
	require.Len(t, events, 1, "RegenerateToken 记录一条事件")
}

func TestEnableDisableIsIdempotentAndRecordsEvents(t *testing.T) {
	now := time.Date(2026, 9, 22, 10, 0, 0, 0, time.UTC)
	b, _, err := chat.NewBot(shared.NewID(), shared.NewID(), "Saber", nil, now)
	require.NoError(t, err)
	b.PullEvents() // 清掉创建事件

	// 已启用再 Enable：幂等空操作，无事件。
	b.Enable(now.Add(time.Hour))
	require.True(t, b.IsEnabled())
	require.Len(t, b.PullEvents(), 0, "已启用再 Enable 不记事件")

	// Disable：记录事件。
	b.Disable(now.Add(2 * time.Hour))
	require.False(t, b.IsEnabled())
	require.Len(t, b.PullEvents(), 1, "Disable 记录一条事件")

	// 已禁用再 Disable：幂等空操作。
	b.Disable(now.Add(3 * time.Hour))
	require.False(t, b.IsEnabled())
	require.Len(t, b.PullEvents(), 0, "已禁用再 Disable 不记事件")

	// Enable：记录事件。
	b.Enable(now.Add(4 * time.Hour))
	require.True(t, b.IsEnabled())
	require.Len(t, b.PullEvents(), 1, "Enable 记录一条事件")
}

func hashHex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

func TestNewBotNormalizesName(t *testing.T) {
	now := time.Now()

	t.Run("trims surrounding space", func(t *testing.T) {
		b, _, err := chat.NewBot(shared.NewID(), shared.NewID(), "   Saber  ", nil, now)
		require.NoError(t, err)
		require.Equal(t, "Saber", b.Name())
	})

	t.Run("rejects blank", func(t *testing.T) {
		_, _, err := chat.NewBot(shared.NewID(), shared.NewID(), "   ", nil, now)
		require.Error(t, err)
	})

	t.Run("counts runes not bytes", func(t *testing.T) {
		name := strings.Repeat("诗", chat.MaxBotNameLength)
		_, _, err := chat.NewBot(shared.NewID(), shared.NewID(), name, nil, now)
		require.NoError(t, err, "32 个汉字应通过")
		_, _, err = chat.NewBot(shared.NewID(), shared.NewID(), name+"诗", nil, now)
		require.Error(t, err, "33 个汉字应拒绝")
	})
}

func TestBotRenameRecordsEventOnlyOnRealChange(t *testing.T) {
	b, _, err := chat.NewBot(shared.NewID(), shared.NewID(), "Saber", nil, time.Now())
	require.NoError(t, err)
	b.PullEvents()

	require.NoError(t, b.Rename("Saber", time.Now()))
	require.False(t, b.HasEvents(), "同名重命名不应记事件")

	require.NoError(t, b.Rename("  Lancer  ", time.Now()))
	events := b.PullEvents()
	require.Len(t, events, 1)
	renamed, ok := events[0].(chat.BotRenamed)
	require.True(t, ok)
	require.Equal(t, "Saber", renamed.From)
	require.Equal(t, "Lancer", renamed.To)
	require.Equal(t, "Lancer", b.Name())

	require.Error(t, b.Rename("  ", time.Now()), "空名必须拒绝且不改动状态")
	require.Equal(t, "Lancer", b.Name())
}

func TestBotSetAvatarTracksChangeAndClear(t *testing.T) {
	avatar := shared.NewID()
	now := time.Now()
	b, _, err := chat.NewBot(shared.NewID(), shared.NewID(), "Saber", &avatar, now)
	require.NoError(t, err)
	b.PullEvents()

	b.SetAvatar(&avatar, now)
	require.False(t, b.HasEvents(), "同头像幂等")

	other := shared.NewID()
	b.SetAvatar(&other, now)
	updated, ok := b.PullEvents()[0].(chat.BotAvatarUpdated)
	require.True(t, ok)
	require.Equal(t, other.String(), updated.AvatarID)
	require.Equal(t, other, *b.AvatarID())

	b.SetAvatar(nil, now)
	require.Nil(t, b.AvatarID(), "传 nil 清除头像")
	cleared, ok := b.PullEvents()[0].(chat.BotAvatarUpdated)
	require.True(t, ok)
	require.Empty(t, cleared.AvatarID, "清除头像时事件里的 ID 为空串")
}
