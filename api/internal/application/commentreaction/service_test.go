package commentreaction_test

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	appcr "blog-api/internal/application/commentreaction"
	domaincr "blog-api/internal/domain/commentreaction"
	persistence "blog-api/internal/infrastructure/persistence/gorm"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

func TestService_RecentUsersAvailableToAnonymousViewer(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "reactions.db")), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Emoji{}, &model.CommentReaction{}))
	require.NoError(t, db.Create(&model.Emoji{ID: 1, Name: "赞", URL: "/like.png"}).Error)

	commentID := uuid.New()
	userIDs := []uuid.UUID{uuid.New(), uuid.New(), uuid.New(), uuid.New()}
	createdAt := time.Date(2026, 11, 11, 10, 0, 0, 0, time.UTC)
	for index, name := range []string{"最早", "林间", "雾里", "Momo"} {
		userID := userIDs[index]
		require.NoError(t, db.Create(&model.User{
			BaseModel: model.BaseModel{ID: userID}, Username: name,
			Email: userID.String() + "@test", PasswordHash: "x",
		}).Error)
		require.NoError(t, db.Create(&model.CommentReaction{
			ID: uuid.New(), CommentID: commentID, EmojiID: 1, UserID: &userID,
			CreatedAt: createdAt.Add(time.Duration(index) * time.Minute),
		}).Error)
	}
	require.NoError(t, db.Create(&model.CommentReaction{
		ID: uuid.New(), CommentID: commentID, EmojiID: 1, IPHash: "anonymous",
		CreatedAt: createdAt.Add(10 * time.Minute),
	}).Error)

	svc := appcr.NewService(persistence.NewCommentReactionStore(db))
	list, err := svc.List(context.Background(), commentID.String(), "")
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.Equal(t, int64(5), list[0].Count)
	require.False(t, list[0].Self)
	require.Equal(t, []domaincr.RecentUser{
		{ID: userIDs[3].String(), Name: "Momo"},
		{ID: userIDs[2].String(), Name: "雾里"},
		{ID: userIDs[1].String(), Name: "林间"},
	}, list[0].RecentUsers)

	batch, err := svc.Batch(context.Background(), []string{commentID.String()}, userIDs[0].String())
	require.NoError(t, err)
	require.Equal(t, list[0].RecentUsers, batch[0].Reactions[0].RecentUsers)
	require.True(t, batch[0].Reactions[0].Self, "self 不受最近三人名单截断影响")
}

type unavailableStore struct {
	domaincr.CommentReactionStore
	err error
}

func (store unavailableStore) ListByComment(context.Context, string, string) ([]domaincr.AggregatedReaction, error) {
	return nil, store.err
}

func TestService_List_PropagatesStoreError(t *testing.T) {
	wantErr := errors.New("store unavailable")
	svc := appcr.NewService(unavailableStore{err: wantErr})
	_, err := svc.List(context.Background(), "c-1", "")
	require.ErrorIs(t, err, wantErr)
}
