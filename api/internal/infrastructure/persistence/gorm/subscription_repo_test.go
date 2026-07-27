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

	domainsub "blog-api/internal/domain/subscription"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// setupSubTestDB 镜像 setupTokenTestDB：sqlite 临时文件 + AutoMigrate。
// 用 sqlite 做契约测试既快又能抓 SQL bug（业界共识，见 HN "Database mocks are not worth it"）。
func setupSubTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	tmpDir := t.TempDir()
	tmpFile := tmpDir + "/test.db"
	db, err := gorm.Open(sqlite.Open(tmpFile), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Subscription{}))
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func mustNewSub(t *testing.T, userID shared.ID, feedURL string) *domainsub.Subscription {
	t.Helper()
	s, err := domainsub.NewSubscription(userID, feedURL, "源", domainsub.IntervalDaily, time.Now())
	require.NoError(t, err)
	return s
}

func TestSubscriptionRepository_SaveAndFindByID(t *testing.T) {
	db := setupSubTestDB(t)
	repo := NewSubscriptionRepository(db)
	ctx := context.Background()
	uid := shared.NewID()

	s := mustNewSub(t, uid, "https://example.com/feed.xml")
	require.NoError(t, repo.Save(ctx, s))

	got, err := repo.FindByID(ctx, s.ID(), uid)
	require.NoError(t, err)
	assert.Equal(t, s.ID(), got.ID())
	assert.Equal(t, "https://example.com/feed.xml", got.FeedURL())
	assert.Equal(t, domainsub.StatusActive, got.Status())
	assert.Equal(t, domainsub.IntervalDaily, got.Interval())
	assert.Equal(t, []string{}, got.Tags(), "默认 tags 应空切片非 nil")
}

func TestSubscriptionRepository_FindByID_NotFound(t *testing.T) {
	db := setupSubTestDB(t)
	repo := NewSubscriptionRepository(db)
	uid := shared.NewID()

	_, err := repo.FindByID(context.Background(), shared.NewID(), uid)
	assert.ErrorIs(t, err, domainsub.ErrNotFound)
}

func TestSubscriptionRepository_FindByID_PreventsCrossUser(t *testing.T) {
	db := setupSubTestDB(t)
	repo := NewSubscriptionRepository(db)
	ctx := context.Background()

	owner := shared.NewID()
	other := shared.NewID()
	s := mustNewSub(t, owner, "https://example.com/feed")
	require.NoError(t, repo.Save(ctx, s))

	// 他人用自己 userID 查 → NotFound（防跨用户）
	_, err := repo.FindByID(ctx, s.ID(), other)
	assert.ErrorIs(t, err, domainsub.ErrNotFound, "跨用户查询应返回 NotFound")
}

func TestSubscriptionRepository_FindByUser_StatusFilterAndPaging(t *testing.T) {
	db := setupSubTestDB(t)
	repo := NewSubscriptionRepository(db)
	ctx := context.Background()
	uid := shared.NewID()

	// 建 3 个订阅，其中 1 个 paused
	subs := []*domainsub.Subscription{
		mustNewSub(t, uid, "https://a/feed"),
		mustNewSub(t, uid, "https://b/feed"),
		mustNewSub(t, uid, "https://c/feed"),
	}
	subs[0].Pause()
	for _, s := range subs {
		require.NoError(t, repo.Save(ctx, s))
	}

	// 全部
	all, total, err := repo.FindByUser(ctx, uid, "", 1, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(3), total)
	assert.Len(t, all, 3)

	// 只 active
	active, total, err := repo.FindByUser(ctx, uid, domainsub.StatusActive, 1, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	assert.Len(t, active, 2)
	for _, s := range active {
		assert.Equal(t, domainsub.StatusActive, s.Status())
	}

	// 只 paused
	paused, total, err := repo.FindByUser(ctx, uid, domainsub.StatusPaused, 1, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	assert.Len(t, paused, 1)
}

func TestSubscriptionRepository_FindByUser_OtherUserEmpty(t *testing.T) {
	db := setupSubTestDB(t)
	repo := NewSubscriptionRepository(db)
	ctx := context.Background()

	owner := shared.NewID()
	require.NoError(t, repo.Save(ctx, mustNewSub(t, owner, "https://a/feed")))

	// 他人查询应空
	other := shared.NewID()
	got, total, err := repo.FindByUser(ctx, other, "", 1, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(0), total)
	assert.Empty(t, got)
}

func TestSubscriptionRepository_Delete(t *testing.T) {
	db := setupSubTestDB(t)
	repo := NewSubscriptionRepository(db)
	ctx := context.Background()
	uid := shared.NewID()

	s := mustNewSub(t, uid, "https://example.com/feed")
	require.NoError(t, repo.Save(ctx, s))

	require.NoError(t, repo.Delete(ctx, s.ID(), uid))
	_, err := repo.FindByID(ctx, s.ID(), uid)
	assert.ErrorIs(t, err, domainsub.ErrNotFound)
}

func TestSubscriptionRepository_Delete_PreventsCrossUser(t *testing.T) {
	db := setupSubTestDB(t)
	repo := NewSubscriptionRepository(db)
	ctx := context.Background()

	owner := shared.NewID()
	other := shared.NewID()
	s := mustNewSub(t, owner, "https://example.com/feed")
	require.NoError(t, repo.Save(ctx, s))

	// 他人删 → NotFound，且原订阅仍在
	err := repo.Delete(ctx, s.ID(), other)
	assert.ErrorIs(t, err, domainsub.ErrNotFound)

	got, err := repo.FindByID(ctx, s.ID(), owner)
	require.NoError(t, err, "他人删除不应生效，原订阅应仍在")
	assert.Equal(t, s.ID(), got.ID())
}

func TestSubscriptionRepository_Save_UpdatesExisting(t *testing.T) {
	db := setupSubTestDB(t)
	repo := NewSubscriptionRepository(db)
	ctx := context.Background()
	uid := shared.NewID()

	s := mustNewSub(t, uid, "https://example.com/feed")
	require.NoError(t, repo.Save(ctx, s))

	// 改配置后重新 Save（upsert）
	require.NoError(t, s.UpdateConfig("新标题", domainsub.IntervalWeekly, true, "", []string{"x"}))
	require.NoError(t, repo.Save(ctx, s))

	got, err := repo.FindByID(ctx, s.ID(), uid)
	require.NoError(t, err)
	assert.Equal(t, "新标题", got.Title())
	assert.Equal(t, domainsub.IntervalWeekly, got.Interval())
	assert.True(t, got.AutoPublish())
	assert.Equal(t, []string{"x"}, got.Tags())
}

// TestSubscriptionRepository_Roundtrip_PreservesOptionalTimestamps
// 验证 nullable 时间字段（last_fetched_at / next_fetch_at / retry_after_until）
// 在 Save→FindByID roundtrip 中正确保持。
func TestSubscriptionRepository_Roundtrip_PreservesOptionalTimestamps(t *testing.T) {
	db := setupSubTestDB(t)
	repo := NewSubscriptionRepository(db)
	ctx := context.Background()
	uid := shared.NewID()

	s := mustNewSub(t, uid, "https://example.com/feed")
	now := time.Now().UTC().Truncate(time.Second)
	future := now.Add(time.Hour)
	s.RecordSuccess(now)   // 设 lastFetchedAt + nextFetchAt
	s.SetRetryAfter(future) // 设 retryAfterUntil
	require.NotNil(t, s.LastFetchedAt())
	require.NoError(t, repo.Save(ctx, s))

	got, err := repo.FindByID(ctx, s.ID(), uid)
	require.NoError(t, err)
	require.NotNil(t, got.LastFetchedAt())
	assert.Equal(t, now.Unix(), got.LastFetchedAt().Unix())
	require.NotNil(t, got.NextFetchAt())
	require.NotNil(t, got.RetryAfterUntil())
}
