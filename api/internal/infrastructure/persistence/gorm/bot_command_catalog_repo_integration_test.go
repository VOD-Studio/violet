package gorm

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
)

func TestBotCommandCatalogRepositoryIntegration_ReplaceAndCascade(t *testing.T) {
	db := setupIntegrationDB(t)
	ctx := context.Background()
	botRepo := NewBotRepository(db, testTokenBox(t))
	bot, _, err := domainchat.NewBot(domainshared.NewID(), preseedAuthor(t, db), "Saber", nil, time.Now())
	require.NoError(t, err)
	require.NoError(t, botRepo.Save(ctx, bot))
	t.Cleanup(func() { _ = botRepo.Delete(ctx, bot.ID()) })

	repo := NewBotCommandCatalogRepository(db)
	first, err := domainchat.NewBotCommandCatalog(bot.ID(), 1, []domainchat.BotCommand{
		{ID: "task.list", Path: []string{"task", "list"}, Description: "查看任务", Scope: "conversation"},
	}, time.Now().UTC().Add(-time.Hour))
	require.NoError(t, err)
	require.NoError(t, repo.Replace(ctx, first))
	again := first
	again.UpdatedAt = time.Now().UTC()
	require.NoError(t, repo.Replace(ctx, again))
	catalogs, err := repo.ListByBotIDs(ctx, []domainshared.ID{bot.ID()})
	require.NoError(t, err)
	require.Equal(t, first.Revision, catalogs[bot.ID()].Revision)
	require.Equal(t, first.UpdatedAt.Truncate(time.Microsecond), catalogs[bot.ID()].UpdatedAt.UTC().Truncate(time.Microsecond))

	empty, err := domainchat.NewBotCommandCatalog(bot.ID(), 1, nil, time.Now().UTC())
	require.NoError(t, err)
	require.NoError(t, repo.Replace(ctx, empty))
	catalogs, err = repo.ListByBotIDs(ctx, []domainshared.ID{bot.ID()})
	require.NoError(t, err)
	require.Empty(t, catalogs[bot.ID()].Commands)
	require.NotEqual(t, first.Revision, catalogs[bot.ID()].Revision)

	require.NoError(t, botRepo.Delete(ctx, bot.ID()))
	catalogs, err = repo.ListByBotIDs(ctx, []domainshared.ID{bot.ID()})
	require.NoError(t, err)
	require.Empty(t, catalogs)
}
