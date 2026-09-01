package gorm

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	appgallery "blog-api/internal/application/gallery"
	domaingallery "blog-api/internal/domain/gallery"
	"blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// GalleryUnitOfWork 为图集和素材引用提供同一个 PostgreSQL 事务。
type GalleryUnitOfWork struct {
	db *gorm.DB
}

func NewGalleryUnitOfWork(db *gorm.DB) *GalleryUnitOfWork { return &GalleryUnitOfWork{db: db} }

// Do 在同一事务中提供图集仓储与素材 adapter。
func (u *GalleryUnitOfWork) Do(ctx context.Context, fn func(appgallery.Transaction) error) error {
	return u.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return fn(&galleryTransaction{
			galleries: NewGalleryRepository(tx),
			assets:    NewGalleryAssetStore(tx),
		})
	})
}

type galleryTransaction struct {
	galleries domaingallery.Repository
	assets    appgallery.AssetStore
}

func (t *galleryTransaction) Galleries() domaingallery.Repository { return t.galleries }
func (t *galleryTransaction) Assets() appgallery.AssetStore       { return t.assets }

// GalleryAssetStore 把现有 files 表适配为 Gallery application 的素材端口。
type GalleryAssetStore struct {
	db    *gorm.DB
	files domainupload.FileRepository
}

func NewGalleryAssetStore(db *gorm.DB) *GalleryAssetStore {
	return &GalleryAssetStore{db: db, files: NewFileRepository(db)}
}

func (s *GalleryAssetStore) FindByIDs(ctx context.Context, ids []shared.ID) ([]appgallery.Asset, error) {
	return s.findByIDs(ctx, ids, false)
}

func (s *GalleryAssetStore) FindByIDsForUpdate(ctx context.Context, ids []shared.ID) ([]appgallery.Asset, error) {
	return s.findByIDs(ctx, ids, true)
}

func (s *GalleryAssetStore) findByIDs(ctx context.Context, ids []shared.ID, lock bool) ([]appgallery.Asset, error) {
	if len(ids) == 0 {
		return make([]appgallery.Asset, 0), nil
	}
	uuids := make([]uuid.UUID, 0, len(ids))
	for _, id := range ids {
		uuids = append(uuids, id.UUID())
	}
	query := s.db.WithContext(ctx).Where("id IN ?", uuids).Order("id ASC")
	if lock {
		query = query.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	var rows []model.File
	if err := query.Find(&rows).Error; err != nil {
		return nil, shared.Internal("查询图集素材失败", err)
	}
	assets := make([]appgallery.Asset, 0, len(rows))
	for _, row := range rows {
		width, height := 0, 0
		if row.Width != nil {
			width = *row.Width
		}
		if row.Height != nil {
			height = *row.Height
		}
		assets = append(assets, appgallery.Asset{
			ID: shared.IDFromUUID(row.ID), OwnerID: shared.IDFromUUID(row.OwnerID),
			URL: row.URL, Thumbnail: row.Thumbnail, MimeType: row.MimeType, Status: row.Status,
			Width: width, Height: height, AltText: row.AltText, DeletedAt: row.DeletedAt,
		})
	}
	return assets, nil
}

func (s *GalleryAssetStore) UpdateRefCount(ctx context.Context, id shared.ID, delta int) error {
	return s.files.UpdateRefCount(ctx, id, delta)
}

var _ appgallery.UnitOfWork = (*GalleryUnitOfWork)(nil)
var _ appgallery.AssetStore = (*GalleryAssetStore)(nil)
