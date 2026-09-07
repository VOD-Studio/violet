package gorm

import (
	"context"
	"testing"
	"time"

	domainpublication "blog-api/internal/domain/publication"
	"blog-api/internal/domain/shared"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestPublicationConsistencyCheckReportsMissingOrphanedAndDrifted(t *testing.T) {
	db := setupPublicationIntegrationDB(t)
	authorID := preseedPublicationAuthor(t, db)
	publishedAt := time.Date(2026, time.September, 7, 12, 0, 0, 0, time.UTC)
	missingID, driftedID, orphanedID := shared.NewID(), shared.NewID(), shared.NewID()
	require.NoError(t, db.Exec(`INSERT INTO posts
		(id, title, slug, content_md, content_html, status, author_id, is_featured, published_at, created_at, updated_at)
		VALUES (?, 'Missing', 'missing', '', '', 'published', ?, false, ?, NOW(), NOW()),
		       (?, 'Current', 'current', '', '', 'published', ?, true, ?, NOW(), NOW())`,
		missingID.UUID(), authorID.UUID(), publishedAt,
		driftedID.UUID(), authorID.UUID(), publishedAt).Error)
	require.NoError(t, db.Exec(`INSERT INTO publication_entries
		(kind, source_id, route_key, title, published_at, featured) VALUES
		('article', ?, 'stale', 'Stale', ?, false),
		('note', ?, ?, 'Orphaned', ?, false)`,
		driftedID.UUID(), publishedAt,
		orphanedID.UUID(), orphanedID.String(), publishedAt).Error)

	report, err := NewPublicationConsistencyChecker(db).Check(context.Background())
	require.NoError(t, err)
	assert.Equal(t, []domainpublication.Discrepancy{{Kind: domainpublication.KindArticle, SourceID: missingID, Type: domainpublication.DiscrepancyMissing}}, report.Missing)
	assert.Equal(t, []domainpublication.Discrepancy{{Kind: domainpublication.KindNote, SourceID: orphanedID, Type: domainpublication.DiscrepancyOrphaned}}, report.Orphaned)
	assert.Equal(t, []domainpublication.Discrepancy{{Kind: domainpublication.KindArticle, SourceID: driftedID, Type: domainpublication.DiscrepancyDrifted}}, report.Drifted)
}

func assertPublicationConsistencyClean(t *testing.T, db *gorm.DB) {
	t.Helper()
	report, err := NewPublicationConsistencyChecker(db).Check(context.Background())
	require.NoError(t, err)
	assert.Empty(t, report.Missing)
	assert.Empty(t, report.Orphaned)
	assert.Empty(t, report.Drifted)
}
