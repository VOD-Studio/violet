package gorm

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

	domainchatreaction "blog-api/internal/domain/chatreaction"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

func setupChatReactionTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "test.db")), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.ChatMessage{}, &model.Emoji{}, &model.ChatMessageReaction{}))
	return db
}

func TestChatMessageReactionStore_AddEnforcesPerUserLimit(t *testing.T) {
	db := setupChatReactionTestDB(t)
	store := NewChatMessageReactionStore(db)
	messageID := uuid.New()
	userID := uuid.New()
	require.NoError(t, db.Create(&model.ChatMessage{
		ID: messageID, ConversationID: uuid.New(), SenderID: userID, MessageType: "text",
		Content: "hello", IdempotencyKey: "message-1", CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}).Error)

	for emojiID := int32(1); emojiID <= 3; emojiID++ {
		require.NoError(t, store.Add(context.Background(), domainshared.IDFromUUID(messageID), domainshared.IDFromUUID(userID), emojiID))
	}
	require.ErrorIs(t, store.Add(context.Background(), domainshared.IDFromUUID(messageID), domainshared.IDFromUUID(userID), 4), domainchatreaction.ErrReactionLimitReached)
	require.NoError(t, store.Add(context.Background(), domainshared.IDFromUUID(messageID), domainshared.IDFromUUID(userID), 1))
}

func TestChatMessageReactionStore_ListAggregatesAndMarksSelf(t *testing.T) {
	db := setupChatReactionTestDB(t)
	store := NewChatMessageReactionStore(db)
	messageID := uuid.New()
	userID := uuid.New()
	otherUserID := uuid.New()
	require.NoError(t, db.Create(&model.ChatMessage{
		ID: messageID, ConversationID: uuid.New(), SenderID: userID, MessageType: "text",
		Content: "hello", IdempotencyKey: "message-1", CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}).Error)
	require.NoError(t, db.Create(&model.Emoji{ID: 1, Name: "[笑]", URL: "/笑.png", GifURL: "/笑.gif"}).Error)
	require.NoError(t, db.Create(&model.Emoji{ID: 2, Name: "[哭]", URL: "/哭.png"}).Error)
	require.NoError(t, store.Add(context.Background(), domainshared.IDFromUUID(messageID), domainshared.IDFromUUID(userID), 1))
	require.NoError(t, store.Add(context.Background(), domainshared.IDFromUUID(messageID), domainshared.IDFromUUID(otherUserID), 1))
	require.NoError(t, store.Add(context.Background(), domainshared.IDFromUUID(messageID), domainshared.IDFromUUID(otherUserID), 2))

	result, err := store.ListByMessages(context.Background(), []domainshared.ID{domainshared.IDFromUUID(messageID)}, domainshared.IDFromUUID(userID))
	require.NoError(t, err)
	require.Len(t, result[messageID.String()], 2)
	require.Equal(t, int64(2), result[messageID.String()][0].Count)
	require.True(t, result[messageID.String()][0].Self)
	require.False(t, result[messageID.String()][1].Self)
}
