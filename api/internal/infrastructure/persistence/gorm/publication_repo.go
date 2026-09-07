package gorm

import (
	"context"

	domainpublication "blog-api/internal/domain/publication"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// PublicationRepository 读写普通发布物投影表。
type PublicationRepository struct {
	db *gorm.DB
}

// NewPublicationRepository 绑定数据库句柄；传入事务句柄时读写不会脱离该事务。
func NewPublicationRepository(db *gorm.DB) *PublicationRepository {
	return &PublicationRepository{db: db}
}

var _ domainpublication.Reader = (*PublicationRepository)(nil)
var _ domainpublication.Writer = (*PublicationRepository)(nil)

// Upsert 创建或更新发布物投影。
func (r *PublicationRepository) Upsert(ctx context.Context, entry domainpublication.Entry) error {
	row := model.PublicationEntry{
		Kind:        string(entry.Kind),
		SourceID:    entry.SourceID.UUID(),
		RouteKey:    entry.RouteKey,
		Title:       entry.Title,
		PublishedAt: entry.PublishedAt,
		Featured:    entry.Featured,
	}
	err := r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "kind"}, {Name: "source_id"}},
		DoUpdates: clause.Assignments(map[string]any{
			"route_key":    entry.RouteKey,
			"title":        entry.Title,
			"published_at": entry.PublishedAt,
			"featured":     entry.Featured,
			"updated_at":   gorm.Expr("CURRENT_TIMESTAMP"),
		}),
	}).Create(&row).Error
	if err != nil {
		return shared.Internal("保存发布物投影失败", err)
	}
	return nil
}

// Delete 删除指定来源发布物投影。
func (r *PublicationRepository) Delete(ctx context.Context, kind domainpublication.Kind, sourceID shared.ID) error {
	if err := r.db.WithContext(ctx).
		Where("kind = ? AND source_id = ?", kind, sourceID.UUID()).
		Delete(&model.PublicationEntry{}).Error; err != nil {
		return shared.Internal("删除发布物投影失败", err)
	}
	return nil
}

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
