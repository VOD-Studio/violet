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

	domaingallery "blog-api/internal/domain/gallery"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

func setupGalleryTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "test.db")), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Gallery{}, &model.GalleryItem{}))
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func mustCreateGallery(t *testing.T, repo *GalleryRepository, ownerID domainshared.ID, title string, itemCount int) *domaingallery.Gallery {
	t.Helper()
	items := make([]domaingallery.GalleryItem, itemCount)
	for i := range items {
		items[i] = domaingallery.NewGalleryItem(domainshared.NewID(), "")
	}
	g, err := domaingallery.NewGallery(domainshared.NewID(), ownerID, title, "", nil, items)
	require.NoError(t, err)
	require.NoError(t, repo.Save(context.Background(), g))
	return g
}

func TestGalleryRepository_SaveAndFind(t *testing.T) {
	db := setupGalleryTestDB(t)
	repo := NewGalleryRepository(db)
	owner := domainshared.NewID()

	g := mustCreateGallery(t, repo, owner, "濑户内海", 3)

	found, err := repo.FindByID(context.Background(), g.ID())
	require.NoError(t, err)
	assert.Equal(t, g.Title(), found.Title())
	assert.Equal(t, 3, len(found.Items()))
	assert.Equal(t, domaingallery.StatusPublished, found.Status())
}

func TestGalleryRepository_FindPublishedPage(t *testing.T) {
	db := setupGalleryTestDB(t)
	repo := NewGalleryRepository(db)
	owner := domainshared.NewID()

	mustCreateGallery(t, repo, owner, "已发布", 2)

	// 下架一个
	removed := mustCreateGallery(t, repo, owner, "已下架", 1)
	_ = removed.Remove()
	require.NoError(t, repo.Save(context.Background(), removed))

	page, err := repo.FindPublishedPage(context.Background(), domainshared.PageQuery{Page: 1, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, int64(1), page.Total)
	assert.Equal(t, "已发布", page.Items[0].Title())
}

func TestGalleryRepository_FindPageByOwner(t *testing.T) {
	db := setupGalleryTestDB(t)
	repo := NewGalleryRepository(db)
	owner1 := domainshared.NewID()
	owner2 := domainshared.NewID()

	mustCreateGallery(t, repo, owner1, "作者1", 1)
	mustCreateGallery(t, repo, owner2, "作者2", 1)

	page, err := repo.FindPageByOwner(context.Background(), owner1, domainshared.PageQuery{Page: 1, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, int64(1), page.Total)
	assert.Equal(t, "作者1", page.Items[0].Title())
}

func TestGalleryRepository_Delete(t *testing.T) {
	db := setupGalleryTestDB(t)
	repo := NewGalleryRepository(db)
	owner := domainshared.NewID()

	g := mustCreateGallery(t, repo, owner, "待删", 2)

	require.NoError(t, repo.Delete(context.Background(), g.ID()))

	_, err := repo.FindByID(context.Background(), g.ID())
	assert.ErrorIs(t, err, domaingallery.ErrGalleryNotFound)
}

func TestGalleryRepository_FindAdminPage_IncludesRemoved(t *testing.T) {
	db := setupGalleryTestDB(t)
	repo := NewGalleryRepository(db)
	owner := domainshared.NewID()

	mustCreateGallery(t, repo, owner, "正常", 1)
	removed := mustCreateGallery(t, repo, owner, "已下架", 1)
	_ = removed.Remove()
	require.NoError(t, repo.Save(context.Background(), removed))

	page, err := repo.FindAdminPage(context.Background(), domainshared.PageQuery{Page: 1, Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, int64(2), page.Total)
}
