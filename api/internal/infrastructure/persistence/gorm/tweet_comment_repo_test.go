package gorm

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	domainshared "blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)
func setupTweetCommentTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	tmpFile := t.TempDir() + "/test.db"
	db, err := gorm.Open(sqlite.Open(tmpFile), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.TweetComment{}))
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

// mustSeedComment 以显式时间戳重建评论并保存（保证排序/分页确定性）。
func mustSeedComment(t *testing.T, repo *TweetCommentRepository, tweetID, authorID domainshared.ID, body string, parent *domaintweet.Comment, createdAt time.Time) *domaintweet.Comment {
	t.Helper()
	ts := createdAt.UTC().Truncate(time.Microsecond)
	c := domaintweet.ReconstructComment(domainshared.NewID(), tweetID, authorID, body, nil, 0, "", ts, ts)
	if parent != nil {
		require.NoError(t, c.SetParent(parent))
	} else {
		require.NoError(t, c.SetParent(nil))
	}
	require.NoError(t, repo.Save(context.Background(), c))
	return c
}

func TestTweetCommentRepository_SaveAndFindByID(t *testing.T) {
	repo := NewTweetCommentRepository(setupTweetCommentTestDB(t))
	ctx := context.Background()
	tweetID := domainshared.NewID()
	authorID := domainshared.NewID()

	c, err := domaintweet.NewComment(tweetID, authorID, "好文")
	require.NoError(t, err)
	require.NoError(t, c.SetParent(nil))
	require.NoError(t, repo.Save(ctx, c))

	got, err := repo.FindByID(ctx, c.ID())
	require.NoError(t, err)
	assert.Equal(t, c.ID(), got.ID())
	assert.Equal(t, tweetID, got.TweetID())
	assert.Equal(t, authorID, got.AuthorID())
	assert.Equal(t, "好文", got.Body())
	assert.Equal(t, int16(0), got.Depth())
	assert.Equal(t, c.ID().String()+"/", got.Path())
	assert.False(t, got.CreatedAt().IsZero())
}

func TestTweetCommentRepository_FindByID_NotFound(t *testing.T) {
	repo := NewTweetCommentRepository(setupTweetCommentTestDB(t))
	_, err := repo.FindByID(context.Background(), domainshared.NewID())
	require.ErrorIs(t, err, domaintweet.ErrCommentNotFound)
}

func TestTweetCommentRepository_FindByTweet_DescOrder(t *testing.T) {
	repo := NewTweetCommentRepository(setupTweetCommentTestDB(t))
	ctx := context.Background()
	tweetID := domainshared.NewID()
	authorID := domainshared.NewID()
	base := time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)

	// 3 条顶层评论，时间递增；倒序应为 c3..c1
	c1 := mustSeedComment(t, repo, tweetID, authorID, "第一条", nil, base)
	c2 := mustSeedComment(t, repo, tweetID, authorID, "第二条", nil, base.Add(time.Minute))
	c3 := mustSeedComment(t, repo, tweetID, authorID, "第三条", nil, base.Add(2*time.Minute))

	// 另一条推文的评论不应出现
	otherTweet := domainshared.NewID()
	mustSeedComment(t, repo, otherTweet, authorID, "其他推文", nil, base)

	comments, total, err := repo.FindByTweet(ctx, tweetID, 1, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(3), total)
	require.Len(t, comments, 3)
	assert.Equal(t, []string{c3.ID().String(), c2.ID().String(), c1.ID().String()},
		[]string{comments[0].ID().String(), comments[1].ID().String(), comments[2].ID().String()},
		"应按 created_at 倒序")
}

func TestTweetCommentRepository_FindByTweet_ExcludesReplies(t *testing.T) {
	repo := NewTweetCommentRepository(setupTweetCommentTestDB(t))
	ctx := context.Background()
	tweetID := domainshared.NewID()
	authorID := domainshared.NewID()

	top, err := domaintweet.NewComment(tweetID, authorID, "顶层")
	require.NoError(t, err)
	require.NoError(t, top.SetParent(nil))
	require.NoError(t, repo.Save(ctx, top))

	// 造回复（depth=1），FindByTweet 只返回顶层
	reply, err := domaintweet.NewComment(tweetID, authorID, "回复")
	require.NoError(t, err)
	require.NoError(t, reply.SetParent(top))
	require.NoError(t, repo.Save(ctx, reply))

	comments, total, err := repo.FindByTweet(ctx, tweetID, 1, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total, "只计顶层评论")
	require.Len(t, comments, 1)
	assert.Equal(t, top.ID(), comments[0].ID())
	assert.Equal(t, int16(0), comments[0].Depth())
}

func TestTweetCommentRepository_FindByTweet_Pagination(t *testing.T) {
	repo := NewTweetCommentRepository(setupTweetCommentTestDB(t))
	ctx := context.Background()
	tweetID := domainshared.NewID()
	authorID := domainshared.NewID()
	base := time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)

	for i := range 5 {
		mustSeedComment(t, repo, tweetID, authorID, "顶层", nil, base.Add(time.Duration(i)*time.Minute))
	}

	page1, total, err := repo.FindByTweet(ctx, tweetID, 1, 2)
	require.NoError(t, err)
	assert.Equal(t, int64(5), total)
	assert.Len(t, page1, 2)

	page2, _, err := repo.FindByTweet(ctx, tweetID, 2, 2)
	require.NoError(t, err)
	assert.Len(t, page2, 2)

	page3, _, err := repo.FindByTweet(ctx, tweetID, 3, 2)
	require.NoError(t, err)
	assert.Len(t, page3, 1)
}

func TestTweetCommentRepository_FindReplies_AscOrder(t *testing.T) {
	repo := NewTweetCommentRepository(setupTweetCommentTestDB(t))
	ctx := context.Background()
	tweetID := domainshared.NewID()
	authorID := domainshared.NewID()
	base := time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)

	top := mustSeedComment(t, repo, tweetID, authorID, "顶层", nil, base)

	// 2 条回复，时间递增；正序应为 r1..r2
	r1 := mustSeedComment(t, repo, tweetID, authorID, "回复1", top, base.Add(time.Minute))
	r2 := mustSeedComment(t, repo, tweetID, authorID, "回复2", top, base.Add(2*time.Minute))

	replies, total, err := repo.FindReplies(ctx, top.ID(), 1, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	require.Len(t, replies, 2)
	assert.Equal(t, []string{r1.ID().String(), r2.ID().String()},
		[]string{replies[0].ID().String(), replies[1].ID().String()},
		"回复应按 created_at 正序（对话时间线）")
	for _, r := range replies {
		assert.Equal(t, int16(1), r.Depth())
	}
}

func TestTweetCommentRepository_FindReplies_ReplyToReply(t *testing.T) {
	// 回复一条回复：path 挂同一顶层，FindReplies 按顶层前缀能把整条链拉出
	repo := NewTweetCommentRepository(setupTweetCommentTestDB(t))
	ctx := context.Background()
	tweetID := domainshared.NewID()
	authorID := domainshared.NewID()
	base := time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)

	top := mustSeedComment(t, repo, tweetID, authorID, "顶层", nil, base)
	r1 := mustSeedComment(t, repo, tweetID, authorID, "回复1", top, base.Add(time.Minute))
	r2 := mustSeedComment(t, repo, tweetID, authorID, "回复2 回复 r1", r1, base.Add(2*time.Minute))
	replies, total, err := repo.FindReplies(ctx, top.ID(), 1, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(2), total, "r1 + r2 都挂在 top 下，FindReplies 按顶层前缀返回全部回复")
	require.Len(t, replies, 2)
	// 排除 top 自身，包含 r1 和 r2
	ids := []string{replies[0].ID().String(), replies[1].ID().String()}
	assert.Contains(t, ids, r1.ID().String())
	assert.Contains(t, ids, r2.ID().String())
	// top 自身不在返回中
	for _, r := range replies {
		assert.NotEqual(t, top.ID(), r.ID())
	}
}

func TestTweetCommentRepository_FindReplies_ParentNotFound(t *testing.T) {
	repo := NewTweetCommentRepository(setupTweetCommentTestDB(t))
	_, _, err := repo.FindReplies(context.Background(), domainshared.NewID(), 1, 20)
	require.ErrorIs(t, err, domaintweet.ErrCommentNotFound)
}

func TestTweetCommentRepository_CountByTweet(t *testing.T) {
	repo := NewTweetCommentRepository(setupTweetCommentTestDB(t))
	ctx := context.Background()
	tweetID := domainshared.NewID()
	authorID := domainshared.NewID()
	base := time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)

	top := mustSeedComment(t, repo, tweetID, authorID, "顶层", nil, base)
	mustSeedComment(t, repo, tweetID, authorID, "回复1", top, base.Add(time.Minute))
	mustSeedComment(t, repo, tweetID, authorID, "回复2", top, base.Add(2*time.Minute))

	n, err := repo.CountByTweet(ctx, tweetID)
	require.NoError(t, err)
	assert.Equal(t, int64(3), n, "应计顶层 + 回复全部")
}

func TestTweetCommentRepository_CountByTweetIDs_Batch(t *testing.T) {
	repo := NewTweetCommentRepository(setupTweetCommentTestDB(t))
	ctx := context.Background()
	authorID := domainshared.NewID()
	base := time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)

	t1 := domainshared.NewID()
	t2 := domainshared.NewID()
	mustSeedComment(t, repo, t1, authorID, "c", nil, base)
	top := mustSeedComment(t, repo, t1, authorID, "c", nil, base.Add(time.Minute))
	mustSeedComment(t, repo, t1, authorID, "r", top, base.Add(2*time.Minute))
	// t2 无评论

	result, err := repo.CountByTweetIDs(ctx, []domainshared.ID{t1, t2})
	require.NoError(t, err)
	assert.Equal(t, int64(3), result[t1.String()])
	assert.Equal(t, int64(0), result[t2.String()])

	// 空入参
	empty, err := repo.CountByTweetIDs(ctx, nil)
	require.NoError(t, err)
	assert.Empty(t, empty)
}

func TestTweetCommentRepository_CountRepliesByParents(t *testing.T) {
	repo := NewTweetCommentRepository(setupTweetCommentTestDB(t))
	ctx := context.Background()
	tweetID := domainshared.NewID()
	authorID := domainshared.NewID()
	base := time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)

	top1 := mustSeedComment(t, repo, tweetID, authorID, "顶层1", nil, base)
	top2 := mustSeedComment(t, repo, tweetID, authorID, "顶层2", nil, base.Add(time.Minute))
	r1 := mustSeedComment(t, repo, tweetID, authorID, "回复1", top1, base.Add(2*time.Minute))
	// 回复的回复：path 仍挂 top1 顶层，应计入 top1
	mustSeedComment(t, repo, tweetID, authorID, "回复2 回复 r1", r1, base.Add(3*time.Minute))

	counts, err := repo.CountRepliesByParents(ctx, []domainshared.ID{top1.ID(), top2.ID()})
	require.NoError(t, err)
	assert.Equal(t, int64(2), counts[top1.ID().String()], "顶层1 下应计 2 条回复（含回复的回复）")
	assert.Equal(t, int64(0), counts[top2.ID().String()], "顶层2 无回复应为 0")

	// 空入参
	empty, err := repo.CountRepliesByParents(ctx, nil)
	require.NoError(t, err)
	assert.Empty(t, empty)
}

func TestTweetCommentRepository_Delete(t *testing.T) {
	repo := NewTweetCommentRepository(setupTweetCommentTestDB(t))
	ctx := context.Background()
	tweetID := domainshared.NewID()
	authorID := domainshared.NewID()

	c, err := domaintweet.NewComment(tweetID, authorID, "x")
	require.NoError(t, err)
	require.NoError(t, c.SetParent(nil))
	require.NoError(t, repo.Save(ctx, c))

	require.NoError(t, repo.Delete(ctx, c.ID()))

	_, err = repo.FindByID(ctx, c.ID())
	assert.ErrorIs(t, err, domaintweet.ErrCommentNotFound)
}

func TestTweetCommentRepository_Delete_NotFound(t *testing.T) {
	repo := NewTweetCommentRepository(setupTweetCommentTestDB(t))
	err := repo.Delete(context.Background(), domainshared.NewID())
	require.ErrorIs(t, err, domaintweet.ErrCommentNotFound)
}
