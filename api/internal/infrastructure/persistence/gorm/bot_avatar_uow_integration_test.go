package gorm

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	appchat "blog-api/internal/application/chat"
	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
)

func TestBotAvatarUnitOfWorkIntegrationRollsBackProfileAndReference(t *testing.T) {
	db := setupIntegrationDB(t)
	ctx := context.Background()
	box := testTokenBox(t)
	bots := NewBotRepository(db, box)
	users := NewUserRepository(db)
	files := NewFileRepository(db)
	userID := preseedAuthor(t, db)
	bot, _, err := domainchat.NewBot(domainshared.NewID(), userID, "avatar bot", nil, time.Now())
	require.NoError(t, err)
	require.NoError(t, bots.Save(ctx, bot))
	user, err := users.FindByID(ctx, userID)
	require.NoError(t, err)
	user.UpdateAvatarURL("/uploads/old.png")
	require.NoError(t, users.Save(ctx, user))
	file, err := domainupload.NewFile(domainshared.NewID(), userID, domainupload.PurposeAvatar, "new.png", "/new.png", "/uploads/new.png", 1, "image/png", "hash")
	require.NoError(t, err)
	require.NoError(t, files.Save(ctx, file))
	id := file.ID().String()
	uow := NewBotAvatarUnitOfWork(db, box)
	failure := errors.New("failure after profile writes")
	err = uow.Do(ctx, bot.ID(), func(tx appchat.BotAvatarTransaction) error {
		service := appchat.NewBotService(tx.Bots(), tx.Users(), tx.Files(), nil, nil)
		_, err := service.UpdateBot(ctx, appchat.UpdateBotInput{ID: bot.ID(), AvatarID: &id})
		if err != nil {
			return err
		}
		if err := tx.Files().UpdateRefCount(ctx, file.ID(), 1); err != nil {
			return err
		}
		return failure
	})
	require.ErrorIs(t, err, failure)
	storedBot, err := bots.FindByID(ctx, bot.ID())
	require.NoError(t, err)
	require.Nil(t, storedBot.AvatarID())
	storedUser, err := users.FindByID(ctx, userID)
	require.NoError(t, err)
	require.Equal(t, "/uploads/old.png", storedUser.AvatarURL())
	storedFile, err := files.FindByID(ctx, file.ID())
	require.NoError(t, err)
	require.Zero(t, storedFile.RefCount())

	err = uow.Do(ctx, bot.ID(), func(tx appchat.BotAvatarTransaction) error {
		service := appchat.NewBotService(tx.Bots(), tx.Users(), tx.Files(), nil, nil)
		_, err := service.UpdateBot(ctx, appchat.UpdateBotInput{ID: bot.ID(), AvatarID: &id})
		if err != nil {
			return err
		}
		return tx.Files().UpdateRefCount(ctx, file.ID(), 1)
	})
	require.NoError(t, err)
	storedBot, err = bots.FindByID(ctx, bot.ID())
	require.NoError(t, err)
	require.Equal(t, file.ID(), *storedBot.AvatarID())
	storedUser, err = users.FindByID(ctx, userID)
	require.NoError(t, err)
	require.Equal(t, file.URL(), storedUser.AvatarURL())
	storedFile, err = files.FindByID(ctx, file.ID())
	require.NoError(t, err)
	require.Equal(t, 1, storedFile.RefCount())
}
