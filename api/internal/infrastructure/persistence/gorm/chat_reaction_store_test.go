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
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.ChatMessage{}, &model.Emoji{}, &model.ChatMessageReaction{}))
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

func TestChatMessageReactionStore_RecentUsersAreBoundedOrderedAndBatched(t *testing.T) {
	db := setupChatReactionTestDB(t)
	store := NewChatMessageReactionStore(db)
	ctx := context.Background()
	now := time.Date(2026, 11, 11, 10, 0, 0, 0, time.UTC)
	messageIDs := []uuid.UUID{uuid.New(), uuid.New()}
	userIDs := []uuid.UUID{uuid.New(), uuid.New(), uuid.New(), uuid.New()}
	reactionIDs := []uuid.UUID{
		uuid.MustParse("00000000-0000-0000-0000-000000000001"),
		uuid.MustParse("00000000-0000-0000-0000-000000000002"),
		uuid.MustParse("00000000-0000-0000-0000-000000000003"),
		uuid.MustParse("00000000-0000-0000-0000-000000000004"),
	}
	names := []string{"最早", "第二", "第三", ""}
	usernames := []string{"recent-1", "recent-2", "recent-3", "recent-4"}
	for _, messageID := range messageIDs {
		require.NoError(t, db.Create(&model.ChatMessage{
			ID:             messageID,
			ConversationID: uuid.New(),
			SenderID:       userIDs[0],
			MessageType:    "text",
			Content:        "hello",
			IdempotencyKey: messageID.String(),
			CreatedAt:      now,
			UpdatedAt:      now,
		}).Error)
	}
	require.NoError(t, db.Create(&model.Emoji{
		ID:     1,
		Name:   "[笑]",
		URL:    "/smile.png",
		GifURL: "/smile.gif",
	}).Error)
	require.NoError(t, db.Create(&model.Emoji{
		ID:   2,
		Name: "[哭]",
		URL:  "/cry.png",
	}).Error)
	for i, userID := range userIDs {
		require.NoError(t, db.Create(&model.User{
			BaseModel:    model.BaseModel{ID: userID},
			Username:     usernames[i],
			DisplayName:  names[i],
			Email:        usernames[i] + "@test",
			PasswordHash: "x",
		}).Error)
		offset := min(i, 2)
		require.NoError(t, db.Create(&model.ChatMessageReaction{
			ID:        reactionIDs[i],
			MessageID: messageIDs[0],
			EmojiID:   1,
			UserID:    userID,
			CreatedAt: now.Add(time.Duration(offset) * time.Minute),
		}).Error)
	}
	require.NoError(t, db.Create(&model.ChatMessageReaction{
		ID:        uuid.New(),
		MessageID: messageIDs[1],
		EmojiID:   1,
		UserID:    userIDs[0],
		CreatedAt: now,
	}).Error)
	require.NoError(t, db.Create(&model.ChatMessageReaction{
		ID:        uuid.New(),
		MessageID: messageIDs[0],
		EmojiID:   2,
		UserID:    uuid.New(),
		CreatedAt: now,
	}).Error)
	ids := []domainshared.ID{domainshared.IDFromUUID(messageIDs[0]), domainshared.IDFromUUID(messageIDs[1])}
	queryCount := 0
	require.NoError(t, db.Callback().Row().Before("gorm:row").Register("count_recent_chat_queries", func(*gorm.DB) {
		queryCount++
	}))
	result, err := store.ListByMessages(ctx, ids, domainshared.IDFromUUID(userIDs[0]))
	require.NoError(t, err)
	require.LessOrEqual(t, queryCount, 2, "all messages and emoji groups must use bounded queries")
	reactions := result[messageIDs[0].String()]
	require.Len(t, reactions, 2)
	require.Equal(t, int64(4), reactions[0].Count)
	require.True(t, reactions[0].Self, "self remains true even when viewer is outside the latest three")
	want := []domainchatreaction.RecentUser{
		{ID: userIDs[3].String(), Name: "recent-4"},
		{ID: userIDs[2].String(), Name: "第三"},
		{ID: userIDs[1].String(), Name: "第二"},
	}
	require.Equal(t, want, reactions[0].RecentUsers)
	require.Equal(t, "[笑]", reactions[0].EmojiName)
	require.Equal(t, "/smile.png", reactions[0].EmojiURL)
	require.Equal(t, "/smile.gif", reactions[0].GifURL)
	require.Equal(t, int64(1), reactions[1].Count, "unavailable users remain counted")
	require.NotNil(t, reactions[1].RecentUsers)
	require.Empty(t, reactions[1].RecentUsers)
	require.Equal(t, []domainchatreaction.RecentUser{{ID: userIDs[0].String(), Name: "最早"}}, result[messageIDs[1].String()][0].RecentUsers)

	publicView, err := store.ListByMessages(ctx, ids, domainshared.ID{})
	require.NoError(t, err)
	require.Equal(t, want, publicView[messageIDs[0].String()][0].RecentUsers)
	require.False(t, publicView[messageIDs[0].String()][0].Self)
	require.NoError(t, store.Remove(ctx, ids[0], domainshared.IDFromUUID(userIDs[3]), 1))
	result, err = store.ListByMessages(ctx, ids, domainshared.ID{})
	require.NoError(t, err)
	require.Equal(t, []domainchatreaction.RecentUser{
		{ID: userIDs[2].String(), Name: "第三"},
		{ID: userIDs[1].String(), Name: "第二"},
		{ID: userIDs[0].String(), Name: "最早"},
	}, result[messageIDs[0].String()][0].RecentUsers)
	require.Equal(t, int64(3), result[messageIDs[0].String()][0].Count)
}
