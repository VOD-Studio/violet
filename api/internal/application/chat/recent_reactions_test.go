package chat_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	appchat "blog-api/internal/application/chat"
	domainchat "blog-api/internal/domain/chat"
	domainchatreaction "blog-api/internal/domain/chatreaction"
	domainshared "blog-api/internal/domain/shared"
	persistence "blog-api/internal/infrastructure/persistence/gorm"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

func TestListMessagesIncludesRecentReactionsFromStorage(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "reactions.db")), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Emoji{}, &model.ChatMessageReaction{}))
	require.NoError(t, db.Create(&model.Emoji{
		ID: 42, Name: "[笑]", URL: "/smile.png", GifURL: "/smile.gif",
	}).Error)

	conversationID := domainshared.NewID()
	viewerID := domainshared.NewID()
	createdAt := time.Date(2026, 11, 11, 10, 0, 0, 0, time.UTC)
	message, err := domainchat.NewTextMessage(conversationID, viewerID, "hello", "message", createdAt, nil)
	require.NoError(t, err)
	userIDs := []uuid.UUID{viewerID.UUID(), uuid.New(), uuid.New(), uuid.New()}
	for index, name := range []string{"Alice", "林间", "雾里", "Momo"} {
		userID := userIDs[index]
		require.NoError(t, db.Create(&model.User{
			BaseModel: model.BaseModel{ID: userID}, Username: name,
			Email: userID.String() + "@test", PasswordHash: "x",
		}).Error)
		require.NoError(t, db.Create(&model.ChatMessageReaction{
			ID: uuid.New(), MessageID: message.ID().UUID(), EmojiID: 42, UserID: userID,
			CreatedAt: createdAt.Add(time.Duration(index) * time.Minute),
		}).Error)
	}

	svc, setMessages := appchat.NewReactionServiceForTest(t, message, viewerID, conversationID, persistence.NewChatMessageReactionStore(db))
	setMessages([]*domainchat.Message{message})
	result, err := svc.ListMessages(context.Background(), viewerID, conversationID, "", 20)
	require.NoError(t, err)
	require.Len(t, result.Items, 1)
	require.Len(t, result.Items[0].Reactions, 1)
	reaction := result.Items[0].Reactions[0]
	require.Equal(t, int64(4), reaction.Count)
	require.True(t, reaction.Self, "self 不受最近三人名单截断影响")
	require.Equal(t, "[笑]", reaction.EmojiName)
	require.Equal(t, "/smile.png", reaction.EmojiURL)
	require.Equal(t, "/smile.gif", reaction.GifURL)
	require.Equal(t, []domainchatreaction.RecentUser{
		{ID: userIDs[3].String(), Name: "Momo"},
		{ID: userIDs[2].String(), Name: "雾里"},
		{ID: userIDs[1].String(), Name: "林间"},
	}, reaction.RecentUsers)

	direct, err := svc.ListMessageReactions(context.Background(), viewerID, conversationID, message.ID())
	require.NoError(t, err)
	require.Equal(t, result.Items[0].Reactions, direct)
}
