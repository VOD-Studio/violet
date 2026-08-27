package gorm

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	domaingallery "blog-api/internal/domain/gallery"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// GalleryRepository 图集仓储 GORM 实现。
type GalleryRepository struct {
	db *gorm.DB
}

// NewGalleryRepository 构造仓储。
func NewGalleryRepository(db *gorm.DB) *GalleryRepository {
	return &GalleryRepository{db: db}
}

// Save 保存图集：根字段按主键 upsert；items 全量替换
// （删旧插新，position 按切片顺序写入——拖拽调序天然对应全量提交，
// 主键 (gallery_id, file_id) 无顺序唯一索引，无需两阶段写）。
func (r *GalleryRepository) Save(ctx context.Context, g *domaingallery.Gallery) error {
	po := galleryToPO(g)
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&po).Error; err != nil {
			return err
		}
		if err := tx.Where("gallery_id = ?", po.ID).Delete(&model.GalleryItem{}).Error; err != nil {
			return err
		}
		items := g.Items()
		pos := make([]model.GalleryItem, 0, len(items))
		for i, it := range items {
			pos = append(pos, model.GalleryItem{
				GalleryID: po.ID,
				FileID:    it.FileID().UUID(),
				Caption:   it.Caption(),
				Position:  i,
			})
		}
		if len(pos) > 0 {
			if err := tx.Create(&pos).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return domainshared.Internal("保存图集失败", err)
	}
	return nil
}

// FindByID 按 ID 查找（含 items，按 position 升序）。
func (r *GalleryRepository) FindByID(ctx context.Context, id domainshared.ID) (*domaingallery.Gallery, error) {
	var po model.Gallery
	if err := r.db.WithContext(ctx).First(&po, "id = ?", id.UUID()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domaingallery.ErrGalleryNotFound
		}
		return nil, domainshared.Internal("查询图集失败", err)
	}
	return r.reconstruct(ctx, po)
}

// FindPublishedPage 公开浏览流分页：仅 published，created_at DESC。
func (r *GalleryRepository) FindPublishedPage(ctx context.Context, q domainshared.PageQuery) (domainshared.PageResult[*domaingallery.Gallery], error) {
	q = q.Normalize()
	query := r.db.WithContext(ctx).Model(&model.Gallery{}).Where("status = ?", domaingallery.StatusPublished)
	var pos []model.Gallery
	total, err := countAndFind(query.Order("created_at DESC, id DESC"), q, &pos, "图集")
	if err != nil {
		return domainshared.PageResult[*domaingallery.Gallery]{}, err
	}
	items, err := r.reconstructList(ctx, pos)
	if err != nil {
		return domainshared.PageResult[*domaingallery.Gallery]{}, err
	}
	return domainshared.NewPageResult(q, items, total), nil
}

// FindPageByOwner 用户主页分页：该作者全部 published 图集，created_at DESC。
func (r *GalleryRepository) FindPageByOwner(ctx context.Context, ownerID domainshared.ID, q domainshared.PageQuery) (domainshared.PageResult[*domaingallery.Gallery], error) {
	q = q.Normalize()
	query := r.db.WithContext(ctx).Model(&model.Gallery{}).
		Where("owner_id = ? AND status = ?", ownerID.UUID(), domaingallery.StatusPublished)
	var pos []model.Gallery
	total, err := countAndFind(query.Order("created_at DESC, id DESC"), q, &pos, "图集")
	if err != nil {
		return domainshared.PageResult[*domaingallery.Gallery]{}, err
	}
	items, err := r.reconstructList(ctx, pos)
	if err != nil {
		return domainshared.PageResult[*domaingallery.Gallery]{}, err
	}
	return domainshared.NewPageResult(q, items, total), nil
}

// FindAdminPage 管理列表分页：全部状态，created_at DESC。
func (r *GalleryRepository) FindAdminPage(ctx context.Context, q domainshared.PageQuery) (domainshared.PageResult[*domaingallery.Gallery], error) {
	q = q.Normalize()
	query := r.db.WithContext(ctx).Model(&model.Gallery{})
	var pos []model.Gallery
	total, err := countAndFind(query.Order("created_at DESC, id DESC"), q, &pos, "图集")
	if err != nil {
		return domainshared.PageResult[*domaingallery.Gallery]{}, err
	}
	items, err := r.reconstructList(ctx, pos)
	if err != nil {
		return domainshared.PageResult[*domaingallery.Gallery]{}, err
	}
	return domainshared.NewPageResult(q, items, total), nil
}

// Delete 物理删除图集（gallery_items 行由 FK ON DELETE CASCADE 清理）。
func (r *GalleryRepository) Delete(ctx context.Context, id domainshared.ID) error {
	if err := r.db.WithContext(ctx).Delete(&model.Gallery{}, "id = ?", id.UUID()).Error; err != nil {
		return domainshared.Internal("删除图集失败", err)
	}
	return nil
}

// ============ 转换器 ============

// galleryToPO 领域实体 → 持久化模型。
func galleryToPO(g *domaingallery.Gallery) model.Gallery {
	var coverID *uuid.UUID
	if c := g.CoverFileID(); c != nil {
		u := c.UUID()
		coverID = &u
	}
	return model.Gallery{
		ID:          g.ID().UUID(),
		OwnerID:     g.OwnerID().UUID(),
		Title:       g.Title(),
		Description: g.Description(),
		CoverFileID: coverID,
		Status:      g.Status(),
		CreatedAt:   g.CreatedAt(),
		UpdatedAt:   g.UpdatedAt(),
	}
}

// reconstruct PO → 领域实体（含 items 加载，position 升序）。
func (r *GalleryRepository) reconstruct(ctx context.Context, po model.Gallery) (*domaingallery.Gallery, error) {
	var itemPOs []model.GalleryItem
	if err := r.db.WithContext(ctx).
		Where("gallery_id = ?", po.ID).Order("position ASC").Find(&itemPOs).Error; err != nil {
		return nil, domainshared.Internal("查询图集媒体项失败", err)
	}
	items := make([]domaingallery.GalleryItem, 0, len(itemPOs))
	for _, ipo := range itemPOs {
		items = append(items, domaingallery.ReconstructGalleryItem(domainshared.IDFromUUID(ipo.FileID), ipo.Caption))
	}
	var coverID *domainshared.ID
	if po.CoverFileID != nil {
		id := domainshared.IDFromUUID(*po.CoverFileID)
		coverID = &id
	}
	return domaingallery.ReconstructGallery(
		domainshared.IDFromUUID(po.ID),
		domainshared.IDFromUUID(po.OwnerID),
		po.Title, po.Description, coverID, po.Status,
		items, po.CreatedAt, po.UpdatedAt,
	), nil
}

// reconstructList 批量重建（逐集带 items；分页 ≤ limit 集，可接受）。
func (r *GalleryRepository) reconstructList(ctx context.Context, pos []model.Gallery) ([]*domaingallery.Gallery, error) {
	out := make([]*domaingallery.Gallery, 0, len(pos))
	for _, po := range pos {
		g, err := r.reconstruct(ctx, po)
		if err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, nil
}

// 编译期断言：仓储实现满足领域接口。
var _ domaingallery.GalleryRepository = (*GalleryRepository)(nil)
