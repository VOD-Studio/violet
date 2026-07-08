package gorm

import (
	"context"
	"path/filepath"
	"testing"

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
