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

// setupTweetTestDB 镜像 setupSubTestDB：sqlite 临时文件 + AutoMigrate。
// keyset 游标条件用 OR 展开形式（非行值），兼容 SQLite 与 PostgreSQL。
func setupTweetTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	tmpFile := t.TempDir() + "/test.db"
	db, err := gorm.Open(sqlite.Open(tmpFile), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Tweet{}))
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

// mustSeedTweet 以显式时间戳重建并保存推文（保证测试排序/游标确定性）。
// createdAt 截断到微秒并对齐 UTC：SQLite 按字符串存储时间，避免精度/时区格式漂移。
func mustSeedTweet(t *testing.T, repo *TweetRepository, authorID domainshared.ID, content string, createdAt time.Time) *domaintweet.Tweet {
	t.Helper()
	ts := createdAt.UTC().Truncate(time.Microsecond)
	tw := domaintweet.ReconstructTweet(domainshared.NewID(), authorID, content, []string{}, 0, ts, ts)
	require.NoError(t, repo.Save(context.Background(), tw))
	return tw
}

func TestTweetRepository_SaveAndFindByID(t *testing.T) {
	db := setupTweetTestDB(t)
	repo := NewTweetRepository(db)
	ctx := context.Background()
	authorID := domainshared.NewID()

	tw, err := domaintweet.NewTweet(authorID, "第一条推文", []string{"/uploads/tweet/a.webp"})
	require.NoError(t, err)
	require.NoError(t, repo.Save(ctx, tw))

	got, err := repo.FindByID(ctx, tw.ID())
	require.NoError(t, err)
	assert.Equal(t, tw.ID(), got.ID())
	assert.Equal(t, authorID, got.AuthorID())
	assert.Equal(t, "第一条推文", got.Content())
	assert.Equal(t, []string{"/uploads/tweet/a.webp"}, got.Images())
	assert.Equal(t, 0, got.LikeCount())
	assert.False(t, got.CreatedAt().IsZero())
}

func TestTweetRepository_FindByID_NotFound(t *testing.T) {
	repo := NewTweetRepository(setupTweetTestDB(t))
	_, err := repo.FindByID(context.Background(), domainshared.NewID())
	require.ErrorIs(t, err, domaintweet.ErrNotFound)
}

func TestTweetRepository_FindTimeline_Empty(t *testing.T) {
	repo := NewTweetRepository(setupTweetTestDB(t))
	items, err := repo.FindTimeline(context.Background(), nil, 20)
	require.NoError(t, err)
	assert.Empty(t, items)
}

func TestTweetRepository_FindTimeline_CursorPagination(t *testing.T) {
	repo := NewTweetRepository(setupTweetTestDB(t))
	ctx := context.Background()
	authorID := domainshared.NewID()
	base := time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)

	// 5 条推文，时间递增；时间线倒序应为 t5..t1
	ids := make([]domainshared.ID, 5)
	for i := range 5 {
		tw := mustSeedTweet(t, repo, authorID, "推文", base.Add(time.Duration(i)*time.Minute))
		ids[i] = tw.ID()
	}

	// 第一页：恰好取满 limit
	page1, err := repo.FindTimeline(ctx, nil, 2)
	require.NoError(t, err)
	require.Len(t, page1, 2)
	assert.Equal(t, ids[4], page1[0].ID())
	assert.Equal(t, ids[3], page1[1].ID())

	// 第二页：跨页
	cursor := &domaintweet.Cursor{CreatedAt: page1[1].CreatedAt(), ID: page1[1].ID()}
	page2, err := repo.FindTimeline(ctx, cursor, 2)
	require.NoError(t, err)
	require.Len(t, page2, 2)
	assert.Equal(t, ids[2], page2[0].ID())
	assert.Equal(t, ids[1], page2[1].ID())

	// 第三页：不足一页
	cursor = &domaintweet.Cursor{CreatedAt: page2[1].CreatedAt(), ID: page2[1].ID()}
	page3, err := repo.FindTimeline(ctx, cursor, 2)
	require.NoError(t, err)
	require.Len(t, page3, 1)
	assert.Equal(t, ids[0], page3[0].ID())

	// 第四页：空
	cursor = &domaintweet.Cursor{CreatedAt: page3[0].CreatedAt(), ID: page3[0].ID()}
	page4, err := repo.FindTimeline(ctx, cursor, 2)
	require.NoError(t, err)
	assert.Empty(t, page4)
}

func TestTweetRepository_FindTimeline_SameTimestampTiebreak(t *testing.T) {
	repo := NewTweetRepository(setupTweetTestDB(t))
	ctx := context.Background()
	authorID := domainshared.NewID()
	same := time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)

	// 同一微秒并发的 3 条推文：靠 id DESC 稳定 tiebreak，分页不重不漏
	for range 3 {
		mustSeedTweet(t, repo, authorID, "同刻推文", same)
	}

	seen := map[string]bool{}
	var cursor *domaintweet.Cursor
	for page := range 3 {
		items, err := repo.FindTimeline(ctx, cursor, 1)
		require.NoError(t, err)
		require.Len(t, items, 1, "第 %d 页应有 1 条", page+1)
		id := items[0].ID().String()
		assert.False(t, seen[id], "推文 %s 重复出现", id)
		seen[id] = true
		cursor = &domaintweet.Cursor{CreatedAt: items[0].CreatedAt(), ID: items[0].ID()}
	}
	assert.Len(t, seen, 3)

	items, err := repo.FindTimeline(ctx, cursor, 1)
	require.NoError(t, err)
	assert.Empty(t, items, "翻到底后应为空")
}

func TestTweetRepository_FindByAuthor(t *testing.T) {
	repo := NewTweetRepository(setupTweetTestDB(t))
	ctx := context.Background()
	alice := domainshared.NewID()
	bob := domainshared.NewID()
	base := time.Date(2026, 8, 7, 12, 0, 0, 0, time.UTC)

	mustSeedTweet(t, repo, alice, "alice 1", base)
	mustSeedTweet(t, repo, bob, "bob 1", base.Add(time.Minute))
	mustSeedTweet(t, repo, alice, "alice 2", base.Add(2*time.Minute))

	// 按作者过滤：只有 alice 的两条，倒序
	items, err := repo.FindByAuthor(ctx, alice, nil, 20)
	require.NoError(t, err)
	require.Len(t, items, 2)
	assert.Equal(t, "alice 2", items[0].Content())
	assert.Equal(t, "alice 1", items[1].Content())

	// 作者维度游标：翻页取到 alice 1
	cursor := &domaintweet.Cursor{CreatedAt: items[0].CreatedAt(), ID: items[0].ID()}
	page2, err := repo.FindByAuthor(ctx, alice, cursor, 1)
	require.NoError(t, err)
	require.Len(t, page2, 1)
	assert.Equal(t, "alice 1", page2[0].Content())

	// 无推文的作者：空
	items, err = repo.FindByAuthor(ctx, domainshared.NewID(), nil, 20)
	require.NoError(t, err)
	assert.Empty(t, items)
}

func TestTweetRepository_Delete(t *testing.T) {
	repo := NewTweetRepository(setupTweetTestDB(t))
	ctx := context.Background()

	tw := mustSeedTweet(t, repo, domainshared.NewID(), "将被删除", time.Now())
	require.NoError(t, repo.Delete(ctx, tw.ID()))

	_, err := repo.FindByID(ctx, tw.ID())
	require.ErrorIs(t, err, domaintweet.ErrNotFound)

	// 重复删除：不存在
	require.ErrorIs(t, repo.Delete(ctx, tw.ID()), domaintweet.ErrNotFound)
}
