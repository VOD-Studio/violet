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

func TestGalleryRepositoryPublishedPageUsesFixedQueryCount(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "published-gallery.db")), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Gallery{}, &model.GalleryRevision{}, &model.GalleryRevisionItem{}))
	publishedAt := time.Date(2026, time.August, 31, 9, 0, 0, 0, time.UTC)
	for i := 0; i < 4; i++ {
		galleryID, revisionID := shared.NewID(), shared.NewID()
		slug := "gallery-" + galleryID.String()
		pubID := revisionID.UUID()
		require.NoError(t, db.Create(&model.Gallery{
			ID: galleryID.UUID(), AuthorID: shared.NewID().UUID(), Slug: &slug,
			WorkingRevisionID: revisionID.UUID(), PublishedRevisionID: &pubID,
			Version: 3, PublishedAt: &publishedAt, CreatedAt: publishedAt, UpdatedAt: publishedAt,
		}).Error)
		require.NoError(t, db.Create(&model.GalleryRevision{
			ID: revisionID.UUID(), GalleryID: galleryID.UUID(), Title: "公开作品",
			CreatedAt: publishedAt, UpdatedAt: publishedAt,
		}).Error)
		for position := 0; position < 2; position++ {
			require.NoError(t, db.Create(&model.GalleryRevisionItem{
				RevisionID: revisionID.UUID(), FileID: shared.NewID().UUID(), Position: position,
			}).Error)
		}
	}

	queryCount := 0
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register("test:count_public_gallery_queries", func(*gorm.DB) {
		queryCount++
	}))
	rows, err := NewGalleryRepository(db).FindPublishedPage(context.Background(), nil, 10)
	require.NoError(t, err)
	assert.Len(t, rows, 4)
	assert.Equal(t, 3, queryCount, "root、revision、items 各一次，数量不随图集数增加")
}
