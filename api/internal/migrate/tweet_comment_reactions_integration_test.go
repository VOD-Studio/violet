//go:build integration

package migrate

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestTweetCommentReactionMigrationConstraintsAndRollback(t *testing.T) {
	db, _ := testDatabase(t)
	for _, statement := range []string{
		`CREATE TABLE users (id UUID PRIMARY KEY)`,
		`CREATE TABLE emojis (id INTEGER PRIMARY KEY)`,
		`CREATE TABLE comments (id UUID PRIMARY KEY)`,
		`CREATE TABLE tweet_comments (id UUID PRIMARY KEY)`,
	} {
		_, err := db.Exec(statement)
		require.NoError(t, err)
	}
	up, err := os.ReadFile(filepath.Join("..", "..", "migrations", "151_create_tweet_comment_reactions.up.sql"))
	require.NoError(t, err)
	_, err = db.Exec(string(up))
	require.NoError(t, err)
	userID, commentID, articleCommentID := uuid.New(), uuid.New(), uuid.New()
	_, err = db.Exec(`INSERT INTO users VALUES ($1);`, userID)
	require.NoError(t, err)
	_, err = db.Exec(`INSERT INTO emojis VALUES (1)`)
	require.NoError(t, err)
	_, err = db.Exec(`INSERT INTO comments VALUES ($1)`, articleCommentID)
	require.NoError(t, err)
	_, err = db.Exec(`INSERT INTO tweet_comments VALUES ($1)`, commentID)
	require.NoError(t, err)
	insert := `INSERT INTO tweet_comment_reactions(comment_id, emoji_id, user_id) VALUES ($1, $2, $3)`
	_, err = db.Exec(insert, articleCommentID, 1, userID)
	require.Error(t, err, "文章评论 ID 不得满足推文评论外键")
	_, err = db.Exec(insert, commentID, 999, userID)
	require.Error(t, err, "表情外键必须存在")
	_, err = db.Exec(insert, commentID, 1, uuid.New())
	require.Error(t, err, "用户外键必须存在")
	_, err = db.Exec(insert, commentID, 1, userID)
	require.NoError(t, err)
	_, err = db.Exec(insert, commentID, 1, userID)
	require.Error(t, err, "同一用户/评论/表情唯一")
	_, err = db.Exec(`DELETE FROM tweet_comments WHERE id = $1`, commentID)
	require.NoError(t, err)
	var count int
	require.NoError(t, db.QueryRow(`SELECT COUNT(*) FROM tweet_comment_reactions`).Scan(&count))
	require.Zero(t, count, "评论删除级联清理回应")
	down, err := os.ReadFile(filepath.Join("..", "..", "migrations", "151_create_tweet_comment_reactions.down.sql"))
	require.NoError(t, err)
	_, err = db.Exec(string(down))
	require.NoError(t, err)
	var table *string
	require.NoError(t, db.QueryRow(`SELECT to_regclass('tweet_comment_reactions')::text`).Scan(&table))
	require.Nil(t, table)
}
