package gorm

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/domain/post"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// setupPostTestDB 初始化 SQLite 测试库并迁移 post/tag 相关表。
func setupPostTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	tmpFile := filepath.Join(t.TempDir(), "post_test.db")
	db, err := gorm.Open(sqlite.Open(tmpFile), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Post{}, &model.Tag{}))
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func TestPostRepository_SaveSyncsTags(t *testing.T) {
	db := setupPostTestDB(t)

	// 预置两个 tag
	require.NoError(t, db.Create(&model.Tag{Name: "go", Slug: "go"}).Error)
	require.NoError(t, db.Create(&model.Tag{Name: "web", Slug: "web"}).Error)

	repo := NewPostRepository(db)
	pid := domainshared.NewID()
	authorID := domainshared.NewID()

	p, err := post.NewPost(pid, authorID, "Title One", "slug-1")
	require.NoError(t, err)
	p.SetTags([]string{"go", "web"})
	require.NoError(t, repo.Save(context.Background(), p))

	// 读回验证 tag 关联
	loaded, err := repo.FindByID(context.Background(), pid)
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"go", "web"}, loaded.Tags())

	// 更新：移除 web，新增 db
	require.NoError(t, db.Create(&model.Tag{Name: "db", Slug: "db"}).Error)
	loaded.SetTags([]string{"go", "db"})
	require.NoError(t, repo.Save(context.Background(), loaded))

	loaded2, err := repo.FindByID(context.Background(), pid)
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"go", "db"}, loaded2.Tags())
}

func TestPostRepository_SaveClearsTags(t *testing.T) {
	db := setupPostTestDB(t)
	require.NoError(t, db.Create(&model.Tag{Name: "go", Slug: "go"}).Error)

	repo := NewPostRepository(db)
	pid := domainshared.NewID()
	authorID := domainshared.NewID()

	p, err := post.NewPost(pid, authorID, "Title", "slug-clear")
	require.NoError(t, err)
	p.SetTags([]string{"go"})
	require.NoError(t, repo.Save(context.Background(), p))

	// 清空 tags
	p.SetTags([]string{})
	require.NoError(t, repo.Save(context.Background(), p))

	loaded, err := repo.FindByID(context.Background(), pid)
	require.NoError(t, err)
	assert.Empty(t, loaded.Tags())
}
