package gorm

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	domainpublication "blog-api/internal/domain/publication"
	"blog-api/internal/domain/shared"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"gorm.io/gorm"
)

func setupPublicationIntegrationDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := setupIntegrationDB(t)
	t.Cleanup(func() {
		_ = db.Exec("DELETE FROM publication_entries").Error
		_ = db.Exec("DELETE FROM gallery_revision_items").Error
		_ = db.Exec("DELETE FROM galleries").Error
		_ = db.Exec("DELETE FROM gallery_revisions").Error
		_ = db.Exec("DELETE FROM notes").Error
		_ = db.Exec("DELETE FROM files WHERE original_name LIKE 'publication-%'").Error
		_ = db.Exec("DELETE FROM posts WHERE author_id IN (SELECT id FROM users WHERE username LIKE 'publication-%')").Error
		_ = db.Exec("DELETE FROM users WHERE username LIKE 'publication-%'").Error
	})
	return db
}

func TestPublicationMigrationBackfillsPublishedSourcesIdempotently(t *testing.T) {
	db := setupPublicationIntegrationDB(t)
	authorID := preseedPublicationAuthor(t, db)
	publishedAt := time.Date(2026, time.September, 7, 8, 0, 0, 0, time.UTC)
	articleID, draftArticleID := shared.NewID(), shared.NewID()
	noteID, draftNoteID := shared.NewID(), shared.NewID()
	galleryID, revisionID := shared.NewID(), shared.NewID()

	require.NoError(t, db.Exec(`INSERT INTO posts
		(id, title, slug, content_md, content_html, status, author_id, is_featured, published_at)
		VALUES (?, 'Article', 'article', '', '', 'published', ?, true, ?),
		       (?, 'Draft', 'draft', '', '', 'draft', ?, false, NULL)`,
		articleID.UUID(), authorID.UUID(), publishedAt, draftArticleID.UUID(), authorID.UUID()).Error)
	require.NoError(t, db.Exec(`INSERT INTO notes
		(id, author_id, title, content_md, content_html, status, published_at)
		VALUES (?, ?, '', '', '<p>正文标题 <strong>来自内容</strong></p>', 'published', ?),
		       (?, ?, 'Draft note', '', '', 'draft', NULL)`,
		noteID.UUID(), authorID.UUID(), publishedAt, draftNoteID.UUID(), authorID.UUID()).Error)
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`INSERT INTO galleries
			(id, author_id, slug, working_revision_id, published_revision_id, published_at)
			VALUES (?, ?, 'gallery', ?, NULL, ?)`, galleryID.UUID(), authorID.UUID(), revisionID.UUID(), publishedAt).Error; err != nil {
			return err
		}
		if err := tx.Exec(`INSERT INTO gallery_revisions (id, gallery_id, title) VALUES (?, ?, 'Gallery')`, revisionID.UUID(), galleryID.UUID()).Error; err != nil {
			return err
		}
		return tx.Exec(`UPDATE galleries SET published_revision_id = ? WHERE id = ?`, revisionID.UUID(), galleryID.UUID()).Error
	}))
	const backfill = `
		INSERT INTO publication_entries (kind, source_id, route_key, title, published_at, featured)
		SELECT 'article', id, slug, title, published_at, is_featured FROM posts
		WHERE status = 'published' AND published_at IS NOT NULL AND deleted_at IS NULL
		UNION ALL
		SELECT 'note', id, id::text,
		       COALESCE(NULLIF(BTRIM(title), ''),
		           CASE WHEN CHAR_LENGTH(note_text) > 48 THEN LEFT(note_text, 48) || '…' ELSE note_text END,
		           '无题笔记'),
		       published_at, false
		FROM (
		    SELECT notes.*, NULLIF(BTRIM(REGEXP_REPLACE(REGEXP_REPLACE(content_html, '<[^>]+>', ' ', 'g'), '\s+', ' ', 'g')), '') AS note_text
		    FROM notes
		) published_notes
		WHERE status = 'published' AND published_at IS NOT NULL
		UNION ALL
		SELECT 'gallery', g.id, g.slug, COALESCE(NULLIF(BTRIM(r.title), ''), '无题图集'), g.published_at, false
		FROM galleries g JOIN gallery_revisions r ON r.id = g.published_revision_id AND r.gallery_id = g.id
		WHERE g.published_revision_id IS NOT NULL AND g.published_at IS NOT NULL AND g.slug IS NOT NULL
		ON CONFLICT (kind, source_id) DO UPDATE SET
			route_key = EXCLUDED.route_key, title = EXCLUDED.title,
			published_at = EXCLUDED.published_at, featured = EXCLUDED.featured, updated_at = NOW()`
	require.NoError(t, db.Exec(backfill).Error)
	require.NoError(t, db.Exec(backfill).Error)

	var entries []struct {
		Kind     string
		SourceID string
		RouteKey string
		Title    string
		Featured bool
	}
	require.NoError(t, db.Table("publication_entries").Order("kind").Scan(&entries).Error)
	require.Len(t, entries, 3)
	assert.Equal(t, []string{"article", "gallery", "note"}, []string{entries[0].Kind, entries[1].Kind, entries[2].Kind})
	assert.True(t, entries[0].Featured)
	assert.Equal(t, noteID.String(), entries[2].RouteKey)
	assert.Equal(t, "正文标题 来自内容", entries[2].Title)
}

func TestPublicationRepositoryUsesStrictOrderingBoundsAndCursor(t *testing.T) {
	db := setupPublicationIntegrationDB(t)
	repo := NewPublicationRepository(db)
	at := time.Date(2026, time.September, 7, 8, 0, 0, 0, time.UTC)
	ids := []shared.ID{shared.NewID(), shared.NewID(), shared.NewID(), shared.NewID()}
	for index, row := range []struct {
		kind     domainpublication.Kind
		id       shared.ID
		when     time.Time
		featured bool
	}{
		{domainpublication.KindNote, ids[0], at, false},
		{domainpublication.KindArticle, ids[1], at, true},
		{domainpublication.KindGallery, ids[2], at, false},
		{domainpublication.KindArticle, ids[3], at.Add(-time.Hour), false},
	} {
		require.NoError(t, db.Exec(`INSERT INTO publication_entries
			(kind, source_id, route_key, title, published_at, featured) VALUES (?, ?, ?, ?, ?, ?)`,
			row.kind, row.id.UUID(), fmt.Sprintf("route-%d", index), fmt.Sprintf("Title %d", index), row.when, row.featured).Error)
	}

	page, err := repo.FindPage(context.Background(), domainpublication.Query{Limit: 3})
	require.NoError(t, err)
	require.Len(t, page, 3)
	assert.Equal(t, []domainpublication.Kind{domainpublication.KindArticle, domainpublication.KindGallery, domainpublication.KindNote}, []domainpublication.Kind{page[0].Kind, page[1].Kind, page[2].Kind})

	second, err := repo.FindPage(context.Background(), domainpublication.Query{
		Cursor: &domainpublication.Cursor{PublishedAt: page[1].PublishedAt, Kind: page[1].Kind, SourceID: page[1].SourceID},
		From:   ptrTime(at.Add(-time.Hour)),
		To:     ptrTime(at.Add(time.Second)),
		Limit:  10,
	})
	require.NoError(t, err)
	require.Len(t, second, 2)
	assert.Equal(t, domainpublication.KindNote, second[0].Kind)
	assert.True(t, second[1].PublishedAt.Equal(at.Add(-time.Hour)))

	featured, err := repo.FindPage(context.Background(), domainpublication.Query{FeaturedOnly: true, Limit: 10})
	require.NoError(t, err)
	require.Len(t, featured, 1)
	assert.Equal(t, domainpublication.KindArticle, featured[0].Kind)
	assert.True(t, featured[0].Featured)
}

func TestPublicationRepositoryPlanUsesStreamIndex(t *testing.T) {
	db := setupPublicationIntegrationDB(t)
	var raw sql.NullString
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`SET LOCAL enable_seqscan = off`).Error; err != nil {
			return err
		}
		return tx.Raw(`EXPLAIN (FORMAT JSON, COSTS OFF)
			SELECT kind, source_id, route_key, title, published_at, featured
			FROM publication_entries
			ORDER BY published_at DESC, kind ASC, source_id DESC
			LIMIT 20`).Scan(&raw).Error
	}))
	var plan any
	require.NoError(t, json.Unmarshal([]byte(raw.String), &plan))
	encoded, err := json.Marshal(plan)
	require.NoError(t, err)
	assert.Contains(t, string(encoded), "idx_publication_entries_stream")
}

func ptrTime(value time.Time) *time.Time { return &value }

func preseedPublicationAuthor(t *testing.T, db *gorm.DB) shared.ID {
	t.Helper()
	authorID := shared.NewID()
	shortID := authorID.String()[:8]
	require.NoError(t, db.Exec(
		`INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, updated_at)
		 VALUES (?, ?, ?, 'x', 'user', true, NOW(), NOW())`,
		authorID.UUID(),
		"publication-"+shortID,
		fmt.Sprintf("publication-%s@test", shortID),
	).Error)
	return authorID
}
