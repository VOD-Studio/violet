package gorm

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	domaincr "blog-api/internal/domain/commentreaction"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// setupCommentReactionTestDB 初始化内存 SQLite 并迁移反应相关表。
func setupCommentReactionTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	tmpFile := filepath.Join(t.TempDir(), "test.db")
	db, err := gorm.Open(sqlite.Open(tmpFile), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	err = db.AutoMigrate(&model.User{}, &model.Comment{}, &model.Emoji{}, &model.EmojiGroup{}, &model.CommentReaction{})
	require.NoError(t, err)

	// AutoMigrate 不会生成 PostgreSQL migration 里的 partial unique index，手动补齐匿名维度去重
	require.NoError(t, db.Exec(
		`CREATE UNIQUE INDEX IF NOT EXISTS unique_ip_reaction ON comment_reactions(comment_id, emoji_id, ip_hash) WHERE user_id IS NULL`,
	).Error)

	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func seedCommentReactionFixtures(t *testing.T, db *gorm.DB) (commentID, user1ID, user2ID string, emoji1ID, emoji2ID int32) {
	t.Helper()

	uid1 := uuid.New()
	uid2 := uuid.New()
	cid := uuid.New()
	var groupID int32

	require.NoError(t, db.Create(&model.User{
		BaseModel: model.BaseModel{ID: uid1}, Username: "u1", Email: "u1@test", PasswordHash: "x", Role: "user", IsActive: true,
	}).Error)
	require.NoError(t, db.Create(&model.User{
		BaseModel: model.BaseModel{ID: uid2}, Username: "u2", Email: "u2@test", PasswordHash: "x", Role: "user", IsActive: true,
	}).Error)
	require.NoError(t, db.Create(&model.Comment{
		ID: cid, PostID: uuid.New(), AuthorName: "author", Body: "body",
	}).Error)
	require.NoError(t, db.Create(&model.EmojiGroup{Name: "g1", Source: "system"}).Error)
	db.Raw("SELECT id FROM emoji_groups WHERE name = ?", "g1").Scan(&groupID)
	require.NotZero(t, groupID)
	require.NoError(t, db.Create(&model.Emoji{GroupID: groupID, Name: "e1", URL: "/e1.png"}).Error)
	db.Raw("SELECT id FROM emojis WHERE name = ?", "e1").Scan(&emoji1ID)
	require.NotZero(t, emoji1ID)
	require.NoError(t, db.Create(&model.Emoji{GroupID: groupID, Name: "e2", URL: "/e2.png"}).Error)
	db.Raw("SELECT id FROM emojis WHERE name = ?", "e2").Scan(&emoji2ID)
	require.NotZero(t, emoji2ID)

	return cid.String(), uid1.String(), uid2.String(), emoji1ID, emoji2ID
}

func TestCommentReactionStore_Add_IdempotentByUser(t *testing.T) {
	db := setupCommentReactionTestDB(t)
	store := NewCommentReactionStore(db)
	ctx := context.Background()

	commentID, user1ID, user2ID, emoji1ID, _ := seedCommentReactionFixtures(t, db)

	// 同一登录用户重复添加同一表情应幂等
	require.NoError(t, store.Add(ctx, commentID, user1ID, "ip1", emoji1ID))
	require.NoError(t, store.Add(ctx, commentID, user1ID, "ip1", emoji1ID))
	require.NoError(t, store.Add(ctx, commentID, user1ID, "ip2", emoji1ID))

	list, err := store.ListByComment(ctx, commentID, user1ID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
	assert.Equal(t, int64(1), list[0].Count)
	assert.True(t, list[0].Self)

	// 不同登录用户即使同 IP 也应能各自添加
	require.NoError(t, store.Add(ctx, commentID, user2ID, "ip1", emoji1ID))
	list, err = store.ListByComment(ctx, commentID, user1ID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
	assert.Equal(t, int64(2), list[0].Count)
	assert.True(t, list[0].Self)

	// 从 user2 视角查看应标识 self
	list, err = store.ListByComment(ctx, commentID, user2ID)
	require.NoError(t, err)
	assert.True(t, list[0].Self)
}

func TestCommentReactionStore_Add_AnonymousIdempotentByIP(t *testing.T) {
	db := setupCommentReactionTestDB(t)
	store := NewCommentReactionStore(db)
	ctx := context.Background()

	commentID, _, _, emoji1ID, _ := seedCommentReactionFixtures(t, db)

	// 同一 IP 的匿名用户重复添加应幂等
	require.NoError(t, store.Add(ctx, commentID, "", "ip-a", emoji1ID))
	require.NoError(t, store.Add(ctx, commentID, "", "ip-a", emoji1ID))

	list, err := store.ListByComment(ctx, commentID, "")
	require.NoError(t, err)
	assert.Len(t, list, 1)
	assert.Equal(t, int64(1), list[0].Count)
	assert.False(t, list[0].Self)

	// 不同 IP 的匿名用户各算一次
	require.NoError(t, store.Add(ctx, commentID, "", "ip-b", emoji1ID))
	list, err = store.ListByComment(ctx, commentID, "")
	require.NoError(t, err)
	assert.Len(t, list, 1)
	assert.Equal(t, int64(2), list[0].Count)
}

func TestCommentReactionStore_Remove(t *testing.T) {
	db := setupCommentReactionTestDB(t)
	store := NewCommentReactionStore(db)
	ctx := context.Background()

	commentID, user1ID, _, emoji1ID, _ := seedCommentReactionFixtures(t, db)

	require.NoError(t, store.Add(ctx, commentID, user1ID, "ip1", emoji1ID))
	require.NoError(t, store.Remove(ctx, commentID, user1ID, "ip1", emoji1ID))

	list, err := store.ListByComment(ctx, commentID, user1ID)
	require.NoError(t, err)
	assert.Len(t, list, 0)
}

func TestCommentReactionStore_BatchByComments_AggregatesAndSelf(t *testing.T) {
	db := setupCommentReactionTestDB(t)
	store := NewCommentReactionStore(db)
	ctx := context.Background()

	commentID, user1ID, user2ID, emoji1ID, emoji2ID := seedCommentReactionFixtures(t, db)

	// user1 对 emoji1、emoji2 各点一次；user2 只对 emoji1 点一次
	require.NoError(t, store.Add(ctx, commentID, user1ID, "ip1", emoji1ID))
	require.NoError(t, store.Add(ctx, commentID, user1ID, "ip1", emoji2ID))
	require.NoError(t, store.Add(ctx, commentID, user2ID, "ip1", emoji1ID))

	results, err := store.BatchByComments(ctx, []string{commentID}, user1ID)
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, commentID, results[0].CommentID)

	// emoji1 计数 2，emoji2 计数 1
	require.Len(t, results[0].Reactions, 2)
	emoji1 := findAggregatedReaction(results[0].Reactions, emoji1ID)
	emoji2 := findAggregatedReaction(results[0].Reactions, emoji2ID)
	require.NotNil(t, emoji1)
	require.NotNil(t, emoji2)
	assert.Equal(t, int64(2), emoji1.Count)
	assert.True(t, emoji1.Self)
	assert.Equal(t, int64(1), emoji2.Count)
	assert.True(t, emoji2.Self)

	// user2 视角：emoji1 self=true，emoji2 self=false
	results, err = store.BatchByComments(ctx, []string{commentID}, user2ID)
	require.NoError(t, err)
	emoji1 = findAggregatedReaction(results[0].Reactions, emoji1ID)
	emoji2 = findAggregatedReaction(results[0].Reactions, emoji2ID)
	require.NotNil(t, emoji1)
	require.NotNil(t, emoji2)
	assert.True(t, emoji1.Self)
	assert.False(t, emoji2.Self)
}

func findAggregatedReaction(reactions []domaincr.AggregatedReaction, emojiID int32) *domaincr.AggregatedReaction {
	for i := range reactions {
		if reactions[i].EmojiID == emojiID {
			return &reactions[i]
		}
	}
	return nil
}

func TestCommentReactionStore_RecentUsersAreBoundedOrderedAndPublic(t *testing.T) {
	db := setupCommentReactionTestDB(t)
	store := NewCommentReactionStore(db)
	ctx := context.Background()
	commentID, _, _, emoji1ID, emoji2ID := seedCommentReactionFixtures(t, db)
	secondCommentID := uuid.New()
	require.NoError(t, db.Create(&model.Comment{
		ID:         secondCommentID,
		PostID:     uuid.New(),
		AuthorName: "second",
		Body:       "body",
	}).Error)
	now := time.Date(2026, 11, 11, 10, 0, 0, 0, time.UTC)
	userIDs := []uuid.UUID{uuid.New(), uuid.New(), uuid.New(), uuid.New()}
	reactionIDs := []uuid.UUID{
		uuid.MustParse("00000000-0000-0000-0000-000000000001"),
		uuid.MustParse("00000000-0000-0000-0000-000000000002"),
		uuid.MustParse("00000000-0000-0000-0000-000000000003"),
		uuid.MustParse("00000000-0000-0000-0000-000000000004"),
	}
	names := []string{"最早", "第二", "第三", ""}
	usernames := []string{"recent-1", "recent-2", "recent-3", "recent-4"}
	for i, userID := range userIDs {
		require.NoError(t, db.Create(&model.User{
			BaseModel:    model.BaseModel{ID: userID},
			Username:     usernames[i],
			DisplayName:  names[i],
			Email:        usernames[i] + "@test",
			PasswordHash: "x",
		}).Error)
		offset := min(i, 2)
		require.NoError(t, db.Create(&model.CommentReaction{
			ID:        reactionIDs[i],
			CommentID: parseUUID(commentID),
			EmojiID:   emoji1ID,
			UserID:    &userID,
			CreatedAt: now.Add(time.Duration(offset) * time.Minute),
		}).Error)
	}
	require.NoError(t, db.Create(&model.CommentReaction{
		ID:        uuid.New(),
		CommentID: parseUUID(commentID),
		EmojiID:   emoji1ID,
		IPHash:    "anonymous-newest",
		CreatedAt: now.Add(10 * time.Minute),
	}).Error)
	require.NoError(t, db.Create(&model.CommentReaction{
		ID:        uuid.New(),
		CommentID: parseUUID(commentID),
		EmojiID:   emoji2ID,
		IPHash:    "anonymous-only",
		CreatedAt: now,
	}).Error)
	require.NoError(t, db.Create(&model.CommentReaction{
		ID:        uuid.New(),
		CommentID: secondCommentID,
		EmojiID:   emoji1ID,
		UserID:    &userIDs[0],
		CreatedAt: now,
	}).Error)

	queryCount := 0
	require.NoError(t, db.Callback().Row().Before("gorm:row").Register("count_recent_comment_queries", func(*gorm.DB) {
		queryCount++
	}))
	batch, err := store.BatchByComments(ctx, []string{commentID, secondCommentID.String()}, "")
	require.NoError(t, err)
	require.LessOrEqual(t, queryCount, 2, "all comments and emoji groups must use bounded queries")
	require.Len(t, batch, 2)
	reaction := findAggregatedReaction(batch[0].Reactions, emoji1ID)
	require.NotNil(t, reaction)
	require.Equal(t, int64(5), reaction.Count, "anonymous responses remain counted")
	require.False(t, reaction.Self)
	want := []domaincr.RecentUser{
		{ID: userIDs[3].String(), Name: "recent-4"},
		{ID: userIDs[2].String(), Name: "第三"},
		{ID: userIDs[1].String(), Name: "第二"},
	}
	require.Equal(t, want, reaction.RecentUsers, "ties use reaction ID descending; empty display names use username")
	anonymousOnly := findAggregatedReaction(batch[0].Reactions, emoji2ID)
	require.NotNil(t, anonymousOnly)
	require.Equal(t, int64(1), anonymousOnly.Count)
	require.NotNil(t, anonymousOnly.RecentUsers)
	require.Empty(t, anonymousOnly.RecentUsers)
	require.Equal(t, []domaincr.RecentUser{{ID: userIDs[0].String(), Name: "最早"}}, batch[1].Reactions[0].RecentUsers)

	list, err := store.ListByComment(ctx, commentID, userIDs[0].String())
	require.NoError(t, err)
	require.Equal(t, want, list[0].RecentUsers)
	require.True(t, list[0].Self, "self remains true even when the viewer is outside the latest three")
	require.NoError(t, store.Remove(ctx, commentID, userIDs[3].String(), "", emoji1ID))
	list, err = store.ListByComment(ctx, commentID, "")
	require.NoError(t, err)
	require.Equal(t, []domaincr.RecentUser{
		{ID: userIDs[2].String(), Name: "第三"},
		{ID: userIDs[1].String(), Name: "第二"},
		{ID: userIDs[0].String(), Name: "最早"},
	}, list[0].RecentUsers)
	require.Equal(t, int64(4), list[0].Count)
}
