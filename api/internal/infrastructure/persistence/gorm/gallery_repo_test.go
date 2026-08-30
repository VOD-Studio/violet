package gorm

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	appgallery "blog-api/internal/application/gallery"
	domaingallery "blog-api/internal/domain/gallery"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

func TestGalleryRepositoryCreatePersistsRequiredWorkingRevisionWithoutUpdate(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "gallery.db")), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Gallery{}, &model.GalleryRevision{}, &model.GalleryRevisionItem{}))

	updateCount := 0
	require.NoError(t, db.Callback().Update().Before("gorm:update").Register("test:count_gallery_updates", func(*gorm.DB) {
		updateCount++
	}))

	gallery, err := domaingallery.NewGallery(shared.NewID(), shared.NewID(), shared.NewID())
	require.NoError(t, err)
	uow := NewGalleryUnitOfWork(db)
	err = uow.Do(context.Background(), func(tx appgallery.Transaction) error {
		return tx.Galleries().Create(context.Background(), gallery)
	})
	require.NoError(t, err)
	assert.Zero(t, updateCount, "deferred FK allows inserting the root with its required working revision ID")

	var root model.Gallery
	require.NoError(t, db.First(&root, "id = ?", gallery.ID().UUID()).Error)
	assert.Equal(t, gallery.WorkingRevision().ID().UUID(), root.WorkingRevisionID)
	var revisionCount int64
	require.NoError(t, db.Model(&model.GalleryRevision{}).
		Where("id = ? AND gallery_id = ?", root.WorkingRevisionID, root.ID).
		Count(&revisionCount).Error)
	assert.Equal(t, int64(1), revisionCount)
}
