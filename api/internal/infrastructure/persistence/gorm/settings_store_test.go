package gorm

import (
	"context"
	"errors"
	"testing"

	domainsettings "blog-api/internal/domain/settings"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupSettingsTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/settings.db"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&SiteSetting{}, &settingsGroupVersion{}))
	for _, group := range domainsettings.Groups() {
		require.NoError(t, db.Create(&settingsGroupVersion{Group: string(group)}).Error)
	}
	pool, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = pool.Close() })
	return db
}

func TestSettingsGroupCASAndRollback(t *testing.T) {
	db := setupSettingsTestDB(t)
	store := NewSettingsStore(db)
	other := NewSettingsStore(db)
	ctx := context.Background()
	saved, err := store.ChangeGroup(ctx, domainsettings.General, 0, func(values map[string]string) (map[string]string, error) {
		values["site_name"] = "Original"
		return values, nil
	})
	require.NoError(t, err)
	require.Equal(t, int64(1), saved.Version)
	_, err = other.ChangeGroup(ctx, domainsettings.General, 0, func(values map[string]string) (map[string]string, error) {
		values["site_name"] = "Stale overwrite"
		return values, nil
	})
	require.ErrorIs(t, err, domainsettings.ErrVersionConflict)
	rejected := errors.New("whole-group validation rejected")
	_, err = store.ChangeGroup(ctx, domainsettings.General, 1, func(values map[string]string) (map[string]string, error) {
		values["site_name"] = "Invalid partial write"
		return values, rejected
	})
	require.ErrorIs(t, err, rejected)
	current, err := other.ReadGroup(ctx, domainsettings.General)
	require.NoError(t, err)
	assert.Equal(t, int64(1), current.Version)
	assert.Equal(t, "Original", current.Values["site_name"])
}

func TestSettingsGroupIsolationAndReset(t *testing.T) {
	store := NewSettingsStore(setupSettingsTestDB(t))
	ctx := context.Background()
	_, err := store.ChangeGroup(ctx, domainsettings.Github, 0, func(values map[string]string) (map[string]string, error) {
		values["github_token"] = "protected"
		return values, nil
	})
	require.NoError(t, err)
	_, err = store.ChangeGroup(ctx, domainsettings.General, 0, func(values map[string]string) (map[string]string, error) {
		values["site_name"] = "Should rollback"
		values["github_token"] = "cross-group overwrite"
		return values, nil
	})
	require.Error(t, err)
	general, err := store.ReadGroup(ctx, domainsettings.General)
	require.NoError(t, err)
	assert.Zero(t, general.Version)
	assert.NotContains(t, general.Values, "site_name")
	_, err = store.ChangeGroup(ctx, domainsettings.General, 0, func(values map[string]string) (map[string]string, error) {
		values["footer_text"] = ""
		values["comments_enabled"] = "false"
		values["custom_emoji_max_per_user"] = "0"
		return values, nil
	})
	require.NoError(t, err)
	saved, err := store.ReadGroup(ctx, domainsettings.General)
	require.NoError(t, err)
	assert.Equal(t, map[string]string{"footer_text": "", "comments_enabled": "false", "custom_emoji_max_per_user": "0"}, saved.Values)
	_, err = store.ChangeGroup(ctx, domainsettings.General, 1, func(map[string]string) (map[string]string, error) { return map[string]string{}, nil })
	require.NoError(t, err)
	github, err := store.ReadGroup(ctx, domainsettings.Github)
	require.NoError(t, err)
	assert.Equal(t, "protected", github.Values["github_token"])
	general, err = store.ReadGroup(ctx, domainsettings.General)
	require.NoError(t, err)
	assert.Empty(t, general.Values)
	assert.Equal(t, int64(2), general.Version)
}
