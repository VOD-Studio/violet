package gorm

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	domainentry "blog-api/internal/domain/subscription_entry"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// setupEntryTestDB 初始化 SQLite 临时文件库并迁移 subscription_entries 表。
func setupEntryTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	tmpFile := filepath.Join(t.TempDir(), "test.db")
	db, err := gorm.Open(sqlite.Open(tmpFile), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.SubscriptionEntry{}))
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

// TestEntryRepository_SaveNewAndFind 首次 Save（id=0）应回写自增主键，再按 (sub,guid) 查回。
func TestEntryRepository_SaveNewAndFind(t *testing.T) {
	db := setupEntryTestDB(t)
	repo := NewSubscriptionEntryRepository(db)
	ctx := context.Background()

	subID := shared.NewID()
	now := time.Now()
	publishedAt := now.Add(-1 * time.Hour)
	e := domainentry.NewEntry(subID, "guid-001", "https://example.com/post1", "标题一", &publishedAt, now)

	// 新建对象 id=0
	require.Equal(t, int64(0), e.ID())
	require.NoError(t, repo.Save(ctx, e))
	assert.NotZero(t, e.ID(), "Save 后应回写自增 id")

	got, err := repo.FindBySubAndGUID(ctx, subID, "guid-001")
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, e.ID(), got.ID())
	assert.Equal(t, subID, got.SubscriptionID())
	assert.Equal(t, "guid-001", got.GUID())
	assert.Equal(t, "https://example.com/post1", got.EntryURL())
	assert.Equal(t, "标题一", got.Title())
	assert.Nil(t, got.PostID(), "新建条目无 post_id")
	assert.Equal(t, domainentry.StatusPending, got.Status())
	assert.Equal(t, 0, got.FailCount())
	require.NotNil(t, got.PublishedAt())
	assert.WithinDuration(t, publishedAt, *got.PublishedAt(), time.Second)
}

// TestEntryRepository_SaveUpdate 已有 id 的对象 Save 走更新路径，字段变更应落库。
func TestEntryRepository_SaveUpdate(t *testing.T) {
	db := setupEntryTestDB(t)
	repo := NewSubscriptionEntryRepository(db)
	ctx := context.Background()

	subID := shared.NewID()
	now := time.Now()
	e := domainentry.NewEntry(subID, "guid-upd", "https://example.com/upd", "原标题", nil, now)
	require.NoError(t, repo.Save(ctx, e))
	require.NotZero(t, e.ID())

	// 初始：pending、无 post_id
	got, err := repo.FindBySubAndGUID(ctx, subID, "guid-upd")
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, domainentry.StatusPending, got.Status())
	assert.Nil(t, got.PostID())

	// MarkImported → imported + post_id，再 Save 更新
	postID := shared.NewID()
	e.MarkImported(postID)
	require.NoError(t, repo.Save(ctx, e))

	got, err = repo.FindBySubAndGUID(ctx, subID, "guid-upd")
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, e.ID(), got.ID(), "更新后 id 不应变（走更新非新建）")
	assert.Equal(t, domainentry.StatusImported, got.Status())
	require.NotNil(t, got.PostID())
	assert.Equal(t, postID, *got.PostID())
}

// TestEntryRepository_FindBySubAndGUID_NotFound 无匹配返回 nil,nil（非 error）。
func TestEntryRepository_FindBySubAndGUID_NotFound(t *testing.T) {
	db := setupEntryTestDB(t)
	repo := NewSubscriptionEntryRepository(db)
	ctx := context.Background()

	got, err := repo.FindBySubAndGUID(ctx, shared.NewID(), "no-such-guid")
	require.NoError(t, err, "无匹配应返回 nil,nil 而非 error")
	assert.Nil(t, got)
}
