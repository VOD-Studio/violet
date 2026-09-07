package gorm

import (
	"context"
	"database/sql"

	domainpublication "blog-api/internal/domain/publication"
	"blog-api/internal/domain/shared"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PublicationConsistencyChecker 比较公开来源与发布物投影。
type PublicationConsistencyChecker struct{ db *gorm.DB }

// NewPublicationConsistencyChecker 返回只读校验器；Check 只报告差异，不修复数据。
func NewPublicationConsistencyChecker(db *gorm.DB) *PublicationConsistencyChecker {
	return &PublicationConsistencyChecker{db: db}
}

// Check 在同一个只读快照中报告 missing、orphaned 和 drifted 发布物。
func (c *PublicationConsistencyChecker) Check(ctx context.Context) (domainpublication.ConsistencyReport, error) {
	report := domainpublication.ConsistencyReport{
		Missing: make([]domainpublication.Discrepancy, 0), Orphaned: make([]domainpublication.Discrepancy, 0), Drifted: make([]domainpublication.Discrepancy, 0),
	}
	err := c.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		checker := PublicationConsistencyChecker{db: tx}
		for _, spec := range publicationSQLSourceSpecs() {
			if err := checker.checkSQLSource(ctx, spec, &report); err != nil {
				return err
			}
		}
		return checker.checkNoteSource(ctx, &report)
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return domainpublication.ConsistencyReport{}, shared.Internal("校验发布物投影失败", err)
	}
	return report, nil
}

func (c *PublicationConsistencyChecker) checkSQLSource(
	ctx context.Context,
	spec publicationSourceSpec,
	report *domainpublication.ConsistencyReport,
) error {
	var rows []struct {
		SourceID uuid.UUID
		State    string
	}
	query := `WITH source AS (` + spec.sourceSQL + `),
		projection AS (
			SELECT source_id, route_key, title, published_at, featured
			FROM publication_entries
			WHERE kind = ?
		)
		SELECT COALESCE(source.source_id, projection.source_id) AS source_id,
		CASE
			WHEN projection.source_id IS NULL THEN 'missing'
			WHEN source.source_id IS NULL THEN 'orphaned'
			ELSE 'drifted'
		END AS state
		FROM source
		FULL OUTER JOIN projection ON projection.source_id = source.source_id
		WHERE source.source_id IS NULL OR projection.source_id IS NULL
		   OR source.route_key IS DISTINCT FROM projection.route_key
		   OR source.title IS DISTINCT FROM projection.title
		   OR source.published_at IS DISTINCT FROM projection.published_at
		   OR source.featured IS DISTINCT FROM projection.featured
		ORDER BY COALESCE(source.source_id, projection.source_id)`
	if err := c.db.WithContext(ctx).Raw(query, spec.kind).Scan(&rows).Error; err != nil {
		return err
	}
	for _, row := range rows {
		appendPublicationDiscrepancy(report, spec.kind, row.SourceID, domainpublication.DiscrepancyType(row.State))
	}
	return nil
}

func (c *PublicationConsistencyChecker) checkNoteSource(
	ctx context.Context,
	report *domainpublication.ConsistencyReport,
) error {
	rows, err := c.db.WithContext(ctx).Raw(`WITH source AS (
			SELECT id AS source_id, id::text AS route_key, title AS raw_title, content_html,
			       published_at, false AS featured
			FROM notes WHERE status = 'published' AND published_at IS NOT NULL
		),
		projection AS (
			SELECT source_id, route_key, title, published_at, featured
			FROM publication_entries WHERE kind = ?
		)
		SELECT COALESCE(source.source_id, projection.source_id) AS source_id,
		       source.source_id IS NOT NULL AS source_exists,
		       projection.source_id IS NOT NULL AS projection_exists,
		       source.raw_title, source.content_html, projection.title,
		       source.route_key IS DISTINCT FROM projection.route_key
		           OR source.published_at IS DISTINCT FROM projection.published_at
		           OR source.featured IS DISTINCT FROM projection.featured AS metadata_drifted
		FROM source
		FULL OUTER JOIN projection ON projection.source_id = source.source_id
		ORDER BY COALESCE(source.source_id, projection.source_id)`, domainpublication.KindNote).Rows()
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			sourceID         uuid.UUID
			sourceExists     bool
			projectionExists bool
			sourceTitle      sql.NullString
			contentHTML      sql.NullString
			projectionTitle  sql.NullString
			metadataDrifted  bool
		)
		if err := rows.Scan(
			&sourceID,
			&sourceExists,
			&projectionExists,
			&sourceTitle,
			&contentHTML,
			&projectionTitle,
			&metadataDrifted,
		); err != nil {
			return err
		}
		switch {
		case !sourceExists:
			appendPublicationDiscrepancy(report, domainpublication.KindNote, sourceID, domainpublication.DiscrepancyOrphaned)
		case !projectionExists:
			appendPublicationDiscrepancy(report, domainpublication.KindNote, sourceID, domainpublication.DiscrepancyMissing)
		case metadataDrifted || domainpublication.DeriveNoteTitle(sourceTitle.String, contentHTML.String) != projectionTitle.String:
			appendPublicationDiscrepancy(report, domainpublication.KindNote, sourceID, domainpublication.DiscrepancyDrifted)
		}
	}
	return rows.Err()
}

func appendPublicationDiscrepancy(
	report *domainpublication.ConsistencyReport,
	kind domainpublication.Kind,
	sourceID uuid.UUID,
	discrepancyType domainpublication.DiscrepancyType,
) {
	discrepancy := domainpublication.Discrepancy{Kind: kind, SourceID: shared.IDFromUUID(sourceID), Type: discrepancyType}
	switch discrepancyType {
	case domainpublication.DiscrepancyMissing:
		report.Missing = append(report.Missing, discrepancy)
	case domainpublication.DiscrepancyOrphaned:
		report.Orphaned = append(report.Orphaned, discrepancy)
	case domainpublication.DiscrepancyDrifted:
		report.Drifted = append(report.Drifted, discrepancy)
	}
}

type publicationSourceSpec struct {
	kind      domainpublication.Kind
	sourceSQL string
}

func publicationSQLSourceSpecs() []publicationSourceSpec {
	return []publicationSourceSpec{
		{domainpublication.KindArticle, `SELECT id AS source_id, slug AS route_key, title, published_at, is_featured AS featured
			FROM posts WHERE status = 'published' AND published_at IS NOT NULL AND deleted_at IS NULL`},
		{domainpublication.KindGallery, `SELECT g.id AS source_id, g.slug AS route_key,
			COALESCE(NULLIF(BTRIM(r.title), ''), '无题图集') AS title, g.published_at, false AS featured
			FROM galleries g JOIN gallery_revisions r ON r.id = g.published_revision_id AND r.gallery_id = g.id
			WHERE g.published_revision_id IS NOT NULL AND g.published_at IS NOT NULL AND g.slug IS NOT NULL`},
	}
}
