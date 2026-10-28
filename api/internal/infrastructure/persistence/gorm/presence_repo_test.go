package gorm

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainpresence "blog-api/internal/domain/presence"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

func setupPresenceRepo(t *testing.T) *PresenceRepository {
	t.Helper()
	db := setupTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.PresenceDevice{}, &model.PresenceSettings{}))
	require.NoError(t, db.Create(&model.PresenceSettings{ID: 1}).Error)
	return NewPresenceRepository(db)
}

func TestPresenceRepository_DeviceLifecycle(t *testing.T) {
	repo := setupPresenceRepo(t)
	ctx := context.Background()
	first, firstToken, err := domainpresence.NewDevice("MacBook Pro", time.Now().Add(-time.Minute))
	require.NoError(t, err)
	second, _, err := domainpresence.NewDevice("Mac mini", time.Now())
	require.NoError(t, err)
	require.NoError(t, repo.CreateDevice(ctx, first))
	require.NoError(t, repo.CreateDevice(ctx, second))

	devices, err := repo.ListDevices(ctx)
	require.NoError(t, err)
	require.Len(t, devices, 2)
	assert.Equal(t, "MacBook Pro", devices[0].DisplayName(), "按签发时间升序")

	found, err := repo.FindDeviceByTokenHash(ctx, domainpresence.HashToken(firstToken))
	require.NoError(t, err)
	assert.Equal(t, first.ID(), found.ID())

	deleted, err := repo.DeleteDevice(ctx, first.ID())
	require.NoError(t, err)
	assert.Equal(t, "MacBook Pro", deleted.DisplayName(), "删除需返回名称快照供审计")
	_, err = repo.FindDeviceByTokenHash(ctx, domainpresence.HashToken(firstToken))
	assert.ErrorIs(t, err, domainpresence.ErrDeviceNotFound)
	_, err = repo.DeleteDevice(ctx, domainshared.NewID())
	assert.ErrorIs(t, err, domainpresence.ErrDeviceNotFound)
}

func TestPresenceRepository_SettingsDefaultClosed(t *testing.T) {
	repo := setupPresenceRepo(t)
	ctx := context.Background()
	settings, err := repo.Settings(ctx)
	require.NoError(t, err)
	assert.False(t, settings.PublicRead, "公开读取默认关闭")

	require.NoError(t, repo.SaveSettings(ctx, domainpresence.Settings{PublicRead: true}))
	settings, err = repo.Settings(ctx)
	require.NoError(t, err)
	assert.True(t, settings.PublicRead)
}
