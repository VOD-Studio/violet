package gorm

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// setupSettingsTestDB 初始化 SQLite 临时文件库并迁移 site_settings 表。
func setupSettingsTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	tmpDir := t.TempDir()
	tmpFile := tmpDir + "/test.db"
	db, err := gorm.Open(sqlite.Open(tmpFile), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&SiteSetting{}))
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func TestSettingsStore_UpsertAndGetAll(t *testing.T) {
	store := NewSettingsStore(setupSettingsTestDB(t))
	ctx := context.Background()

	require.NoError(t, store.Upsert(ctx, "site_title", "Violet"))

	all, err := store.GetAll(ctx)
	require.NoError(t, err)
	assert.Equal(t, "Violet", all["site_title"])
}

func TestSettingsStore_Upsert_Overwrite(t *testing.T) {
	store := NewSettingsStore(setupSettingsTestDB(t))
	ctx := context.Background()

	require.NoError(t, store.Upsert(ctx, "lang", "en"))
	require.NoError(t, store.Upsert(ctx, "lang", "zh")) // 覆盖

	all, err := store.GetAll(ctx)
	require.NoError(t, err)
	assert.Equal(t, "zh", all["lang"])
	assert.Len(t, all, 1)
}

func TestSettingsStore_UpsertMany(t *testing.T) {
	store := NewSettingsStore(setupSettingsTestDB(t))
	ctx := context.Background()

	require.NoError(t, store.UpsertMany(ctx, map[string]string{
		"a": "1",
		"b": "2",
		"c": "3",
	}))

	all, err := store.GetAll(ctx)
	require.NoError(t, err)
	require.Len(t, all, 3)
	assert.Equal(t, "1", all["a"])
	assert.Equal(t, "2", all["b"])
	assert.Equal(t, "3", all["c"])
}

func TestSettingsStore_GetAll_Empty(t *testing.T) {
	store := NewSettingsStore(setupSettingsTestDB(t))

	all, err := store.GetAll(context.Background())
	require.NoError(t, err)
	assert.Empty(t, all)
}
