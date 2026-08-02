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
	require.NoError(t, db.AutoMigrate(&model.Post{}, &model.Comment{}, &model.User{}, &model.PostView{}))
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

// seedPost 直接用 GORM 写一条文章记录（绕过 domain），便于验证统计聚合查询。
func seedPost(t *testing.T, db *gorm.DB, id uuid.UUID, title, slug, status, contentHTML string, viewCount int, createdAt time.Time) {
	t.Helper()
	p := model.Post{
		ID: id, Title: title, Slug: slug, Status: status, ContentHTML: contentHTML,
		ViewCount: viewCount, AuthorID: uuid.New(),
		CreatedAt: createdAt, UpdatedAt: createdAt,
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
}

func TestStatsStore_GetDashboard_WithData(t *testing.T) {
	db := setupStatsTestDB(t)
	ctx := context.Background()

	// 三篇文章：两篇 published（浏览量不同）+ 一篇 draft，created_at 各异便于排序断言
	base := time.Now().Add(-2 * time.Hour)
	postA := uuid.New() // published, view 10, 最早
	postB := uuid.New() // published, view 5,  中间
	postC := uuid.New() // draft,     view 0, 最新
	seedPost(t, db, postA, "PostA", "slug-a", "published", "", 10, base)
	seedPost(t, db, postB, "PostB", "slug-b", "published", "", 5, base.Add(time.Hour))
	seedPost(t, db, postC, "PostC", "slug-c", "draft", "", 0, base.Add(2*time.Hour))

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

	store := NewStatsStore(db)
	stats, err := store.GetDashboard(ctx)
	require.NoError(t, err)

	// 计数口径
	assert.Equal(t, int64(3), stats.TotalPosts)            // 含 draft
	assert.Equal(t, int64(2), stats.TotalComments)         // 含 pending
	assert.Equal(t, int64(1), stats.PendingComments)       // 仅 pending
	assert.Equal(t, int64(1), stats.TotalUsers)
	assert.Equal(t, int64(15), stats.TotalViews)           // 10 + 5 + 0

	// RecentPosts：按 created_at DESC，无 status 过滤 → PostC, PostB, PostA
	require.Len(t, stats.RecentPosts, 3)
	assert.Equal(t, "PostC", stats.RecentPosts[0].Title)
	assert.Equal(t, "PostB", stats.RecentPosts[1].Title)
	assert.Equal(t, "PostA", stats.RecentPosts[2].Title)

	// PopularPosts：仅 published，按 view_count DESC → PostA(10), PostB(5)
	require.Len(t, stats.PopularPosts, 2)
	assert.Equal(t, "PostA", stats.PopularPosts[0].Title)
	assert.Equal(t, 10, stats.PopularPosts[0].ViewCount)
	assert.Equal(t, "PostB", stats.PopularPosts[1].Title)
	assert.Equal(t, 5, stats.PopularPosts[1].ViewCount)
}

// ============================================================
// StatsStore.GetPublic 集成测试
// ============================================================

func TestStatsStore_GetPublic(t *testing.T) {
	db := setupStatsTestDB(t)
	ctx := context.Background()

	// 一篇 published（带 HTML 正文，验证字数剥离口径）+ 一篇 draft（不计入）
	postA := uuid.New()
	seedPost(t, db, postA, "PublishedA", "slug-a", "published", "<p>hello</p>", 3, time.Now())
	seedPost(t, db, uuid.New(), "DraftB", "slug-b", "draft", "", 0, time.Now())

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
