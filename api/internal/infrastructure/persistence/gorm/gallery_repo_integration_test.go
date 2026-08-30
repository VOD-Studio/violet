package gorm

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	appgallery "blog-api/internal/application/gallery"
	appshared "blog-api/internal/application/shared"
	domainshared "blog-api/internal/domain/shared"
)

func preseedGalleryFile(t *testing.T, db *gorm.DB, ownerID domainshared.ID, name string) domainshared.ID {
	t.Helper()
	fileID := domainshared.NewID()
	require.NoError(t, db.Exec(
		`INSERT INTO files
			(id, owner_id, purpose, original_name, path, url, size, mime_type, file_hash, width, height, thumbnail, status, ref_count, alt_text, category, created_at, updated_at)
		 VALUES (?, ?, 'material', ?, ?, ?, 10, 'image/jpeg', ?, 100, 80, ?, 'ready', 0, '', '', NOW(), NOW())`,
		fileID.UUID(), ownerID.UUID(), name, "/tmp/"+name, "/uploads/"+name,
		fmt.Sprintf("%064s", fileID.String()), "/uploads/thumb-"+name,
	).Error)
	return fileID
}

func galleryRefCount(t *testing.T, db *gorm.DB, fileID domainshared.ID) int {
	t.Helper()
	var count int
	require.NoError(t, db.Raw("SELECT ref_count FROM files WHERE id = ?", fileID.UUID()).Scan(&count).Error)
	return count
}

func TestGallerySaveIntegrationCommitsAndRollsBackWithReferences(t *testing.T) {
	db := setupIntegrationDB(t)
	ownerID := preseedAuthor(t, db)
	oldFileID := preseedGalleryFile(t, db, ownerID, "old.jpg")
	newFileID := preseedGalleryFile(t, db, ownerID, "new.jpg")
	t.Cleanup(func() {
		_ = db.Exec("DELETE FROM galleries WHERE author_id = ?", ownerID.UUID()).Error
		_ = db.Exec("DELETE FROM files WHERE id IN ?", []any{oldFileID.UUID(), newFileID.UUID()}).Error
		_ = db.Exec("DELETE FROM users WHERE id = ?", ownerID.UUID()).Error
	})

	repo := NewGalleryRepository(db)
	assets := NewGalleryAssetStore(db)
	service := appgallery.NewService(repo, assets, NewGalleryUnitOfWork(db), appshared.NoopEventBus{})

	draft, err := service.CreateDraft(context.Background(), ownerID.String())
	require.NoError(t, err)

	var deferredCount int
	require.NoError(t, db.Raw(
		`SELECT COUNT(*) FROM pg_constraint
		 WHERE conname IN ('fk_galleries_working_revision', 'fk_galleries_published_revision')
		   AND condeferrable AND condeferred`,
	).Scan(&deferredCount).Error)
	assert.Equal(t, 2, deferredCount)

	saved, err := service.Save(context.Background(), appgallery.SaveInput{
		UserID: ownerID.String(), GalleryID: draft.ID, ExpectedVersion: draft.Version,
		Title: "已提交", Items: []appgallery.SaveItemInput{{FileID: oldFileID.String()}},
	})
	require.NoError(t, err)
	assert.Equal(t, int64(2), saved.Version)
	assert.Equal(t, 1, galleryRefCount(t, db, oldFileID))

	require.NoError(t, db.Exec("DROP TRIGGER IF EXISTS gallery_test_reject_update ON galleries").Error)
	require.NoError(t, db.Exec("DROP FUNCTION IF EXISTS gallery_test_reject_update()").Error)
	require.NoError(t, db.Exec(`
		CREATE FUNCTION gallery_test_reject_update() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN
			RAISE EXCEPTION 'forced gallery save failure';
		END;
		$$`).Error)
	require.NoError(t, db.Exec(`
		CREATE TRIGGER gallery_test_reject_update
		BEFORE UPDATE ON galleries
		FOR EACH ROW EXECUTE FUNCTION gallery_test_reject_update()`).Error)
	t.Cleanup(func() {
		_ = db.Exec("DROP TRIGGER IF EXISTS gallery_test_reject_update ON galleries").Error
		_ = db.Exec("DROP FUNCTION IF EXISTS gallery_test_reject_update()").Error
	})

	_, err = service.Save(context.Background(), appgallery.SaveInput{
		UserID: ownerID.String(), GalleryID: draft.ID, ExpectedVersion: saved.Version,
		Title: "应回滚", Items: []appgallery.SaveItemInput{{FileID: newFileID.String()}},
	})
	require.Error(t, err)
	assert.True(t, domainshared.IsDomainError(err, domainshared.CodeInternal))
	assert.Contains(t, err.Error(), "推进图集版本失败")
	assert.Contains(t, err.Error(), "forced gallery save failure")
	assert.Equal(t, 1, galleryRefCount(t, db, oldFileID))
	assert.Zero(t, galleryRefCount(t, db, newFileID))

	var version int64
	var persistedFileID string
	require.NoError(t, db.Raw("SELECT version FROM galleries WHERE id = ?", draft.ID).Scan(&version).Error)
	require.NoError(t, db.Raw(
		`SELECT file_id::text FROM gallery_revision_items
		 WHERE revision_id = (SELECT working_revision_id FROM galleries WHERE id = ?)`, draft.ID,
	).Scan(&persistedFileID).Error)
	assert.Equal(t, int64(2), version)
	assert.Equal(t, oldFileID.String(), persistedFileID)
}
