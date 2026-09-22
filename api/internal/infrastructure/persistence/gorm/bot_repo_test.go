package gorm

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

func newBotRepoDB(t *testing.T) *BotRepository {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "bot.db")), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.ChatBot{}))
	return NewBotRepository(db)
}

func newTestBot(t *testing.T, name string, avatarID *domainshared.ID, enabled bool) *domainchat.Bot {
	t.Helper()
	now := time.Now().UTC().Truncate(time.Second)
	botID, userID := domainshared.NewID(), domainshared.NewID()
	bot, _, err := domainchat.NewBot(botID, userID, name, avatarID, now)
	require.NoError(t, err)
	if !enabled {
		bot.Disable(now)
	}
	return bot
}

func TestBotRepositorySaveAndFindByID(t *testing.T) {
	repo := newBotRepoDB(t)
	ctx := context.Background()
	avatarID := domainshared.NewID()
	bot := newTestBot(t, " Saber ", &avatarID, true)
	require.NoError(t, repo.Save(ctx, bot))

	got, err := repo.FindByID(ctx, bot.ID())
	require.NoError(t, err)
	require.Equal(t, bot.ID(), got.ID())
	require.Equal(t, bot.UserID(), got.UserID())
	require.Equal(t, " Saber ", got.Name(), "名称规范化在领域层，仓储原样往返")
	require.Equal(t, avatarID, *got.AvatarID())
	require.Equal(t, bot.TokenHash(), got.TokenHash())
	require.True(t, got.IsEnabled())
}

func TestBotRepositoryPersistsDisabledWithoutDefaultTag(t *testing.T) {
	// enabled 无 gorm default tag：false 必须真的写进去，不能被列默认值翻成 true。
	repo := newBotRepoDB(t)
	ctx := context.Background()
	bot := newTestBot(t, "archived-bot", nil, false)
	require.NoError(t, repo.Save(ctx, bot))

	got, err := repo.FindByID(ctx, bot.ID())
	require.NoError(t, err)
	require.False(t, got.IsEnabled())
	require.Nil(t, got.AvatarID())
}

func TestBotRepositoryFindTokenAndUserID(t *testing.T) {
	repo := newBotRepoDB(t)
	ctx := context.Background()
	now := time.Now()
	botID, userID := domainshared.NewID(), domainshared.NewID()
	bot, token, err := domainchat.NewBot(botID, userID, "echo", nil, now)
	require.NoError(t, err)
	require.NoError(t, repo.Save(ctx, bot))

	byToken, err := repo.FindByToken(ctx, bot.TokenHash())
	require.NoError(t, err)
	require.Equal(t, botID, byToken.ID())
	require.NotEqual(t, token.Value, byToken.TokenHash(), "库里存的必须是哈希而非明文")

	byUser, err := repo.FindByUserID(ctx, userID)
	require.NoError(t, err)
	require.Equal(t, botID, byUser.ID())

	_, err = repo.FindByToken(ctx, "deadbeef")
	require.ErrorIs(t, err, domainchat.ErrBotNotFound)
	_, err = repo.FindByID(ctx, domainshared.NewID())
	require.ErrorIs(t, err, domainchat.ErrBotNotFound)
}

func TestBotRepositorySaveUpdatesInPlace(t *testing.T) {
	repo := newBotRepoDB(t)
	ctx := context.Background()
	bot := newTestBot(t, "before", nil, true)
	require.NoError(t, repo.Save(ctx, bot))
	createdAt := bot.CreatedAt

	bot.Disable(time.Now())
	require.NoError(t, repo.Save(ctx, bot))

	got, err := repo.FindByID(ctx, bot.ID())
	require.NoError(t, err)
	require.False(t, got.IsEnabled())
	require.Equal(t, createdAt, got.CreatedAt, "整行 upsert 不应改写 created_at")
}

func TestBotRepositoryListByUserIDsSkipsNonBots(t *testing.T) {
	repo := newBotRepoDB(t)
	ctx := context.Background()
	bot := newTestBot(t, "one", nil, true)
	require.NoError(t, repo.Save(ctx, bot))

	got, err := repo.ListByUserIDs(ctx, []domainshared.ID{domainshared.NewID(), bot.UserID()})
	require.NoError(t, err)
	require.Len(t, got, 1)
	require.Equal(t, bot.ID(), got[0].ID())

	empty, err := repo.ListByUserIDs(ctx, nil)
	require.NoError(t, err)
	require.Empty(t, empty)
}

func TestBotRepositoryListPageOrdersByCreatedAtDesc(t *testing.T) {
	repo := newBotRepoDB(t)
	ctx := context.Background()
	base := time.Now().UTC().Truncate(time.Second)
	var ids []domainshared.ID
	for i := 0; i < 3; i++ {
		bot, _, err := domainchat.NewBot(domainshared.NewID(), domainshared.NewID(), "bot", nil, base.Add(time.Duration(i)*time.Hour))
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, bot))
		ids = append(ids, bot.ID())
	}

	page, err := repo.ListPage(ctx, domainshared.PageQuery{Page: 1, Limit: 2})
	require.NoError(t, err)
	require.EqualValues(t, 3, page.Total)
	require.Len(t, page.Items, 2)
	require.Equal(t, ids[2], page.Items[0].ID(), "最新的 bot 排在首位")
	require.Equal(t, ids[1], page.Items[1].ID())

	second, err := repo.ListPage(ctx, domainshared.PageQuery{Page: 2, Limit: 2})
	require.NoError(t, err)
	require.Len(t, second.Items, 1)
	require.Equal(t, ids[0], second.Items[0].ID())
}

func TestBotRepositoryDelete(t *testing.T) {
	repo := newBotRepoDB(t)
	ctx := context.Background()
	bot := newTestBot(t, "temp", nil, true)
	require.NoError(t, repo.Save(ctx, bot))
	require.NoError(t, repo.Delete(ctx, bot.ID()))

	_, err := repo.FindByID(ctx, bot.ID())
	require.ErrorIs(t, err, domainchat.ErrBotNotFound)
	require.ErrorIs(t, repo.Delete(ctx, bot.ID()), domainchat.ErrBotNotFound, "重复删除返回 NotFound")
}
