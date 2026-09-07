package gorm

import (
	"context"
	"fmt"
	"testing"
	"time"

	appgallery "blog-api/internal/application/gallery"
	appnote "blog-api/internal/application/note"
	apppost "blog-api/internal/application/post"
	appshared "blog-api/internal/application/shared"
	domainpublication "blog-api/internal/domain/publication"
	"blog-api/internal/domain/shared"
	"blog-api/internal/middleware"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestPublishedSourceUseCasesMaintainPublicationEntries(t *testing.T) {
	db := setupPublicationIntegrationDB(t)
	authorID := preseedPublicationAuthor(t, db)
	ctx := context.WithValue(context.Background(), middleware.UserIDKey, authorID.String())

	postRepo := NewPostRepository(db)
	postService := apppost.NewService(postRepo, nil, nil, nil, appshared.NoopEventBus{}, NewPostPublicationUnitOfWork(db))
	postID := preseedPublicationPost(t, db, authorID)
	require.NoError(t, postService.Publish(ctx, postID.String()))
	require.NoError(t, postService.Publish(ctx, postID.String()))
	assertPublicationConsistencyClean(t, db)
	assertPublicationEntry(t, db, domainpublication.KindArticle, postID, "article-sync", "Article sync", false)

	require.NoError(t, postService.Update(ctx, apppost.UpdateInput{
		ID: postID.String(), Title: "Article updated", Slug: "article-updated", ContentMD: "body", IsFeatured: true,
	}, authorID.String()))
	assertPublicationConsistencyClean(t, db)
	assertPublicationEntry(t, db, domainpublication.KindArticle, postID, "article-updated", "Article updated", true)

	require.NoError(t, postService.Delete(ctx, postID.String()))
	assertPublicationConsistencyClean(t, db)
	assertNoPublicationEntry(t, db, domainpublication.KindArticle, postID)
	require.NoError(t, postService.Restore(ctx, postID.String()))
	assertPublicationEntry(t, db, domainpublication.KindArticle, postID, "article-updated", "Article updated", true)
	assertPublicationConsistencyClean(t, db)

	_, err := postService.UpdateStatus(ctx, postID.String(), "draft")
	require.NoError(t, err)
	assertNoPublicationEntry(t, db, domainpublication.KindArticle, postID)
	assertPublicationConsistencyClean(t, db)

	noteService := appnote.NewService(NewNoteRepository(db), NewNotePublicationUnitOfWork(db))
	note, err := noteService.Create(ctx, appnote.CreateInput{UserID: authorID.String(), Title: "", ContentMD: "first note body"})
	require.NoError(t, err)
	_, err = noteService.Publish(ctx, note.ID)
	require.NoError(t, err)
	_, err = noteService.Publish(ctx, note.ID)
	require.NoError(t, err)
	noteID := shared.MustParseID(note.ID)
	assertPublicationConsistencyClean(t, db)
	assertPublicationEntry(t, db, domainpublication.KindNote, noteID, note.ID, "first note body", false)

	_, err = noteService.Update(ctx, appnote.UpdateInput{NoteID: note.ID, Title: "Note updated", ContentMD: "changed"})
	require.NoError(t, err)
	assertPublicationConsistencyClean(t, db)
	assertPublicationEntry(t, db, domainpublication.KindNote, noteID, note.ID, "Note updated", false)
	require.NoError(t, noteService.Delete(ctx, note.ID))
	assertNoPublicationEntry(t, db, domainpublication.KindNote, noteID)
	assertPublicationConsistencyClean(t, db)
}

func TestProjectionFailureRollsBackPublishedSource(t *testing.T) {
	db := setupPublicationIntegrationDB(t)
	authorID := preseedPublicationAuthor(t, db)
	postID := preseedPublicationPost(t, db, authorID)
	installPublicationWriteFailure(t, db, "INSERT OR UPDATE")

	service := apppost.NewService(NewPostRepository(db), nil, nil, nil, appshared.NoopEventBus{}, NewPostPublicationUnitOfWork(db))
	ctx := context.WithValue(context.Background(), middleware.UserIDKey, authorID.String())
	err := service.Publish(ctx, postID.String())
	require.ErrorContains(t, err, "forced publication failure")

	var status string
	require.NoError(t, db.Table("posts").Select("status").Where("id = ?", postID.UUID()).Scan(&status).Error)
	assert.Equal(t, "draft", status)
	assertNoPublicationEntry(t, db, domainpublication.KindArticle, postID)
}

func TestNoteProjectionFailureRollsBackPublish(t *testing.T) {
	db := setupPublicationIntegrationDB(t)
	authorID := preseedPublicationAuthor(t, db)
	service := appnote.NewService(NewNoteRepository(db), NewNotePublicationUnitOfWork(db))
	note, err := service.Create(context.Background(), appnote.CreateInput{
		UserID: authorID.String(), Title: "Rollback note", ContentMD: "body",
	})
	require.NoError(t, err)
	installPublicationWriteFailure(t, db, "INSERT OR UPDATE")

	_, err = service.Publish(context.Background(), note.ID)
	require.ErrorContains(t, err, "forced publication failure")
	var status string
	require.NoError(t, db.Table("notes").Select("status").Where("id = ?", note.ID).Scan(&status).Error)
	assert.Equal(t, "draft", status)
	assertNoPublicationEntry(t, db, domainpublication.KindNote, shared.MustParseID(note.ID))
}

func TestGalleryProjectionFailureRollsBackPublish(t *testing.T) {
	db := setupPublicationIntegrationDB(t)
	authorID := preseedPublicationAuthor(t, db)
	firstID := preseedGalleryFile(t, db, authorID, "publication-rollback-first.jpg")
	secondID := preseedGalleryFile(t, db, authorID, "publication-rollback-second.jpg")
	service := appgallery.NewService(
		NewGalleryRepository(db), NewGalleryAssetStore(db), NewGalleryUnitOfWork(db), appshared.NoopEventBus{}, nil, NewGalleryUserDirectory(db),
	)
	draft, err := service.CreateDraft(context.Background(), authorID.String())
	require.NoError(t, err)
	saved, err := service.Save(context.Background(), appgallery.SaveInput{
		UserID: authorID.String(), GalleryID: draft.ID, ExpectedVersion: draft.Version, Title: "Rollback gallery",
		Items: []appgallery.SaveItemInput{{FileID: firstID.String()}, {FileID: secondID.String()}},
	})
	require.NoError(t, err)
	installPublicationWriteFailure(t, db, "INSERT OR UPDATE")

	_, err = service.Publish(context.Background(), appgallery.PublishInput{
		UserID: authorID.String(), GalleryID: draft.ID, ExpectedVersion: saved.Version,
	})
	require.ErrorContains(t, err, "forced publication failure")
	var row struct {
		PublishedRevisionID *string
		Version             int64
	}
	require.NoError(t, db.Table("galleries").Select("published_revision_id, version").Where("id = ?", draft.ID).Take(&row).Error)
	assert.Nil(t, row.PublishedRevisionID)
	assert.Equal(t, saved.Version, row.Version)
	assertNoPublicationEntry(t, db, domainpublication.KindGallery, shared.MustParseID(draft.ID))
}

func TestProjectionDeleteFailureRollsBackAllSources(t *testing.T) {
	db := setupPublicationIntegrationDB(t)
	authorID := preseedPublicationAuthor(t, db)
	ctx := context.WithValue(context.Background(), middleware.UserIsRootKey, true)

	postService := apppost.NewService(NewPostRepository(db), nil, nil, nil, appshared.NoopEventBus{}, NewPostPublicationUnitOfWork(db))
	postID := preseedPublicationPost(t, db, authorID)
	require.NoError(t, postService.Publish(ctx, postID.String()))

	noteService := appnote.NewService(NewNoteRepository(db), NewNotePublicationUnitOfWork(db))
	note, err := noteService.Create(ctx, appnote.CreateInput{UserID: authorID.String(), Title: "Delete rollback note", ContentMD: "body"})
	require.NoError(t, err)
	_, err = noteService.Publish(ctx, note.ID)
	require.NoError(t, err)
	noteID := shared.MustParseID(note.ID)

	firstID := preseedGalleryFile(t, db, authorID, "publication-delete-rollback-first.jpg")
	secondID := preseedGalleryFile(t, db, authorID, "publication-delete-rollback-second.jpg")
	galleryService := appgallery.NewService(
		NewGalleryRepository(db), NewGalleryAssetStore(db), NewGalleryUnitOfWork(db), appshared.NoopEventBus{}, nil, NewGalleryUserDirectory(db),
	)
	draft, err := galleryService.CreateDraft(ctx, authorID.String())
	require.NoError(t, err)
	saved, err := galleryService.Save(ctx, appgallery.SaveInput{
		UserID: authorID.String(), GalleryID: draft.ID, ExpectedVersion: draft.Version, Title: "Delete rollback gallery",
		Items: []appgallery.SaveItemInput{{FileID: firstID.String()}, {FileID: secondID.String()}},
	})
	require.NoError(t, err)
	published, err := galleryService.Publish(ctx, appgallery.PublishInput{
		UserID: authorID.String(), GalleryID: draft.ID, ExpectedVersion: saved.Version,
	})
	require.NoError(t, err)
	galleryID := shared.MustParseID(draft.ID)
	installPublicationWriteFailure(t, db, "DELETE")

	err = postService.Delete(ctx, postID.String())
	require.ErrorContains(t, err, "forced publication failure")
	var activePostCount int64
	require.NoError(t, db.Table("posts").Where("id = ? AND deleted_at IS NULL", postID.UUID()).Count(&activePostCount).Error)
	assert.Equal(t, int64(1), activePostCount)
	assertPublicationEntry(t, db, domainpublication.KindArticle, postID, "article-sync", "Article sync", false)

	err = noteService.Delete(ctx, note.ID)
	require.ErrorContains(t, err, "forced publication failure")
	var noteCount int64
	require.NoError(t, db.Table("notes").Where("id = ?", noteID.UUID()).Count(&noteCount).Error)
	assert.Equal(t, int64(1), noteCount)
	assertPublicationEntry(t, db, domainpublication.KindNote, noteID, note.ID, "Delete rollback note", false)

	_, err = galleryService.Unpublish(ctx, appgallery.VersionInput{
		UserID: authorID.String(), GalleryID: draft.ID, ExpectedVersion: published.Version,
	})
	require.ErrorContains(t, err, "forced publication failure")
	var galleryState struct {
		PublishedRevisionID *string
		Version             int64
	}
	require.NoError(t, db.Table("galleries").Select("published_revision_id, version").Where("id = ?", galleryID.UUID()).Take(&galleryState).Error)
	require.NotNil(t, galleryState.PublishedRevisionID)
	assert.Equal(t, published.Version, galleryState.Version)
	assertPublicationEntry(t, db, domainpublication.KindGallery, galleryID, *published.Slug, "Delete rollback gallery", false)
	assertPublicationConsistencyClean(t, db)
}

func TestGalleryRepublishProjectionFailureRollsBackSourceAndReferences(t *testing.T) {
	db := setupPublicationIntegrationDB(t)
	authorID := preseedPublicationAuthor(t, db)
	firstID := preseedGalleryFile(t, db, authorID, "publication-republish-rollback-first.jpg")
	secondID := preseedGalleryFile(t, db, authorID, "publication-republish-rollback-second.jpg")
	service := appgallery.NewService(
		NewGalleryRepository(db), NewGalleryAssetStore(db), NewGalleryUnitOfWork(db), appshared.NoopEventBus{}, nil, NewGalleryUserDirectory(db),
	)
	ctx := context.WithValue(context.Background(), middleware.UserIsRootKey, true)
	draft, err := service.CreateDraft(ctx, authorID.String())
	require.NoError(t, err)
	items := []appgallery.SaveItemInput{{FileID: firstID.String()}, {FileID: secondID.String()}}
	saved, err := service.Save(ctx, appgallery.SaveInput{
		UserID: authorID.String(), GalleryID: draft.ID, ExpectedVersion: draft.Version, Title: "Published title", Items: items,
	})
	require.NoError(t, err)
	published, err := service.Publish(ctx, appgallery.PublishInput{
		UserID: authorID.String(), GalleryID: draft.ID, ExpectedVersion: saved.Version,
	})
	require.NoError(t, err)
	modified, err := service.Save(ctx, appgallery.SaveInput{
		UserID: authorID.String(), GalleryID: draft.ID, ExpectedVersion: published.Version, Title: "Modified title", Items: items,
	})
	require.NoError(t, err)
	var before struct {
		WorkingRevisionID   string
		PublishedRevisionID string
		Version             int64
	}
	require.NoError(t, db.Table("galleries").Select("working_revision_id, published_revision_id, version").Where("id = ?", draft.ID).Take(&before).Error)
	require.NotEqual(t, before.WorkingRevisionID, before.PublishedRevisionID)
	assert.Equal(t, 2, galleryRefCount(t, db, firstID))
	assert.Equal(t, 2, galleryRefCount(t, db, secondID))
	installPublicationWriteFailure(t, db, "INSERT OR UPDATE")

	_, err = service.Publish(ctx, appgallery.PublishInput{
		UserID: authorID.String(), GalleryID: draft.ID, ExpectedVersion: modified.Version,
	})
	require.ErrorContains(t, err, "forced publication failure")
	var after struct {
		WorkingRevisionID   string
		PublishedRevisionID string
		Version             int64
	}
	require.NoError(t, db.Table("galleries").Select("working_revision_id, published_revision_id, version").Where("id = ?", draft.ID).Take(&after).Error)
	assert.Equal(t, before, after)
	assert.Equal(t, 2, galleryRefCount(t, db, firstID))
	assert.Equal(t, 2, galleryRefCount(t, db, secondID))
	galleryID := shared.MustParseID(draft.ID)
	assertPublicationEntry(t, db, domainpublication.KindGallery, galleryID, *published.Slug, "Published title", false)
	assertPublicationConsistencyClean(t, db)
}

func TestGalleryUseCasesMaintainOnlyPublishedRevisionProjection(t *testing.T) {
	db := setupPublicationIntegrationDB(t)
	authorID := preseedPublicationAuthor(t, db)
	firstID := preseedGalleryFile(t, db, authorID, "publication-gallery-first.jpg")
	secondID := preseedGalleryFile(t, db, authorID, "publication-gallery-second.jpg")
	service := appgallery.NewService(
		NewGalleryRepository(db), NewGalleryAssetStore(db), NewGalleryUnitOfWork(db), appshared.NoopEventBus{}, nil, NewGalleryUserDirectory(db),
	)
	ctx := context.WithValue(context.Background(), middleware.UserIsRootKey, true)
	draft, err := service.CreateDraft(ctx, authorID.String())
	require.NoError(t, err)
	galleryID := shared.MustParseID(draft.ID)
	items := []appgallery.SaveItemInput{{FileID: firstID.String()}, {FileID: secondID.String()}}
	saved, err := service.Save(ctx, appgallery.SaveInput{UserID: authorID.String(), GalleryID: draft.ID, ExpectedVersion: draft.Version, Title: "Gallery first", Items: items})
	require.NoError(t, err)
	assertNoPublicationEntry(t, db, domainpublication.KindGallery, galleryID)
	assertPublicationConsistencyClean(t, db)

	published, err := service.Publish(ctx, appgallery.PublishInput{UserID: authorID.String(), GalleryID: draft.ID, ExpectedVersion: saved.Version})
	require.NoError(t, err)
	assertPublicationEntry(t, db, domainpublication.KindGallery, galleryID, *published.Slug, "Gallery first", false)
	assertPublicationConsistencyClean(t, db)

	modified, err := service.Save(ctx, appgallery.SaveInput{UserID: authorID.String(), GalleryID: draft.ID, ExpectedVersion: published.Version, Title: "Gallery second", Items: items})
	require.NoError(t, err)
	assertPublicationEntry(t, db, domainpublication.KindGallery, galleryID, *published.Slug, "Gallery first", false)

	assertPublicationConsistencyClean(t, db)
	republished, err := service.Publish(ctx, appgallery.PublishInput{UserID: authorID.String(), GalleryID: draft.ID, ExpectedVersion: modified.Version})
	require.NoError(t, err)
	assertPublicationEntry(t, db, domainpublication.KindGallery, galleryID, *republished.Slug, "Gallery second", false)

	assertPublicationConsistencyClean(t, db)
	unpublished, err := service.Unpublish(ctx, appgallery.VersionInput{UserID: authorID.String(), GalleryID: draft.ID, ExpectedVersion: republished.Version})
	require.NoError(t, err)
	assertNoPublicationEntry(t, db, domainpublication.KindGallery, galleryID)
	assertPublicationConsistencyClean(t, db)
	require.NoError(t, service.Delete(ctx, appgallery.VersionInput{UserID: authorID.String(), GalleryID: draft.ID, ExpectedVersion: unpublished.Version}))
	assertPublicationConsistencyClean(t, db)
	assertNoPublicationEntry(t, db, domainpublication.KindGallery, galleryID)
}

func installPublicationWriteFailure(t *testing.T, db *gorm.DB, events string) {
	t.Helper()
	require.NoError(t, db.Exec(`CREATE FUNCTION publication_test_reject_write() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN RAISE EXCEPTION 'forced publication failure'; END; $$`).Error)
	require.NoError(t, db.Exec(fmt.Sprintf(`CREATE TRIGGER publication_test_reject_write BEFORE %s ON publication_entries
		FOR EACH ROW EXECUTE FUNCTION publication_test_reject_write()`, events)).Error)
	t.Cleanup(func() {
		_ = db.Exec("DROP TRIGGER IF EXISTS publication_test_reject_write ON publication_entries").Error
		_ = db.Exec("DROP FUNCTION IF EXISTS publication_test_reject_write() CASCADE").Error
	})
}

func preseedPublicationPost(t *testing.T, db *gorm.DB, authorID shared.ID) shared.ID {
	t.Helper()
	id := shared.NewID()
	require.NoError(t, db.Exec(`INSERT INTO posts
		(id, title, slug, content_md, content_html, status, author_id, is_featured, created_at, updated_at)
		VALUES (?, 'Article sync', 'article-sync', 'body', '<p>body</p>', 'draft', ?, false, NOW(), NOW())`,
		id.UUID(), authorID.UUID()).Error)
	return id
}

func assertPublicationEntry(t *testing.T, db *gorm.DB, kind domainpublication.Kind, id shared.ID, routeKey, title string, featured bool) {
	t.Helper()
	var count int64
	require.NoError(t, db.Table("publication_entries").Where("kind = ? AND source_id = ?", kind, id.UUID()).Count(&count).Error)
	require.Equal(t, int64(1), count)
	var row struct {
		RouteKey    string
		Title       string
		Featured    bool
		PublishedAt time.Time
	}
	require.NoError(t, db.Table("publication_entries").Where("kind = ? AND source_id = ?", kind, id.UUID()).Take(&row).Error)
	assert.Equal(t, routeKey, row.RouteKey)
	assert.Equal(t, title, row.Title)
	assert.Equal(t, featured, row.Featured)
	assert.False(t, row.PublishedAt.IsZero())
}

func assertNoPublicationEntry(t *testing.T, db *gorm.DB, kind domainpublication.Kind, id shared.ID) {
	t.Helper()
	var count int64
	require.NoError(t, db.Table("publication_entries").Where("kind = ? AND source_id = ?", kind, id.UUID()).Count(&count).Error)
	assert.Zero(t, count, fmt.Sprintf("unexpected %s publication entry", kind))
}
