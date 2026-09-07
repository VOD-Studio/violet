package gorm

import (
	"context"

	domainpublication "blog-api/internal/domain/publication"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"

	"gorm.io/gorm"
)

// PublicationRepository 是发布物投影的 GORM 读取适配器。
type PublicationRepository struct {
	db *gorm.DB
}

// NewPublicationRepository 创建发布物投影仓储。
func NewPublicationRepository(db *gorm.DB) *PublicationRepository {
	return &PublicationRepository{db: db}
}

var _ domainpublication.Repository = (*PublicationRepository)(nil)

// FindPage 按稳定复合游标读取发布物投影。
func (r *PublicationRepository) FindPage(ctx context.Context, query domainpublication.Query) ([]domainpublication.Entry, error) {
	db := r.db.WithContext(ctx).Model(&model.PublicationEntry{})
	if query.From != nil {
		db = db.Where("published_at >= ?", *query.From)
	}
	if query.To != nil {
		db = db.Where("published_at < ?", *query.To)
	}
	if query.FeaturedOnly {
		db = db.Where("kind = ? AND featured = true", domainpublication.KindArticle)
	}
	if query.Cursor != nil {
		db = db.Where(
			"published_at < ? OR (published_at = ? AND kind > ?) OR (published_at = ? AND kind = ? AND source_id < ?)",
			query.Cursor.PublishedAt,
			query.Cursor.PublishedAt, query.Cursor.Kind,
			query.Cursor.PublishedAt, query.Cursor.Kind, query.Cursor.SourceID.UUID(),
		)
	}

	var rows []model.PublicationEntry
	if err := db.Order("published_at DESC, kind ASC, source_id DESC").Limit(query.Limit).Find(&rows).Error; err != nil {
		return nil, shared.Internal("查询发布物流失败", err)
	}
	entries := make([]domainpublication.Entry, len(rows))
	for i, row := range rows {
		entries[i] = domainpublication.Entry{
			Kind:        domainpublication.Kind(row.Kind),
			SourceID:    shared.IDFromUUID(row.SourceID),
			RouteKey:    row.RouteKey,
			Title:       row.Title,
			PublishedAt: row.PublishedAt,
			Featured:    row.Featured,
		}
	}
	return entries, nil
}
