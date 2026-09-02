// Package gorm 提供 stats 仓储的 SQLite 集成测试。
//
// 直接用 model.* 写入种子数据（绕过 domain），专注验证 StatsStore 的
// 聚合查询口径与排序逻辑。
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

	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// setupStatsTestDB 初始化 SQLite 测试库并迁移 stats 依赖的表。
func setupStatsTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	tmpFile := filepath.Join(t.TempDir(), "stats_test.db")
	db, err := gorm.Open(sqlite.Open(tmpFile), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Post{}, &model.Comment{}, &model.User{}, &model.PostView{}, &model.FriendLink{}, &model.Subscription{}))
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

// seedPost 直接用 GORM 写一条文章记录（绕过 domain），便于验证统计聚合查询。
func seedPost(t *testing.T, db *gorm.DB, id uuid.UUID, title, slug, status, contentHTML string, viewCount int, createdAt time.Time, publishedAt *time.Time) {
	t.Helper()
	p := model.Post{
		ID: id, Title: title, Slug: slug, Status: status, ContentHTML: contentHTML,
		ViewCount: viewCount, AuthorID: uuid.New(),
		CreatedAt: createdAt, UpdatedAt: createdAt, PublishedAt: publishedAt,
	}
	require.NoError(t, db.Create(&p).Error)
}

// seedComment 直接用 GORM 写一条评论记录。
func seedComment(t *testing.T, db *gorm.DB, postID uuid.UUID, status string) {
	t.Helper()
	c := model.Comment{
		ID: uuid.New(), PostID: postID, Path: "/",
		AuthorName: "anon", AuthorEmail: "c@example.com",
		Body: "nice", Pictures: []byte("[]"), Status: status,
	}
	require.NoError(t, db.Create(&c).Error)
}

// seedView 直接写一条浏览事件记录。
func seedView(t *testing.T, db *gorm.DB, postID uuid.UUID, createdAt time.Time) {
	t.Helper()
	require.NoError(t, db.Create(&model.PostView{
		PostID: postID, IPAddress: "127.0.0.1", CreatedAt: createdAt,
	}).Error)
}

// seedCommentAt 写一条指定创建时间的评论（对比口径测试用）。
func seedCommentAt(t *testing.T, db *gorm.DB, postID uuid.UUID, status string, createdAt time.Time) {
	t.Helper()
	c := model.Comment{
		ID: uuid.New(), PostID: postID, Path: "/",
		AuthorName: "anon", AuthorEmail: "c@example.com",
		Body: "nice", Pictures: []byte("[]"), Status: status,
		CreatedAt: createdAt, UpdatedAt: createdAt,
	}
	require.NoError(t, db.Create(&c).Error)
}

// seedFriendLink 写一条友链申请记录。
func seedFriendLink(t *testing.T, db *gorm.DB, status string) {
	t.Helper()
	require.NoError(t, db.Create(&model.FriendLink{
		ID: uuid.New(), Name: "foo", URL: "https://example.com", Status: status,
	}).Error)
}

// seedSubscription 写一条订阅源记录。failures 为连续失败次数。
func seedSubscription(t *testing.T, db *gorm.DB, failures int) {
	t.Helper()
	require.NoError(t, db.Create(&model.Subscription{
		ID: uuid.New(), UserID: uuid.New(), FeedURL: "https://example.com/rss",
		Interval: "daily", Status: "active", ConsecutiveFailures: failures,
	}).Error)
}

// ============================================================
// StatsStore.GetDashboard 集成测试
// ============================================================

func TestStatsStore_GetDashboard_Empty(t *testing.T) {
	db := setupStatsTestDB(t)
	store := NewStatsStore(db)

	stats, err := store.GetDashboard(context.Background())
	require.NoError(t, err)

	assert.Equal(t, int64(0), stats.TotalPosts)
	assert.Equal(t, int64(0), stats.TotalComments)
	assert.Equal(t, int64(0), stats.PendingComments)
	assert.Equal(t, int64(0), stats.TotalUsers)
	assert.Equal(t, int64(0), stats.TotalViews)
	assert.Empty(t, stats.RecentPosts)
	assert.Empty(t, stats.PopularPosts)
	assert.NotNil(t, stats.RecentPosts)
	assert.NotNil(t, stats.PopularPosts)
}

func TestStatsStore_GetDashboard_WithData(t *testing.T) {
	db := setupStatsTestDB(t)
	ctx := context.Background()

	// 三篇文章：两篇 published（浏览量不同）+ 一篇 draft，created_at 各异便于排序断言
	base := time.Now().Add(-2 * time.Hour)
	postA := uuid.New() // published, view 10, 最早
	postB := uuid.New() // published, view 5,  中间
	postC := uuid.New() // draft,     view 0, 最新
	pubA := base.Add(2 * time.Hour) // PostA 发布时间
	pubB := base.Add(3 * time.Hour) // PostB 发布时间，晚于 A → recent 首位
	seedPost(t, db, postA, "PostA", "slug-a", "published", "", 10, base, &pubA)
	seedPost(t, db, postB, "PostB", "slug-b", "published", "", 5, base.Add(time.Hour), &pubB)
	seedPost(t, db, postC, "PostC", "slug-c", "draft", "", 0, base.Add(2*time.Hour), nil)

	// 两条评论：1 pending + 1 approved
	seedComment(t, db, postA, "pending")
	seedComment(t, db, postB, "approved")

	// 一个用户
	require.NoError(t, db.Create(&model.User{
		BaseModel:   model.BaseModel{ID: uuid.New()},
		Username:    "alice",
		Email:       "alice@example.com",
		PasswordHash: "x",
	}).Error)

	// 友链：1 pending（计入待审）+ 1 approved（不计）
	seedFriendLink(t, db, "pending")
	seedFriendLink(t, db, "approved")
	// 订阅：连续失败 2 个（计入异常）+ 正常 1 个（不计）
	seedSubscription(t, db, 3)
	seedSubscription(t, db, 5)
	seedSubscription(t, db, 0)

	store := NewStatsStore(db)
	stats, err := store.GetDashboard(ctx)
	require.NoError(t, err)

	// 计数口径
	assert.Equal(t, int64(1), stats.PendingFriendLinks, "待审友链：仅 pending 计入")
	assert.Equal(t, int64(2), stats.FailingSubscriptions, "订阅异常：consecutive_failures>0 的 2 个")
	assert.Equal(t, int64(3), stats.TotalPosts)            // 含 draft
	assert.Equal(t, int64(2), stats.TotalComments)         // 含 pending
	assert.Equal(t, int64(1), stats.PendingComments)       // 仅 pending
	assert.Equal(t, int64(1), stats.TotalUsers)
	assert.Equal(t, int64(15), stats.TotalViews)           // 10 + 5 + 0

	// RecentPosts：仅 published，按 published_at DESC → PostB, PostA（draft PostC 不计）
	require.Len(t, stats.RecentPosts, 2)
	assert.Equal(t, "PostB", stats.RecentPosts[0].Title)
	assert.Equal(t, "PostA", stats.RecentPosts[1].Title)

	// PopularPosts：仅 published，按 view_count DESC → PostA(10), PostB(5)
	require.Len(t, stats.PopularPosts, 2)
	assert.Equal(t, "PostA", stats.PopularPosts[0].Title)
	assert.Equal(t, 10, stats.PopularPosts[0].ViewCount)
	assert.Equal(t, "PostB", stats.PopularPosts[1].Title)
	assert.Equal(t, 5, stats.PopularPosts[1].ViewCount)
}

// ============================================================
// StatsStore 对比口径（今日/昨日浏览、本周/上周评论）
// ============================================================

func TestStatsStore_GetDashboard_ComparisonWindows(t *testing.T) {
	db := setupStatsTestDB(t)
	ctx := context.Background()

	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	yesterdayStart := todayStart.AddDate(0, 0, -1)
	mondayStart := todayStart.AddDate(0, 0, -((int(now.Weekday())+6)%7))
	post := uuid.New()
	seedPost(t, db, post, "P", "slug", "published", "", 0, now, nil)

	// 浏览：今日 2（now 与今早之间取值）、昨日 3、前日 1（两窗口均不计）
	seedView(t, db, post, now)
	seedView(t, db, post, now)
	seedView(t, db, post, yesterdayStart.Add(2*time.Hour))
	seedView(t, db, post, yesterdayStart.Add(3*time.Hour))
	seedView(t, db, post, yesterdayStart.Add(4*time.Hour))
	seedView(t, db, post, yesterdayStart.Add(-1*time.Hour))

	// 评论：本周 2（now 与本周内取值）、上周 1、上上周 1（不计）
	seedCommentAt(t, db, post, "approved", now)
	seedCommentAt(t, db, post, "pending", mondayStart.Add(12*time.Hour))
	seedCommentAt(t, db, post, "approved", mondayStart.AddDate(0, 0, -1).Add(12*time.Hour))
	seedCommentAt(t, db, post, "approved", mondayStart.AddDate(0, 0, -8))

	store := NewStatsStore(db)
	stats, err := store.GetDashboard(ctx)
	require.NoError(t, err)

	assert.Equal(t, int64(2), stats.TodayViews, "今日浏览：now 两条")
	assert.Equal(t, int64(3), stats.YesterdayViews, "昨日浏览：昨日窗口三条")
	assert.Equal(t, int64(2), stats.WeekComments, "本周评论：now + 周一 12 点（含 pending）")
	assert.Equal(t, int64(1), stats.LastWeekComments, "上周评论：上周内一条")
}

// ============================================================
// StatsStore.GetViewTrends 应用层分桶
// ============================================================

func TestStatsStore_GetViewTrends_Bucketing(t *testing.T) {
	db := setupStatsTestDB(t)
	ctx := context.Background()

	now := time.Now()
	post := uuid.New()
	seedPost(t, db, post, "P", "slug", "published", "", 0, now, nil)

	// 今日 2、8 天前 3（7 天窗口外、30 天窗口内）、400 天前 1（12 个月外全排除）
	seedView(t, db, post, now)
	seedView(t, db, post, now)
	seedView(t, db, post, now.AddDate(0, 0, -8))
	seedView(t, db, post, now.AddDate(0, 0, -8))
	seedView(t, db, post, now.AddDate(0, 0, -8))
	seedView(t, db, post, now.AddDate(0, 0, -400))

	store := NewStatsStore(db)

	// days=7：补零输出 7 个自然日（含今天），8 天前与 400 天前均排除 → 仅今日 2 条
	t7, err := store.GetViewTrends(ctx, 7)
	require.NoError(t, err)
	require.Len(t, t7.Daily, 7, "7 天档补零输出 7 个自然日")
	var sum7 int64
	zeroDays7 := 0
	for _, p := range t7.Daily {
		sum7 += p.Count
		if p.Count == 0 {
			zeroDays7++
		}
	}
	assert.Equal(t, int64(2), sum7, "7 天窗口：8 天前与 400 天前均排除")
	assert.Equal(t, 6, zeroDays7, "无浏览的 6 天补零点")
	assert.Equal(t, now.Format("2006-01-02"), t7.Daily[6].Label, "末位为今天")

	// days=30：补零 30 个自然日；今日 2 + 8 天前 3
	t30, err := store.GetViewTrends(ctx, 30)
	require.NoError(t, err)
	require.Len(t, t30.Daily, 30, "30 天档补零输出 30 个自然日")
	var sum30 int64
	for _, p := range t30.Daily {
		sum30 += p.Count
	}
	assert.Equal(t, int64(5), sum30, "30 天窗口：400 天前仍排除")

	// 月聚合与 days 无关：补零 12 个自然月，覆盖窗口内全部 5 条
	require.Len(t, t30.Monthly, 12, "月档补零输出 12 个自然月")
	var sumM int64
	for i, p := range t30.Monthly {
		sumM += p.Count
		if i > 0 {
			assert.Less(t, t30.Monthly[i-1].Label, p.Label, "月聚合按 Label 升序")
		}
	}
	assert.Equal(t, int64(5), sumM, "月口径：400 天前排除，其余 5 条计入")
	assert.Equal(t, now.Format("2006-01"), t30.Monthly[11].Label, "末位为当月")

	// days=90 非白名单值：归一化在 service 层，store 按原始窗口补零 90 天
	tn, err := store.GetViewTrends(ctx, 90)
	require.NoError(t, err)
	require.Len(t, tn.Daily, 90)
	var sumN int64
	for _, p := range tn.Daily {
		sumN += p.Count
	}
	assert.Equal(t, int64(5), sumN)
}

func TestStatsStore_GetViewTrends_ZeroFilled(t *testing.T) {
	db := setupStatsTestDB(t)

	// 空库：无任何浏览事件，序列仍完整输出（全零），而非空数组
	store := NewStatsStore(db)
	trends, err := store.GetViewTrends(context.Background(), 30)
	require.NoError(t, err)
	require.Len(t, trends.Daily, 30, "空库 30 天档输出 30 个零点")
	require.Len(t, trends.Monthly, 12, "空库月档输出 12 个零点")
	for _, p := range trends.Daily {
		assert.Equal(t, int64(0), p.Count)
	}
}

// ============================================================
// StatsStore.GetPublic 集成测试
// ============================================================

func TestStatsStore_GetPublic(t *testing.T) {
	db := setupStatsTestDB(t)
	ctx := context.Background()

	// 一篇 published（带 HTML 正文，验证字数剥离口径）+ 一篇 draft（不计入）
	postA := uuid.New()
	pubAt := time.Now()
	seedPost(t, db, postA, "PublishedA", "slug-a", "published", "<p>hello</p>", 3, time.Now(), &pubAt)
	seedPost(t, db, uuid.New(), "DraftB", "slug-b", "draft", "", 0, time.Now(), nil)

	// 评论：1 approved（计入）+ 1 pending（不计入）
	seedComment(t, db, postA, "approved")
	seedComment(t, db, postA, "pending")

	store := NewStatsStore(db)
	stats, err := store.GetPublic(ctx)
	require.NoError(t, err)

	// 仅 published 文章计入 → 1（draft 不计）
	assert.Equal(t, int64(1), stats.PostsCount)
	// 剥离 HTML 标签后 "<p>hello</p>" → "hello" = 5 字符
	assert.Equal(t, int64(5), stats.TotalWords)
	// 仅 approved 评论计入；pending 不计 → 1
	assert.Equal(t, int64(1), stats.CommentsCount)
}
