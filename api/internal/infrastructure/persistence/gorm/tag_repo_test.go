package gorm

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	domaintag "blog-api/internal/domain/tag"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// setupTagTestDB 初始化 SQLite 临时文件库并迁移 tags 表。
func setupTagTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	tmpDir := t.TempDir()
	tmpFile := tmpDir + "/test.db"
	db, err := gorm.Open(sqlite.Open(tmpFile), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Tag{}))
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

// createTag 便捷创建一个标签并返回其 id。
func createTag(t *testing.T, repo *TagRepository, name, slug string) int32 {
	t.Helper()
	id, err := repo.Save(context.Background(), domaintag.NewTag(0, name, slug))
	require.NoError(t, err)
	require.NotZero(t, id)
	return id
}

func TestTagRepository_SaveCreateAndFind(t *testing.T) {
	repo := NewTagRepository(setupTagTestDB(t))
	ctx := context.Background()

	id, err := repo.Save(ctx, domaintag.NewTag(0, "Go", "go"))
	require.NoError(t, err)
	require.NotZero(t, id)

	// FindByID
	got, err := repo.FindByID(ctx, id)
	require.NoError(t, err)
	assert.Equal(t, id, got.ID())
	assert.Equal(t, "Go", got.Name())
	assert.Equal(t, "go", got.Slug())

	// FindBySlug
	gotSlug, err := repo.FindBySlug(ctx, "go")
	require.NoError(t, err)
	assert.Equal(t, id, gotSlug.ID())
	assert.Equal(t, "Go", gotSlug.Name())

	// FindAll
	all, err := repo.FindAll(ctx)
	require.NoError(t, err)
	require.Len(t, all, 1)
	assert.Equal(t, id, all[0].ID())
}

func TestTagRepository_SaveUpdate(t *testing.T) {
	repo := NewTagRepository(setupTagTestDB(t))
	ctx := context.Background()

	id := createTag(t, repo, "Go", "go")

	// 用已有 id 更新名称
	returnedID, err := repo.Save(ctx, domaintag.NewTag(id, "Golang", "go"))
	require.NoError(t, err)
	assert.Equal(t, id, returnedID)

	got, err := repo.FindByID(ctx, id)
	require.NoError(t, err)
	assert.Equal(t, "Golang", got.Name())
	assert.Equal(t, "go", got.Slug())
}

func TestTagRepository_Delete(t *testing.T) {
	repo := NewTagRepository(setupTagTestDB(t))
	ctx := context.Background()

	id := createTag(t, repo, "Go", "go")
	require.NoError(t, repo.Delete(ctx, id))

	// 删除后查不到
	_, err := repo.FindByID(ctx, id)
	assert.ErrorIs(t, err, domaintag.ErrNotFound)

	// 删除不存在的 → ErrNotFound
	err = repo.Delete(ctx, 99999)
	assert.ErrorIs(t, err, domaintag.ErrNotFound)
}

func TestTagRepository_ExistsBySlug(t *testing.T) {
	repo := NewTagRepository(setupTagTestDB(t))
	ctx := context.Background()

	createTag(t, repo, "Go", "go")

	exists, err := repo.ExistsBySlug(ctx, "go")
	require.NoError(t, err)
	assert.True(t, exists)

	exists, err = repo.ExistsBySlug(ctx, "rust")
	require.NoError(t, err)
	assert.False(t, exists)
}

func TestTagRepository_FindNotFound(t *testing.T) {
	repo := NewTagRepository(setupTagTestDB(t))
	ctx := context.Background()

	_, err := repo.FindByID(ctx, 99999)
	assert.ErrorIs(t, err, domaintag.ErrNotFound)

	_, err = repo.FindBySlug(ctx, "nope")
	assert.ErrorIs(t, err, domaintag.ErrNotFound)
}
