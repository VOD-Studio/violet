package gorm

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"blog-api/internal/infrastructure/persistence/gorm/model"
)

func TestUserMergeExecutorIntegrationPreservesTweetCommentReactions(t *testing.T) {
	db := setupIntegrationDB(t)
	primaryID := preseedAuthor(t, db)
	secondaryID := preseedAuthor(t, db)
	otherID := preseedAuthor(t, db)
	tweetID, firstCommentID, secondCommentID := uuid.New(), uuid.New(), uuid.New()
	require.NoError(t, db.Exec(
		`INSERT INTO tweets (id, author_id, content) VALUES (?, ?, 'merge reactions')`,
		tweetID, secondaryID.UUID(),
	).Error)
	for _, commentID := range []uuid.UUID{firstCommentID, secondCommentID} {
		require.NoError(t, db.Exec(
			`INSERT INTO tweet_comments (id, tweet_id, author_id, body) VALUES (?, ?, ?, 'comment')`,
			commentID, tweetID, secondaryID.UUID(),
		).Error)
	}
	var groupID, firstEmojiID, secondEmojiID int32
	require.NoError(t, db.Raw(
		`INSERT INTO emoji_groups (name) VALUES ('merge-reactions') RETURNING id`,
	).Scan(&groupID).Error)
	require.NoError(t, db.Raw(
		`INSERT INTO emojis (group_id, name) VALUES (?, 'first') RETURNING id`, groupID,
	).Scan(&firstEmojiID).Error)
	require.NoError(t, db.Raw(
		`INSERT INTO emojis (group_id, name) VALUES (?, 'second') RETURNING id`, groupID,
	).Scan(&secondEmojiID).Error)

	createdAt := time.Date(2026, 11, 12, 10, 0, 0, 0, time.UTC)
	primaryReaction := model.TweetCommentReaction{
		ID: uuid.New(), CommentID: firstCommentID, EmojiID: firstEmojiID,
		UserID: primaryID.UUID(), CreatedAt: createdAt,
	}
	overlappingReaction := model.TweetCommentReaction{
		ID: uuid.New(), CommentID: firstCommentID, EmojiID: firstEmojiID,
		UserID: secondaryID.UUID(), CreatedAt: createdAt.Add(time.Minute),
	}
	differentEmojiReaction := model.TweetCommentReaction{
		ID: uuid.New(), CommentID: firstCommentID, EmojiID: secondEmojiID,
		UserID: secondaryID.UUID(), CreatedAt: createdAt.Add(2 * time.Minute),
	}
	differentCommentReaction := model.TweetCommentReaction{
		ID: uuid.New(), CommentID: secondCommentID, EmojiID: firstEmojiID,
		UserID: secondaryID.UUID(), CreatedAt: createdAt.Add(3 * time.Minute),
	}
	otherUserReaction := model.TweetCommentReaction{
		ID: uuid.New(), CommentID: firstCommentID, EmojiID: firstEmojiID,
		UserID: otherID.UUID(), CreatedAt: createdAt.Add(4 * time.Minute),
	}
	reactions := []model.TweetCommentReaction{
		primaryReaction, overlappingReaction, differentEmojiReaction, differentCommentReaction, otherUserReaction,
	}
	require.NoError(t, db.Create(&reactions).Error)

	require.NoError(t, NewUserMergeExecutor(db).Merge(context.Background(), primaryID, secondaryID))

	var secondaryCount int64
	require.NoError(t, db.Table("users").Where("id = ?", secondaryID.UUID()).Count(&secondaryCount).Error)
	require.Zero(t, secondaryCount, "secondary 账号必须真实删除，不能靠保留账号绕过级联丢失")
	var tweetAuthorID uuid.UUID
	require.NoError(t, db.Table("tweets").Select("author_id").Where("id = ?", tweetID).Row().Scan(&tweetAuthorID))
	require.Equal(t, primaryID.UUID(), tweetAuthorID)
	var migratedComments int64
	require.NoError(t, db.Table("tweet_comments").Where("tweet_id = ? AND author_id = ?", tweetID, primaryID.UUID()).Count(&migratedComments).Error)
	require.EqualValues(t, 2, migratedComments, "secondary 的推文与评论迁移后不应级联丢失回应")

	var actual []model.TweetCommentReaction
	require.NoError(t, db.Find(&actual).Error)
	differentEmojiReaction.UserID = primaryID.UUID()
	differentCommentReaction.UserID = primaryID.UUID()
	expected := []model.TweetCommentReaction{
		primaryReaction, differentEmojiReaction, differentCommentReaction, otherUserReaction,
	}
	require.Len(t, actual, len(expected), "同评论同表情撞行只保留 primary，其余回应与第三方回应均保留")
	byID := make(map[uuid.UUID]model.TweetCommentReaction, len(actual))
	for _, reaction := range actual {
		byID[reaction.ID] = reaction
	}
	for _, reaction := range expected {
		retained, exists := byID[reaction.ID]
		require.True(t, exists, "回应 %s 应保留原记录 ID", reaction.ID)
		require.Equal(t, reaction.CommentID, retained.CommentID)
		require.Equal(t, reaction.EmojiID, retained.EmojiID)
		require.Equal(t, reaction.UserID, retained.UserID)
		require.True(t, reaction.CreatedAt.Equal(retained.CreatedAt), "合并不得改变回应时间")
	}
}
