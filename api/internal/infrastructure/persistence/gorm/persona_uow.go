package gorm

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	apppersona "blog-api/internal/application/persona"
	domainpersona "blog-api/internal/domain/persona"
	"blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// PersonaUnitOfWork 为档案、当前选择和素材引用提供同一个 PostgreSQL 事务。
type PersonaUnitOfWork struct {
	db *gorm.DB
}

func NewPersonaUnitOfWork(db *gorm.DB) *PersonaUnitOfWork {
	return &PersonaUnitOfWork{db: db}
}

func (u *PersonaUnitOfWork) Do(ctx context.Context, fn func(apppersona.Transaction) error) error {
	return u.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return fn(&personaTransaction{
			personas: NewPersonaRepository(tx),
			assets:   NewPersonaAssetStore(tx),
		})
	})
}

type personaTransaction struct {
	personas domainpersona.Repository
	assets   apppersona.AssetStore
}

func (t *personaTransaction) Personas() domainpersona.Repository { return t.personas }
func (t *personaTransaction) Assets() apppersona.AssetStore      { return t.assets }

// PersonaAssetStore 把 files 表适配为 Persona application 的素材端口。
type PersonaAssetStore struct {
	db    *gorm.DB
	files domainupload.FileRepository
}

func NewPersonaAssetStore(db *gorm.DB) *PersonaAssetStore {
	return &PersonaAssetStore{db: db, files: NewFileRepository(db)}
}

func (s *PersonaAssetStore) FindByIDs(ctx context.Context, ids []shared.ID) ([]apppersona.Asset, error) {
	return s.findByIDs(ctx, ids, false)
}

func (s *PersonaAssetStore) FindByIDsForUpdate(ctx context.Context, ids []shared.ID) ([]apppersona.Asset, error) {
	return s.findByIDs(ctx, ids, true)
}

func (s *PersonaAssetStore) findByIDs(ctx context.Context, ids []shared.ID, lock bool) ([]apppersona.Asset, error) {
	if len(ids) == 0 {
		return make([]apppersona.Asset, 0), nil
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
		return nil, shared.Internal("查询人设设定图素材失败", err)
	}
	assets := make([]apppersona.Asset, 0, len(rows))
	for _, row := range rows {
		width, height := 0, 0
		if row.Width != nil {
			width = *row.Width
		}
		if row.Height != nil {
			height = *row.Height
		}
		assets = append(assets, apppersona.Asset{
			ID: shared.IDFromUUID(row.ID), URL: row.URL, Thumbnail: row.Thumbnail,
			MimeType: row.MimeType, Status: row.Status, Width: width, Height: height,
			AltText: row.AltText, DeletedAt: row.DeletedAt,
		})
	}
	return assets, nil
}

func (s *PersonaAssetStore) UpdateRefCount(ctx context.Context, id shared.ID, delta int) error {
	return s.files.UpdateRefCount(ctx, id, delta)
}

var _ apppersona.UnitOfWork = (*PersonaUnitOfWork)(nil)
var _ apppersona.AssetStore = (*PersonaAssetStore)(nil)
