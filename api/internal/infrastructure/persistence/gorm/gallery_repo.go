package gorm

import (
	"context"
	"errors"
	"sort"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	domaingallery "blog-api/internal/domain/gallery"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

type GalleryRepository struct {
	db *gorm.DB
}

func NewGalleryRepository(db *gorm.DB) *GalleryRepository { return &GalleryRepository{db: db} }

func (r *GalleryRepository) Create(ctx context.Context, gallery *domaingallery.Gallery) error {
	root := galleryToPO(gallery)
	if err := r.db.WithContext(ctx).Create(&root).Error; err != nil {
		return shared.Internal("创建图集失败", err)
	}
	revision := revisionToPO(gallery.WorkingRevision())
	if err := r.db.WithContext(ctx).Create(&revision).Error; err != nil {
		return shared.Internal("创建图集工作稿失败", err)
	}
	return nil
}

func (r *GalleryRepository) FindByID(ctx context.Context, id shared.ID) (*domaingallery.Gallery, error) {
	return r.findByID(ctx, id, false)
}

func (r *GalleryRepository) FindByIDForUpdate(ctx context.Context, id shared.ID) (*domaingallery.Gallery, error) {
	return r.findByID(ctx, id, true)
}

func (r *GalleryRepository) findByID(ctx context.Context, id shared.ID, lock bool) (*domaingallery.Gallery, error) {
	query := r.db.WithContext(ctx)
	if lock {
		query = query.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	var root model.Gallery
	if err := query.First(&root, "id = ?", id.UUID()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domaingallery.ErrNotFound
		}
		return nil, shared.Internal("查询图集失败", err)
	}
	return r.reconstruct(ctx, root)
}

func (r *GalleryRepository) FindPageByAuthor(ctx context.Context, authorID shared.ID, q shared.PageQuery) (shared.PageResult[*domaingallery.Gallery], error) {
	q = q.Normalize()
	query := r.db.WithContext(ctx).Model(&model.Gallery{}).Where("author_id = ?", authorID.UUID())
	var roots []model.Gallery
	total, err := countAndFind(query.Order("created_at DESC, id DESC"), q, &roots, "图集")
	if err != nil {
		return shared.PageResult[*domaingallery.Gallery]{}, err
	}
	items, err := r.reconstructList(ctx, roots)
	if err != nil {
		return shared.PageResult[*domaingallery.Gallery]{}, err
	}
	return shared.NewPageResult(q, items, total), nil
}

func (r *GalleryRepository) SaveWorking(ctx context.Context, gallery *domaingallery.Gallery, expectedVersion int64) error {
	revision := gallery.WorkingRevision()
	var existing model.GalleryRevision
	err := r.db.WithContext(ctx).Select("id").First(&existing, "id = ? AND gallery_id = ?", revision.ID().UUID(), gallery.ID().UUID()).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		row := revisionToPO(revision)
		if err := r.db.WithContext(ctx).Create(&row).Error; err != nil {
			return shared.Internal("创建图集工作稿副本失败", err)
		}
	} else if err != nil {
		return shared.Internal("查询图集工作稿失败", err)
	} else {
		result := r.db.WithContext(ctx).Model(&model.GalleryRevision{}).
			Where("id = ? AND gallery_id = ?", revision.ID().UUID(), gallery.ID().UUID()).
			Updates(map[string]any{"title": revision.Title(), "summary": revision.Summary(), "updated_at": revision.UpdatedAt()})
		if result.Error != nil {
			return shared.Internal("保存图集工作稿失败", result.Error)
		}
		if result.RowsAffected != 1 {
			return domaingallery.ErrNotFound
		}
	}
	if err := r.db.WithContext(ctx).Where("revision_id = ?", revision.ID().UUID()).Delete(&model.GalleryRevisionItem{}).Error; err != nil {
		return shared.Internal("替换图集图片失败", err)
	}
	items := make([]model.GalleryRevisionItem, 0, len(revision.Items()))
	for _, item := range revision.Items() {
		items = append(items, itemToPO(revision.ID(), item))
	}
	if len(items) > 0 {
		if err := r.db.WithContext(ctx).Create(&items).Error; err != nil {
			return shared.Internal("保存图集图片失败", err)
		}
	}
	result := r.db.WithContext(ctx).Model(&model.Gallery{}).
		Where("id = ? AND version = ?", gallery.ID().UUID(), expectedVersion).
		Updates(map[string]any{
			"working_revision_id": gallery.WorkingRevision().ID().UUID(),
			"version":             gallery.Version(),
			"updated_at":          gallery.UpdatedAt(),
		})
	if result.Error != nil {
		return shared.Internal("推进图集版本失败", result.Error)
	}
	if result.RowsAffected != 1 {
		return domaingallery.ErrVersionConflict
	}
	return nil
}

func (r *GalleryRepository) SavePublishingState(ctx context.Context, gallery *domaingallery.Gallery, obsoleteRevisionID *shared.ID, expectedVersion int64) error {
	if gallery.PublishedAt() == nil || gallery.Slug() == "" {
		return shared.Internal("图集发布历史不完整", nil)
	}
	var publishedRevisionID any
	if gallery.PublishedRevisionID() != nil {
		publishedRevisionID = gallery.PublishedRevisionID().UUID()
	}
	result := r.db.WithContext(ctx).Model(&model.Gallery{}).
		Where("id = ? AND version = ?", gallery.ID().UUID(), expectedVersion).
		Updates(map[string]any{
			"slug":                  gallery.Slug(),
			"published_revision_id": publishedRevisionID,
			"published_at":          *gallery.PublishedAt(),
			"version":               gallery.Version(),
			"updated_at":            gallery.UpdatedAt(),
		})
	if result.Error != nil {
		return shared.Internal("发布图集失败", result.Error)
	}
	if result.RowsAffected != 1 {
		return domaingallery.ErrVersionConflict
	}
	if obsoleteRevisionID != nil {
		deleted := r.db.WithContext(ctx).
			Where("id = ? AND gallery_id = ?", obsoleteRevisionID.UUID(), gallery.ID().UUID()).
			Delete(&model.GalleryRevision{})
		if deleted.Error != nil {
			return shared.Internal("清理图集旧公开版本失败", deleted.Error)
		}
		if deleted.RowsAffected != 1 {
			return shared.Internal("图集旧公开版本不存在", nil)
		}
	}
	return nil
}

func (r *GalleryRepository) Delete(ctx context.Context, id shared.ID, expectedVersion int64) error {
	result := r.db.WithContext(ctx).Where("id = ? AND version = ?", id.UUID(), expectedVersion).Delete(&model.Gallery{})
	if result.Error != nil {
		return shared.Internal("删除图集失败", result.Error)
	}
	if result.RowsAffected != 1 {
		return domaingallery.ErrVersionConflict
	}
	return nil
}

func (r *GalleryRepository) FindPublishedPage(ctx context.Context, cursor *domaingallery.PublishedCursor, limit int) ([]domaingallery.PublishedGallery, error) {
	query := r.db.WithContext(ctx).
		Where("published_revision_id IS NOT NULL AND published_at IS NOT NULL")
	if cursor != nil {
		query = query.Where("published_at < ? OR (published_at = ? AND id < ?)", cursor.PublishedAt, cursor.PublishedAt, cursor.ID.UUID())
	}
	var roots []model.Gallery
	if err := query.Order("published_at DESC, id DESC").Limit(limit).Find(&roots).Error; err != nil {
		return nil, shared.Internal("查询公开图集失败", err)
	}
	return r.reconstructPublishedList(ctx, roots)
}

func (r *GalleryRepository) FindPublishedBySlug(ctx context.Context, slug string) (domaingallery.PublishedGallery, error) {
	var root model.Gallery
	if err := r.db.WithContext(ctx).
		Where("slug = ? AND published_revision_id IS NOT NULL AND published_at IS NOT NULL", slug).
		First(&root).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domaingallery.PublishedGallery{}, domaingallery.ErrNotFound
		}
		return domaingallery.PublishedGallery{}, shared.Internal("查询公开图集失败", err)
	}
	rows, err := r.reconstructPublishedList(ctx, []model.Gallery{root})
	if err != nil {
		return domaingallery.PublishedGallery{}, err
	}
	return rows[0], nil
}

func (r *GalleryRepository) reconstructPublishedList(ctx context.Context, roots []model.Gallery) ([]domaingallery.PublishedGallery, error) {
	if len(roots) == 0 {
		return make([]domaingallery.PublishedGallery, 0), nil
	}
	revisionIDs := make([]uuid.UUID, 0, len(roots))
	for _, root := range roots {
		if root.PublishedRevisionID == nil || root.PublishedAt == nil || root.Slug == nil {
			return nil, shared.Internal("图集公开状态不完整", nil)
		}
		revisionIDs = append(revisionIDs, *root.PublishedRevisionID)
	}
	var revisions []model.GalleryRevision
	if err := r.db.WithContext(ctx).Where("id IN ?", revisionIDs).Find(&revisions).Error; err != nil {
		return nil, shared.Internal("批量查询图集公开版本失败", err)
	}
	var items []model.GalleryRevisionItem
	if err := r.db.WithContext(ctx).Where("revision_id IN ?", revisionIDs).Order("revision_id ASC, position ASC").Find(&items).Error; err != nil {
		return nil, shared.Internal("批量查询图集公开图片失败", err)
	}
	revisionByID := make(map[uuid.UUID]model.GalleryRevision, len(revisions))
	itemsByRevision := make(map[uuid.UUID][]model.GalleryRevisionItem, len(revisions))
	for _, revision := range revisions {
		revisionByID[revision.ID] = revision
	}
	for _, item := range items {
		itemsByRevision[item.RevisionID] = append(itemsByRevision[item.RevisionID], item)
	}
	result := make([]domaingallery.PublishedGallery, 0, len(roots))
	for _, root := range roots {
		revision, ok := revisionByID[*root.PublishedRevisionID]
		if !ok {
			return nil, shared.Internal("图集缺少公开版本", nil)
		}
		rows := itemsByRevision[revision.ID]
		sort.Slice(rows, func(i, j int) bool { return rows[i].Position < rows[j].Position })
		items := make([]*domaingallery.RevisionItem, 0, len(rows))
		for _, row := range rows {
			items = append(items, domaingallery.ReconstructItem(shared.IDFromUUID(row.FileID), row.Position, row.Caption, row.AltTextOverride))
		}
		domainRevision := domaingallery.ReconstructRevision(
			shared.IDFromUUID(revision.ID), shared.IDFromUUID(revision.GalleryID), revision.Title, revision.Summary,
			items, revision.CreatedAt, revision.UpdatedAt,
		)
		result = append(result, domaingallery.PublishedGallery{
			ID: shared.IDFromUUID(root.ID), Slug: *root.Slug, PublishedAt: *root.PublishedAt, Revision: domainRevision,
		})
	}
	return result, nil
}

func (r *GalleryRepository) reconstruct(ctx context.Context, root model.Gallery) (*domaingallery.Gallery, error) {
	revisions, items, err := r.loadEffectiveRevisions(ctx, []model.Gallery{root})
	if err != nil {
		return nil, err
	}
	return galleryFromPO(root, revisions, items)
}

func (r *GalleryRepository) reconstructList(ctx context.Context, roots []model.Gallery) ([]*domaingallery.Gallery, error) {
	if len(roots) == 0 {
		return make([]*domaingallery.Gallery, 0), nil
	}
	revisionByID, itemsByRevision, err := r.loadEffectiveRevisions(ctx, roots)
	if err != nil {
		return nil, err
	}
	result := make([]*domaingallery.Gallery, 0, len(roots))
	for _, root := range roots {
		gallery, err := galleryFromPO(root, revisionByID, itemsByRevision)
		if err != nil {
			return nil, err
		}
		result = append(result, gallery)
	}
	return result, nil
}

func (r *GalleryRepository) loadEffectiveRevisions(ctx context.Context, roots []model.Gallery) (map[uuid.UUID]model.GalleryRevision, map[uuid.UUID][]model.GalleryRevisionItem, error) {
	revisionSet := make(map[uuid.UUID]struct{}, len(roots)*2)
	for _, root := range roots {
		revisionSet[root.WorkingRevisionID] = struct{}{}
		if root.PublishedRevisionID != nil {
			revisionSet[*root.PublishedRevisionID] = struct{}{}
		}
	}
	revisionIDs := make([]uuid.UUID, 0, len(revisionSet))
	for id := range revisionSet {
		revisionIDs = append(revisionIDs, id)
	}
	var revisions []model.GalleryRevision
	if err := r.db.WithContext(ctx).Where("id IN ?", revisionIDs).Find(&revisions).Error; err != nil {
		return nil, nil, shared.Internal("批量查询图集有效版本失败", err)
	}
	var items []model.GalleryRevisionItem
	if err := r.db.WithContext(ctx).Where("revision_id IN ?", revisionIDs).Order("revision_id ASC, position ASC").Find(&items).Error; err != nil {
		return nil, nil, shared.Internal("批量查询图集有效版本图片失败", err)
	}
	revisionByID := make(map[uuid.UUID]model.GalleryRevision, len(revisions))
	itemsByRevision := make(map[uuid.UUID][]model.GalleryRevisionItem, len(revisions))
	for _, revision := range revisions {
		revisionByID[revision.ID] = revision
	}
	for _, item := range items {
		itemsByRevision[item.RevisionID] = append(itemsByRevision[item.RevisionID], item)
	}
	return revisionByID, itemsByRevision, nil
}

func galleryToPO(gallery *domaingallery.Gallery) model.Gallery {
	workingID := gallery.WorkingRevision().ID().UUID()
	var slug *string
	if gallery.Slug() != "" {
		value := gallery.Slug()
		slug = &value
	}
	var publishedID *uuid.UUID
	if gallery.PublishedRevisionID() != nil {
		value := gallery.PublishedRevisionID().UUID()
		publishedID = &value
	}
	return model.Gallery{
		ID: gallery.ID().UUID(), AuthorID: gallery.AuthorID().UUID(), Slug: slug,
		WorkingRevisionID: workingID, PublishedRevisionID: publishedID, Version: gallery.Version(),
		PublishedAt: gallery.PublishedAt(), CreatedAt: gallery.CreatedAt(), UpdatedAt: gallery.UpdatedAt(),
	}
}

func revisionToPO(revision *domaingallery.Revision) model.GalleryRevision {
	return model.GalleryRevision{
		ID: revision.ID().UUID(), GalleryID: revision.GalleryID().UUID(), Title: revision.Title(), Summary: revision.Summary(),
		CreatedAt: revision.CreatedAt(), UpdatedAt: revision.UpdatedAt(),
	}
}

func itemToPO(revisionID shared.ID, item *domaingallery.RevisionItem) model.GalleryRevisionItem {
	return model.GalleryRevisionItem{
		RevisionID: revisionID.UUID(), FileID: item.FileID().UUID(), Position: item.Position(),
		Caption: item.Caption(), AltTextOverride: item.AltTextOverride(),
	}
}

func revisionFromPO(revision model.GalleryRevision, rows []model.GalleryRevisionItem) *domaingallery.Revision {
	items := make([]*domaingallery.RevisionItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, domaingallery.ReconstructItem(shared.IDFromUUID(row.FileID), row.Position, row.Caption, row.AltTextOverride))
	}
	return domaingallery.ReconstructRevision(
		shared.IDFromUUID(revision.ID), shared.IDFromUUID(revision.GalleryID), revision.Title, revision.Summary,
		items, revision.CreatedAt, revision.UpdatedAt,
	)
}

func galleryFromPO(root model.Gallery, revisions map[uuid.UUID]model.GalleryRevision, items map[uuid.UUID][]model.GalleryRevisionItem) (*domaingallery.Gallery, error) {
	workingRow, ok := revisions[root.WorkingRevisionID]
	if !ok {
		return nil, shared.Internal("图集缺少工作稿", nil)
	}
	working := revisionFromPO(workingRow, items[workingRow.ID])
	var published *domaingallery.Revision
	if root.PublishedRevisionID != nil {
		if *root.PublishedRevisionID == root.WorkingRevisionID {
			published = working
		} else {
			publishedRow, exists := revisions[*root.PublishedRevisionID]
			if !exists {
				return nil, shared.Internal("图集缺少公开版本", nil)
			}
			published = revisionFromPO(publishedRow, items[publishedRow.ID])
		}
	}
	slug := ""
	if root.Slug != nil {
		slug = *root.Slug
	}
	return domaingallery.Reconstruct(
		shared.IDFromUUID(root.ID), shared.IDFromUUID(root.AuthorID), slug, working, published,
		root.Version, root.PublishedAt, root.CreatedAt, root.UpdatedAt,
	), nil
}

var _ domaingallery.Repository = (*GalleryRepository)(nil)
