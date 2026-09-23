package gorm

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
)

// TestBotRepositoryIntegration_DisabledSurvivesColumnDefault 锁住一个只有真库能证的坑：
// chat_bots.enabled 带 DEFAULT TRUE，持久化模型上的 default tag 会让 GORM 建插跳过 false
// 零值，「创建即禁用」的 bot 于是被数据库默认值悄悄改成启用。
func TestBotRepositoryIntegration_DisabledSurvivesColumnDefault(t *testing.T) {
	db := setupIntegrationDB(t)
	repo := NewBotRepository(db, testTokenBox(t))
	ctx := context.Background()
	userID := preseedAuthor(t, db)

	bot, _, err := domainchat.NewBot(domainshared.NewID(), userID, "archived", nil, time.Now())
	require.NoError(t, err)
	bot.Disable(time.Now())
	require.NoError(t, repo.Save(ctx, bot))
	t.Cleanup(func() { _ = repo.Delete(ctx, bot.ID()) })

	got, err := repo.FindByID(ctx, bot.ID())
	require.NoError(t, err)
	require.False(t, got.IsEnabled(), "禁用状态必须真的落库")

	raw := new(string)
	require.NoError(t, db.Raw("SELECT token_hash FROM chat_bots WHERE id = ?", bot.ID()).Scan(raw).Error)
	require.Len(t, *raw, 64, "库里存的是 SHA-256 hex")

	// 真库侧再确认一次明文只以密文形态落地。
	sealed := new(string)
	require.NoError(t, db.Raw("SELECT token_encrypted FROM chat_bots WHERE id = ?", bot.ID()).Scan(sealed).Error)
	require.NotEmpty(t, *sealed, "配了密钥就应存下密文")
	require.NotContains(t, *sealed, bot.Token(), "明文凭据不得出现在库里")
}

func TestBotRepositoryIntegration_UpsertKeepsCreatedAt(t *testing.T) {
	db := setupIntegrationDB(t)
	repo := NewBotRepository(db, testTokenBox(t))
	ctx := context.Background()
	userID := preseedAuthor(t, db)

	created := time.Now().UTC().Add(-48 * time.Hour)
	bot, first, err := domainchat.NewBot(domainshared.NewID(), userID, "echo", nil, created)
	require.NoError(t, err)
	require.NoError(t, repo.Save(ctx, bot))
	t.Cleanup(func() { _ = repo.Delete(ctx, bot.ID()) })

	second, err := bot.RegenerateToken(time.Now())
	require.NoError(t, err)
	require.NoError(t, bot.Rename("echo-v2", time.Now()))
	require.NoError(t, repo.Save(ctx, bot))

	got, err := repo.FindByID(ctx, bot.ID())
	require.NoError(t, err)
	require.Equal(t, "echo-v2", got.Name())
	require.Equal(t, created.UTC().Truncate(time.Microsecond), got.CreatedAt.UTC().Truncate(time.Microsecond))
	require.NotEqual(t, first.Value, second.Value)

	_, err = repo.FindByToken(ctx, domainchat.HashBotToken(first.Value))
	require.ErrorIs(t, err, domainchat.ErrBotNotFound, "整行 upsert 后旧 token 必须查不到")
	rotated, err := repo.FindByToken(ctx, got.TokenHash())
	require.NoError(t, err)
	require.Equal(t, bot.ID(), rotated.ID())
}

func TestBotRepositoryIntegration_TokenHashIsUnique(t *testing.T) {
	db := setupIntegrationDB(t)
	repo := NewBotRepository(db, testTokenBox(t))
	ctx := context.Background()
	userA, userB := preseedAuthor(t, db), preseedAuthor(t, db)

	first, _, err := domainchat.NewBot(domainshared.NewID(), userA, "one", nil, time.Now())
	require.NoError(t, err)
	require.NoError(t, repo.Save(ctx, first))
	t.Cleanup(func() { _ = repo.Delete(ctx, first.ID()) })

	// 手造一行同哈希的 bot：唯一索引必须拒绝，而不是让鉴权反查命中两条。
	clone := domainchat.ReconstructBot(domainshared.NewID(), userB, "two", nil, first.TokenHash(), "", true, false, false, time.Now(), time.Now())
	require.Error(t, repo.Save(ctx, clone), "token_hash 唯一索引应拒绝重复")
}

func TestBotRepositoryIntegration_ListByUserIDsAndPaging(t *testing.T) {
	db := setupIntegrationDB(t)
	repo := NewBotRepository(db, testTokenBox(t))
	ctx := context.Background()

	base := time.Now().UTC().Add(-time.Hour)
	var ids, userIDs []domainshared.ID
	for i := 0; i < 3; i++ {
		userID := preseedAuthor(t, db)
		bot, _, err := domainchat.NewBot(domainshared.NewID(), userID, "bot", nil, base.Add(time.Duration(i)*time.Hour))
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, bot))
		ids = append(ids, bot.ID())
		userIDs = append(userIDs, userID)
	}
	stranger := preseedAuthor(t, db)
	t.Cleanup(func() {
		for _, id := range ids {
			_ = repo.Delete(ctx, id)
		}
	})

	bots, err := repo.ListByUserIDs(ctx, append([]domainshared.ID{stranger}, userIDs...))
	require.NoError(t, err)
	require.Len(t, bots, 3, "非 bot 成员应自然缺席")

	page, err := repo.ListPage(ctx, domainshared.PageQuery{Page: 1, Limit: 2})
	require.NoError(t, err)
	require.GreaterOrEqual(t, page.Total, int64(3))
	require.Len(t, page.Items, 2)
	require.Equal(t, ids[2], page.Items[0].ID(), "最新的 bot 排在首位")
}
