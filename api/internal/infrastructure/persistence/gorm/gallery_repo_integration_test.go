package gorm

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	appgallery "blog-api/internal/application/gallery"
	appshared "blog-api/internal/application/shared"
	domaingallery "blog-api/internal/domain/gallery"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
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

func TestGalleryPublishAndCopyOnWriteKeepPublicSnapshotStable(t *testing.T) {
	db := setupIntegrationDB(t)
	ownerID := preseedAuthor(t, db)
	firstID := preseedGalleryFile(t, db, ownerID, "first.jpg")
	secondID := preseedGalleryFile(t, db, ownerID, "second.jpg")
	thirdID := preseedGalleryFile(t, db, ownerID, "third.jpg")
	t.Cleanup(func() {
		_ = db.Exec("DELETE FROM galleries WHERE author_id = ?", ownerID.UUID()).Error
		_ = db.Exec("DELETE FROM files WHERE id IN ?", []any{firstID.UUID(), secondID.UUID(), thirdID.UUID()}).Error
		_ = db.Exec("DELETE FROM users WHERE id = ?", ownerID.UUID()).Error
	})

	repo := NewGalleryRepository(db)
	assets := NewGalleryAssetStore(db)
	service := appgallery.NewService(repo, assets, NewGalleryUnitOfWork(db), appshared.NoopEventBus{})
	draft, err := service.CreateDraft(context.Background(), ownerID.String())
	require.NoError(t, err)
	saved, err := service.Save(context.Background(), appgallery.SaveInput{
		UserID: ownerID.String(), GalleryID: draft.ID, ExpectedVersion: draft.Version,
		Title: "公开标题", Summary: "公开摘要",
		Items: []appgallery.SaveItemInput{{FileID: firstID.String()}, {FileID: secondID.String(), Caption: "第二张"}},
	})
	require.NoError(t, err)

	published, err := service.Publish(context.Background(), appgallery.PublishInput{
		UserID: ownerID.String(), GalleryID: draft.ID, ExpectedVersion: saved.Version,
	})
	require.NoError(t, err)
	assert.Equal(t, int64(3), published.Version)
	assert.Equal(t, "published", published.Status)
	require.NotNil(t, published.Slug)
	require.NotNil(t, published.PublishedAt)
	assert.Equal(t, 1, galleryRefCount(t, db, firstID))
	assert.Equal(t, 1, galleryRefCount(t, db, secondID))

	maintained, err := service.Save(context.Background(), appgallery.SaveInput{
		UserID: ownerID.String(), GalleryID: draft.ID, ExpectedVersion: published.Version,
		Title: "维护中标题", Items: []appgallery.SaveItemInput{{FileID: firstID.String()}, {FileID: thirdID.String()}},
	})
	require.NoError(t, err)
	assert.Equal(t, int64(4), maintained.Version)
	assert.Equal(t, 2, galleryRefCount(t, db, firstID))
	assert.Equal(t, 1, galleryRefCount(t, db, secondID))
	assert.Equal(t, 1, galleryRefCount(t, db, thirdID))

	public, err := service.GetPublished(context.Background(), *published.Slug)
	require.NoError(t, err)
	assert.Equal(t, "公开标题", public.Title)
	require.Len(t, public.Items, 2)
	assert.Equal(t, firstID.String(), public.Items[0].FileID)
	assert.Equal(t, secondID.String(), public.Items[1].FileID)
	assert.Equal(t, "第二张", public.Items[1].Caption)

	var workingID, publishedID string
	var revisionCount int64
	require.NoError(t, db.Raw(
		"SELECT working_revision_id::text, published_revision_id::text FROM galleries WHERE id = ?", draft.ID,
	).Row().Scan(&workingID, &publishedID))
	require.NoError(t, db.Model(&model.GalleryRevision{}).Where("gallery_id = ?", draft.ID).Count(&revisionCount).Error)
	assert.NotEqual(t, workingID, publishedID)
	assert.Equal(t, int64(2), revisionCount)
}

func TestGalleryPublishRollbackLeavesDraftAndReferencesUnchanged(t *testing.T) {
	db := setupIntegrationDB(t)
	ownerID := preseedAuthor(t, db)
	firstID := preseedGalleryFile(t, db, ownerID, "rollback-first.jpg")
	secondID := preseedGalleryFile(t, db, ownerID, "rollback-second.jpg")
	t.Cleanup(func() {
		_ = db.Exec("DROP TRIGGER IF EXISTS gallery_test_reject_publish ON galleries").Error
		_ = db.Exec("DROP FUNCTION IF EXISTS gallery_test_reject_publish()").Error
		_ = db.Exec("DELETE FROM galleries WHERE author_id = ?", ownerID.UUID()).Error
		_ = db.Exec("DELETE FROM files WHERE id IN ?", []any{firstID.UUID(), secondID.UUID()}).Error
		_ = db.Exec("DELETE FROM users WHERE id = ?", ownerID.UUID()).Error
	})
	repo := NewGalleryRepository(db)
	assets := NewGalleryAssetStore(db)
	service := appgallery.NewService(repo, assets, NewGalleryUnitOfWork(db), appshared.NoopEventBus{})
	draft, err := service.CreateDraft(context.Background(), ownerID.String())
	require.NoError(t, err)
	saved, err := service.Save(context.Background(), appgallery.SaveInput{
		UserID: ownerID.String(), GalleryID: draft.ID, ExpectedVersion: draft.Version,
		Title: "待发布作品", Items: []appgallery.SaveItemInput{{FileID: firstID.String()}, {FileID: secondID.String()}},
	})
	require.NoError(t, err)
	require.NoError(t, db.Exec(`
		CREATE FUNCTION gallery_test_reject_publish() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN
			RAISE EXCEPTION 'forced gallery publish failure';
		END;
		$$`).Error)
	require.NoError(t, db.Exec(`
		CREATE TRIGGER gallery_test_reject_publish
		BEFORE UPDATE ON galleries
		FOR EACH ROW EXECUTE FUNCTION gallery_test_reject_publish()`).Error)

	_, err = service.Publish(context.Background(), appgallery.PublishInput{
		UserID: ownerID.String(), GalleryID: draft.ID, ExpectedVersion: saved.Version,
	})
	require.Error(t, err)
	assert.True(t, domainshared.IsDomainError(err, domainshared.CodeInternal))
	assert.Contains(t, err.Error(), "forced gallery publish failure")

	var version int64
	var slug, publishedRevisionID, publishedAt *string
	require.NoError(t, db.Raw(`
		SELECT version, slug, published_revision_id::text, published_at::text
		FROM galleries WHERE id = ?`, draft.ID,
	).Row().Scan(&version, &slug, &publishedRevisionID, &publishedAt))
	assert.Equal(t, int64(2), version)
	assert.Nil(t, slug)
	assert.Nil(t, publishedRevisionID)
	assert.Nil(t, publishedAt)
	assert.Equal(t, 1, galleryRefCount(t, db, firstID))
	assert.Equal(t, 1, galleryRefCount(t, db, secondID))
}

func TestGalleryPublishedMaintenanceLifecycleCleansSnapshotsAndReferences(t *testing.T) {
	db := setupIntegrationDB(t)
	ownerID := preseedAuthor(t, db)
	firstID := preseedGalleryFile(t, db, ownerID, "maintenance-first.jpg")
	secondID := preseedGalleryFile(t, db, ownerID, "maintenance-second.jpg")
	thirdID := preseedGalleryFile(t, db, ownerID, "maintenance-third.jpg")
	t.Cleanup(func() {
		_ = db.Exec("DELETE FROM galleries WHERE author_id = ?", ownerID.UUID()).Error
		_ = db.Exec("DELETE FROM files WHERE id IN ?", []any{firstID.UUID(), secondID.UUID(), thirdID.UUID()}).Error
		_ = db.Exec("DELETE FROM users WHERE id = ?", ownerID.UUID()).Error
	})

	repo := NewGalleryRepository(db)
	assets := NewGalleryAssetStore(db)
	service := appgallery.NewService(repo, assets, NewGalleryUnitOfWork(db), appshared.NoopEventBus{})
	draft, err := service.CreateDraft(context.Background(), ownerID.String())
	require.NoError(t, err)
	saved, err := service.Save(context.Background(), appgallery.SaveInput{
		UserID: ownerID.String(), GalleryID: draft.ID, ExpectedVersion: draft.Version,
		Title: "旧标题", Summary: "旧摘要",
		Items: []appgallery.SaveItemInput{{FileID: firstID.String()}, {FileID: secondID.String(), Caption: "旧说明"}},
	})
	require.NoError(t, err)
	published, err := service.Publish(context.Background(), appgallery.PublishInput{
		UserID: ownerID.String(), GalleryID: draft.ID, ExpectedVersion: saved.Version,
	})
	require.NoError(t, err)
	originalSlug := *published.Slug
	originalPublishedAt := *published.PublishedAt

	modified, err := service.Save(context.Background(), appgallery.SaveInput{
		UserID: ownerID.String(), GalleryID: draft.ID, ExpectedVersion: published.Version,
		Title: "新标题", Summary: "新摘要",
		Items: []appgallery.SaveItemInput{{FileID: thirdID.String(), Caption: "新说明"}, {FileID: firstID.String(), AltTextOverride: "新替代文本"}},
	})
	require.NoError(t, err)
	assert.Equal(t, domaingallery.StatusModified, modified.Status)

	updated, err := service.Publish(context.Background(), appgallery.PublishInput{
		UserID: ownerID.String(), GalleryID: draft.ID, ExpectedVersion: modified.Version,
	})
	require.NoError(t, err)
	assert.Equal(t, domaingallery.StatusPublished, updated.Status)
	assert.Equal(t, originalSlug, *updated.Slug)
	assert.Equal(t, originalPublishedAt, *updated.PublishedAt)
	assert.Equal(t, 1, galleryRefCount(t, db, firstID))
	assert.Zero(t, galleryRefCount(t, db, secondID))
	assert.Equal(t, 1, galleryRefCount(t, db, thirdID))

	public, err := service.GetPublished(context.Background(), originalSlug)
	require.NoError(t, err)
	assert.Equal(t, "新标题", public.Title)
	assert.Equal(t, "新摘要", public.Summary)
	require.Len(t, public.Items, 2)
	assert.Equal(t, thirdID.String(), public.Items[0].FileID)
	assert.Equal(t, "新说明", public.Items[0].Caption)
	assert.Equal(t, firstID.String(), public.Items[1].FileID)
	assert.Equal(t, "新替代文本", public.Items[1].AltText)

	var revisionCount int64
	require.NoError(t, db.Model(&model.GalleryRevision{}).Where("gallery_id = ?", draft.ID).Count(&revisionCount).Error)
	assert.Equal(t, int64(1), revisionCount)

	unpublished, err := service.Unpublish(context.Background(), appgallery.VersionInput{
		UserID: ownerID.String(), GalleryID: draft.ID, ExpectedVersion: updated.Version,
	})
	require.NoError(t, err)
	assert.Equal(t, domaingallery.StatusUnpublished, unpublished.Status)
	assert.Equal(t, originalSlug, *unpublished.Slug)
	assert.Equal(t, originalPublishedAt, *unpublished.PublishedAt)
	_, err = service.GetPublished(context.Background(), originalSlug)
	assert.ErrorIs(t, err, domaingallery.ErrNotFound)
	assert.Equal(t, 1, galleryRefCount(t, db, firstID))
	assert.Equal(t, 1, galleryRefCount(t, db, thirdID))

	republished, err := service.Publish(context.Background(), appgallery.PublishInput{
		UserID: ownerID.String(), GalleryID: draft.ID, ExpectedVersion: unpublished.Version,
	})
	require.NoError(t, err)
	assert.Equal(t, originalSlug, *republished.Slug)
	assert.Equal(t, originalPublishedAt, *republished.PublishedAt)

	require.NoError(t, service.Delete(context.Background(), appgallery.VersionInput{
		UserID: ownerID.String(), GalleryID: draft.ID, ExpectedVersion: republished.Version,
	}))
	assert.Zero(t, galleryRefCount(t, db, firstID))
	assert.Zero(t, galleryRefCount(t, db, thirdID))
	require.NoError(t, db.Model(&model.GalleryRevision{}).Where("gallery_id = ?", draft.ID).Count(&revisionCount).Error)
	assert.Zero(t, revisionCount)
	var galleryCount int64
	require.NoError(t, db.Model(&model.Gallery{}).Where("id = ?", draft.ID).Count(&galleryCount).Error)
	assert.Zero(t, galleryCount)
}

func TestGalleryMaintenanceFailuresRollBackPointersSnapshotsAndReferences(t *testing.T) {
	db := setupIntegrationDB(t)
	ownerID := preseedAuthor(t, db)
	firstID := preseedGalleryFile(t, db, ownerID, "failure-first.jpg")
	secondID := preseedGalleryFile(t, db, ownerID, "failure-second.jpg")
	thirdID := preseedGalleryFile(t, db, ownerID, "failure-third.jpg")
	t.Cleanup(func() {
		_ = db.Exec("DROP TRIGGER IF EXISTS gallery_test_reject_maintenance ON galleries").Error
		_ = db.Exec("DROP FUNCTION IF EXISTS gallery_test_reject_maintenance() CASCADE").Error
		_ = db.Exec("DELETE FROM galleries WHERE author_id = ?", ownerID.UUID()).Error
		_ = db.Exec("DELETE FROM files WHERE id IN ?", []any{firstID.UUID(), secondID.UUID(), thirdID.UUID()}).Error
		_ = db.Exec("DELETE FROM users WHERE id = ?", ownerID.UUID()).Error
	})

	repo := NewGalleryRepository(db)
	assets := NewGalleryAssetStore(db)
	service := appgallery.NewService(repo, assets, NewGalleryUnitOfWork(db), appshared.NoopEventBus{})
	draft, err := service.CreateDraft(context.Background(), ownerID.String())
	require.NoError(t, err)
	saved, err := service.Save(context.Background(), appgallery.SaveInput{
		UserID: ownerID.String(), GalleryID: draft.ID, ExpectedVersion: draft.Version,
		Title: "旧标题", Items: []appgallery.SaveItemInput{{FileID: firstID.String()}, {FileID: secondID.String()}},
	})
	require.NoError(t, err)
	published, err := service.Publish(context.Background(), appgallery.PublishInput{UserID: ownerID.String(), GalleryID: draft.ID, ExpectedVersion: saved.Version})
	require.NoError(t, err)
	modified, err := service.Save(context.Background(), appgallery.SaveInput{
		UserID: ownerID.String(), GalleryID: draft.ID, ExpectedVersion: published.Version,
		Title: "新标题", Items: []appgallery.SaveItemInput{{FileID: firstID.String()}, {FileID: thirdID.String()}},
	})
	require.NoError(t, err)

	require.NoError(t, db.Exec(`
		CREATE FUNCTION gallery_test_reject_maintenance() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN
			RAISE EXCEPTION 'forced gallery maintenance failure';
		END;
		$$`).Error)
	require.NoError(t, db.Exec(`
		CREATE TRIGGER gallery_test_reject_maintenance
		BEFORE UPDATE OR DELETE ON galleries
		FOR EACH ROW EXECUTE FUNCTION gallery_test_reject_maintenance()`).Error)

	_, err = service.Publish(context.Background(), appgallery.PublishInput{
		UserID: ownerID.String(), GalleryID: draft.ID, ExpectedVersion: modified.Version,
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "forced gallery maintenance failure")
	assert.Equal(t, 2, galleryRefCount(t, db, firstID))
	assert.Equal(t, 1, galleryRefCount(t, db, secondID))
	assert.Equal(t, 1, galleryRefCount(t, db, thirdID))

	public, err := service.GetPublished(context.Background(), *published.Slug)
	require.NoError(t, err)
	assert.Equal(t, "旧标题", public.Title)
	var revisionCount int64
	require.NoError(t, db.Model(&model.GalleryRevision{}).Where("gallery_id = ?", draft.ID).Count(&revisionCount).Error)
	assert.Equal(t, int64(2), revisionCount)

	err = service.Delete(context.Background(), appgallery.VersionInput{
		UserID: ownerID.String(), GalleryID: draft.ID, ExpectedVersion: modified.Version,
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "forced gallery maintenance failure")
	assert.Equal(t, 2, galleryRefCount(t, db, firstID))
	assert.Equal(t, 1, galleryRefCount(t, db, secondID))
	assert.Equal(t, 1, galleryRefCount(t, db, thirdID))
	require.NoError(t, db.Model(&model.GalleryRevision{}).Where("gallery_id = ?", draft.ID).Count(&revisionCount).Error)
	assert.Equal(t, int64(2), revisionCount)
}

func TestGalleryPublishedCursorUsesTimestampAndIDWithoutDuplicates(t *testing.T) {
	db := setupIntegrationDB(t)
	ownerID := preseedAuthor(t, db)
	t.Cleanup(func() {
		_ = db.Exec("DELETE FROM galleries WHERE author_id = ?", ownerID.UUID()).Error
		_ = db.Exec("DELETE FROM files WHERE owner_id = ?", ownerID.UUID()).Error
		_ = db.Exec("DELETE FROM users WHERE id = ?", ownerID.UUID()).Error
	})
	repo := NewGalleryRepository(db)
	assets := NewGalleryAssetStore(db)
	service := appgallery.NewService(repo, assets, NewGalleryUnitOfWork(db), appshared.NoopEventBus{})
	publishedAt := time.Date(2026, time.August, 31, 12, 0, 0, 0, time.UTC)
	for i := 0; i < 3; i++ {
		first := preseedGalleryFile(t, db, ownerID, fmt.Sprintf("cursor-%d-a.jpg", i))
		second := preseedGalleryFile(t, db, ownerID, fmt.Sprintf("cursor-%d-b.jpg", i))
		draft, err := service.CreateDraft(context.Background(), ownerID.String())
		require.NoError(t, err)
		saved, err := service.Save(context.Background(), appgallery.SaveInput{
			UserID: ownerID.String(), GalleryID: draft.ID, ExpectedVersion: draft.Version,
			Title: fmt.Sprintf("作品 %d", i), Items: []appgallery.SaveItemInput{{FileID: first.String()}, {FileID: second.String()}},
		})
		require.NoError(t, err)
		_, err = service.Publish(context.Background(), appgallery.PublishInput{UserID: ownerID.String(), GalleryID: draft.ID, ExpectedVersion: saved.Version})
		require.NoError(t, err)
		require.NoError(t, db.Exec("UPDATE galleries SET published_at = ? WHERE id = ?", publishedAt, draft.ID).Error)
	}

	firstPage, cursor, err := service.BrowsePublished(context.Background(), "", 2)
	require.NoError(t, err)
	require.Len(t, firstPage, 2)
	assert.NotEmpty(t, cursor)
	secondPage, next, err := service.BrowsePublished(context.Background(), cursor, 2)
	require.NoError(t, err)
	require.Len(t, secondPage, 1)
	assert.Empty(t, next)
	seen := map[string]struct{}{}
	for _, gallery := range append(firstPage, secondPage...) {
		_, duplicate := seen[gallery.ID]
		assert.False(t, duplicate)
		seen[gallery.ID] = struct{}{}
	}
}
