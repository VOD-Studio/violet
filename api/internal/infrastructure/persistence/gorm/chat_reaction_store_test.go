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

func TestChatMessageReactionStore_AddReplacesOldestPerUser(t *testing.T) {
	db := setupChatReactionTestDB(t)
	store := NewChatMessageReactionStore(db)
	ctx := context.Background()
	messageID := domainshared.IDFromUUID(uuid.New())
	userID := domainshared.IDFromUUID(uuid.New())
	otherUserID := domainshared.IDFromUUID(uuid.New())
	require.NoError(t, db.Create(&model.ChatMessage{
		ID: messageID.UUID(), ConversationID: uuid.New(), SenderID: userID.UUID(), MessageType: "text",
		Content: "hello", IdempotencyKey: "message-1", CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}).Error)

	for emojiID := int32(1); emojiID <= 3; emojiID++ {
		require.NoError(t, store.Add(ctx, messageID, otherUserID, emojiID))
	}
	for emojiID := int32(4); emojiID <= 6; emojiID++ {
		require.NoError(t, store.Add(ctx, messageID, userID, emojiID))
	}
	result, err := store.ListByMessages(ctx, []domainshared.ID{messageID}, userID)
	require.NoError(t, err)
	require.Len(t, result[messageID.String()], 6)
	assertChatReactionSelection(t, store, messageID, otherUserID, []int32{1, 2, 3})
	assertChatReactionSelection(t, store, messageID, userID, []int32{4, 5, 6})

	// 重复 POST 不刷新选择顺序；SQLite 的时间精度可能同秒，唯一确定顺序由 ID 决定，
	// 因此先手动校准三条记录的 created_at 再验证 FIFO 替换。
	require.NoError(t, db.Exec("UPDATE chat_message_reactions SET created_at = ? WHERE message_id = ? AND user_id = ? AND emoji_id = 4", time.Now().Add(-3*time.Hour), messageID.UUID(), userID.UUID()).Error)
	require.NoError(t, db.Exec("UPDATE chat_message_reactions SET created_at = ? WHERE message_id = ? AND user_id = ? AND emoji_id = 5", time.Now().Add(-2*time.Hour), messageID.UUID(), userID.UUID()).Error)
	require.NoError(t, db.Exec("UPDATE chat_message_reactions SET created_at = ? WHERE message_id = ? AND user_id = ? AND emoji_id = 6", time.Now().Add(-1*time.Hour), messageID.UUID(), userID.UUID()).Error)
	require.NoError(t, store.Add(ctx, messageID, userID, 4))
	require.NoError(t, store.Add(ctx, messageID, userID, 7))
	assertChatReactionSelection(t, store, messageID, userID, []int32{5, 6, 7})
	assertChatReactionSelection(t, store, messageID, otherUserID, []int32{1, 2, 3})
	require.NoError(t, store.Add(ctx, messageID, userID, 1))
	assertChatReactionSelection(t, store, messageID, userID, []int32{6, 7, 1})

	// 取消只影响本人，重复取消保持幂等。
	require.NoError(t, store.Remove(ctx, messageID, userID, 1))
	require.NoError(t, store.Remove(ctx, messageID, userID, 1))
	require.NoError(t, store.Remove(ctx, messageID, userID, 2))
	assertChatReactionSelection(t, store, messageID, userID, []int32{6, 7})
	assertChatReactionSelection(t, store, messageID, otherUserID, []int32{1, 2, 3})
	require.NoError(t, store.Add(ctx, messageID, userID, 8))
	assertChatReactionSelection(t, store, messageID, userID, []int32{6, 7, 8})
}

func TestChatMessageReactionStore_MessageKindLimitUsesFinalSelection(t *testing.T) {
	for _, tc := range []struct {
		name          string
		sharedOldest  bool
		newEmoji      int32
		wantLimit     bool
		wantSelection []int32
		wantKinds     int
	}{
		{name: "满额加入已有种类", sharedOldest: true, newEmoji: 4, wantSelection: []int32{2, 3, 4}, wantKinds: 11},
		{name: "替换独占种类", newEmoji: 12, wantSelection: []int32{2, 3, 12}, wantKinds: 11},
		{name: "第十二种回滚", sharedOldest: true, newEmoji: 12, wantLimit: true, wantSelection: []int32{1, 2, 3}, wantKinds: 11},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db := setupChatReactionTestDB(t)
			store := NewChatMessageReactionStore(db)
			ctx := context.Background()
			messageID := domainshared.IDFromUUID(uuid.New())
			userID := domainshared.IDFromUUID(uuid.New())
			otherUserID := domainshared.IDFromUUID(uuid.New())
			require.NoError(t, db.Create(&model.ChatMessage{
				ID: messageID.UUID(), ConversationID: uuid.New(), SenderID: userID.UUID(), MessageType: "text",
				Content: "hello", IdempotencyKey: "message-1", CreatedAt: time.Now(), UpdatedAt: time.Now(),
			}).Error)
			for emojiID := int32(1); emojiID <= 3; emojiID++ {
				require.NoError(t, store.Add(ctx, messageID, userID, emojiID))
			}
			// SQLite created_at 精度不足，校准本人三条的先后再验证 FIFO 替换。
			calibrate := func(emojiID int32, offset time.Duration) {
				require.NoError(t, db.Exec("UPDATE chat_message_reactions SET created_at = ? WHERE message_id = ? AND user_id = ? AND emoji_id = ?", time.Now().Add(offset), messageID.UUID(), userID.UUID(), emojiID).Error)
			}
			calibrate(1, -3*time.Hour)
			calibrate(2, -2*time.Hour)
			calibrate(3, -1*time.Hour)
			for emojiID := int32(4); emojiID <= 11; emojiID++ {
				require.NoError(t, store.Add(ctx, messageID, domainshared.IDFromUUID(uuid.New()), emojiID))
			}
			if tc.sharedOldest {
				require.NoError(t, store.Add(ctx, messageID, otherUserID, 1))
			}
			err := store.Add(ctx, messageID, userID, tc.newEmoji)
			if tc.wantLimit {
				require.ErrorIs(t, err, domainchatreaction.ErrMessageReactionLimitReached)
			} else {
				require.NoError(t, err)
			}
			assertChatReactionSelection(t, store, messageID, userID, tc.wantSelection)
			result, err := store.ListByMessages(ctx, []domainshared.ID{messageID}, userID)
			require.NoError(t, err)
			require.Len(t, result[messageID.String()], tc.wantKinds)
			if tc.sharedOldest {
				assertChatReactionSelection(t, store, messageID, otherUserID, []int32{1})
			}
			if tc.wantLimit {
				// 拒绝新增不能改变原选择时间；下一次合法替换仍应移除 1。
				require.NoError(t, store.Add(ctx, messageID, userID, 4))
				assertChatReactionSelection(t, store, messageID, userID, []int32{2, 3, 4})
				// 未满个人额度也不能给整条消息增加第十二种。
				require.ErrorIs(t, store.Add(ctx, messageID, otherUserID, 12), domainchatreaction.ErrMessageReactionLimitReached)
				assertChatReactionSelection(t, store, messageID, otherUserID, []int32{1})
			}
		})
	}
}

func TestChatMessageReactionStore_EqualSelectionTimesUseIDOrder(t *testing.T) {
	db := setupChatReactionTestDB(t)
	store := NewChatMessageReactionStore(db)
	ctx := context.Background()
	messageID := domainshared.IDFromUUID(uuid.New())
	userID := domainshared.IDFromUUID(uuid.New())
	now := time.Now()
	require.NoError(t, db.Create(&model.ChatMessage{
		ID: messageID.UUID(), ConversationID: uuid.New(), SenderID: userID.UUID(), MessageType: "text",
		Content: "hello", IdempotencyKey: "message-1", CreatedAt: now, UpdatedAt: now,
	}).Error)
	require.NoError(t, db.Create(&[]model.ChatMessageReaction{
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000000003"), MessageID: messageID.UUID(), UserID: userID.UUID(), EmojiID: 1, CreatedAt: now},
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000000001"), MessageID: messageID.UUID(), UserID: userID.UUID(), EmojiID: 2, CreatedAt: now},
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000000002"), MessageID: messageID.UUID(), UserID: userID.UUID(), EmojiID: 3, CreatedAt: now},
	}).Error)
	require.NoError(t, store.Add(ctx, messageID, userID, 2))
	require.NoError(t, store.Add(ctx, messageID, userID, 4))
	assertChatReactionSelection(t, store, messageID, userID, []int32{1, 3, 4})
}

func assertChatReactionSelection(t *testing.T, store *ChatMessageReactionStore, messageID, userID domainshared.ID, expected []int32) {
	t.Helper()
	result, err := store.ListByMessages(context.Background(), []domainshared.ID{messageID}, userID)
	require.NoError(t, err)
	selected := make([]int32, 0, len(result[messageID.String()]))
	for _, reaction := range result[messageID.String()] {
		if reaction.Self {
			selected = append(selected, reaction.EmojiID)
		}
	}
	require.ElementsMatch(t, expected, selected)
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
