package gorm

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	domainpersona "blog-api/internal/domain/persona"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// PersonaRepository 持久化人设档案及站点当前选择关系。
type PersonaRepository struct {
	db *gorm.DB
}

func NewPersonaRepository(db *gorm.DB) *PersonaRepository {
	return &PersonaRepository{db: db}
}

func (r *PersonaRepository) Create(ctx context.Context, persona *domainpersona.Persona) error {
	row := personaToPO(persona)
	if err := r.db.WithContext(ctx).Create(&row).Error; err != nil {
		return shared.Internal("创建人设档案失败", err)
	}
	return nil
}

func (r *PersonaRepository) FindByID(ctx context.Context, id shared.ID) (*domainpersona.Persona, error) {
	return r.findByID(ctx, id, false)
}

func (r *PersonaRepository) FindByIDForUpdate(ctx context.Context, id shared.ID) (*domainpersona.Persona, error) {
	return r.findByID(ctx, id, true)
}

func (r *PersonaRepository) findByID(ctx context.Context, id shared.ID, lock bool) (*domainpersona.Persona, error) {
	query := r.db.WithContext(ctx)
	if lock {
		query = query.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	var row model.Persona
	if err := query.First(&row, "id = ?", id.UUID()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domainpersona.ErrNotFound
		}
		return nil, shared.Internal("查询人设档案失败", err)
	}
	rows, err := r.reconstructList(ctx, []model.Persona{row})
	if err != nil {
		return nil, err
	}
	return rows[0], nil
}

func (r *PersonaRepository) FindPage(ctx context.Context, filter domainpersona.ListFilter, q shared.PageQuery) (shared.PageResult[*domainpersona.Persona], error) {
	q = q.Normalize()
	query := r.db.WithContext(ctx).
		Model(&model.Persona{}).
		Joins("LEFT JOIN persona_selection ON persona_selection.persona_id = personas.id")
	if search := strings.TrimSpace(filter.Search); search != "" {
		query = query.Where("LOWER(personas.name) LIKE ?", "%"+strings.ToLower(search)+"%")
	}

	var rows []model.Persona
	total, err := countAndFind(
		query.Order("CASE WHEN persona_selection.persona_id IS NULL THEN 1 ELSE 0 END ASC, personas.updated_at DESC, personas.id DESC"),
		q,
		&rows,
		"人设档案",
	)
	if err != nil {
		return shared.PageResult[*domainpersona.Persona]{}, err
	}
	items, err := r.reconstructList(ctx, rows)
	if err != nil {
		return shared.PageResult[*domainpersona.Persona]{}, err
	}
	return shared.NewPageResult(q, items, total), nil
}

func (r *PersonaRepository) Save(ctx context.Context, persona *domainpersona.Persona, expectedVersion int64) error {
	if err := r.db.WithContext(ctx).Where("persona_id = ?", persona.ID().UUID()).Delete(&model.PersonaFact{}).Error; err != nil {
		return shared.Internal("替换人设资料项失败", err)
	}
	factRows := make([]model.PersonaFact, 0, len(persona.Facts()))
	for _, fact := range persona.Facts() {
		factRows = append(factRows, model.PersonaFact{
			PersonaID: persona.ID().UUID(), Position: fact.Position(), Label: fact.Label(), Value: fact.Value(),
		})
	}
	if len(factRows) > 0 {
		if err := r.db.WithContext(ctx).Create(&factRows).Error; err != nil {
			return shared.Internal("保存人设资料项失败", err)
		}
	}

	if err := r.db.WithContext(ctx).Where("persona_id = ?", persona.ID().UUID()).Delete(&model.PersonaImage{}).Error; err != nil {
		return shared.Internal("替换人设设定图失败", err)
	}
	imageRows := make([]model.PersonaImage, 0, len(persona.Images()))
	for _, image := range persona.Images() {
		imageRows = append(imageRows, model.PersonaImage{
			PersonaID: persona.ID().UUID(), Position: image.Position(), FileID: image.FileID().UUID(),
			Caption: image.Caption(), AltTextOverride: image.AltTextOverride(),
		})
	}
	if len(imageRows) > 0 {
		if err := r.db.WithContext(ctx).Create(&imageRows).Error; err != nil {
			return shared.Internal("保存人设设定图失败", err)
		}
	}

	result := r.db.WithContext(ctx).Model(&model.Persona{}).
		Where("id = ? AND version = ?", persona.ID().UUID(), expectedVersion).
		Updates(map[string]any{
			"name": persona.Name(), "subtitle": persona.Subtitle(), "summary": persona.Summary(),
			"content_md": persona.ContentMD(), "content_html": persona.ContentHTML(),
			"version": persona.Version(), "updated_at": persona.UpdatedAt(),
		})
	if result.Error != nil {
		return shared.Internal("保存人设档案失败", result.Error)
	}
	if result.RowsAffected != 1 {
		return domainpersona.ErrVersionConflict
	}
	return nil
}

func (r *PersonaRepository) Delete(ctx context.Context, id shared.ID, expectedVersion int64) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND version = ?", id.UUID(), expectedVersion).
		Delete(&model.Persona{})
	if result.Error != nil {
		return shared.Internal("删除人设档案失败", result.Error)
	}
	if result.RowsAffected != 1 {
		return domainpersona.ErrVersionConflict
	}
	return nil
}

func (r *PersonaRepository) FindActiveID(ctx context.Context) (*shared.ID, error) {
	var selection model.PersonaSelection
	if err := r.db.WithContext(ctx).First(&selection, "singleton_key = ?", int16(1)).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, shared.Internal("查询当前人设失败", err)
	}
	id := shared.IDFromUUID(selection.PersonaID)
	return &id, nil
}

func (r *PersonaRepository) SetActive(ctx context.Context, id shared.ID, activatedAt time.Time) error {
	selection := model.PersonaSelection{SingletonKey: 1, PersonaID: id.UUID(), ActivatedAt: activatedAt}
	if err := r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "singleton_key"}},
		DoUpdates: clause.Assignments(map[string]any{
			"persona_id": id.UUID(), "activated_at": activatedAt,
		}),
	}).Create(&selection).Error; err != nil {
		return shared.Internal("激活人设档案失败", err)
	}
	return nil
}

func (r *PersonaRepository) reconstructList(ctx context.Context, rows []model.Persona) ([]*domainpersona.Persona, error) {
	if len(rows) == 0 {
		return make([]*domainpersona.Persona, 0), nil
	}
	ids := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ID)
	}

	var factRows []model.PersonaFact
	if err := r.db.WithContext(ctx).
		Where("persona_id IN ?", ids).
		Order("persona_id ASC, position ASC").
		Find(&factRows).Error; err != nil {
		return nil, shared.Internal("查询人设资料项失败", err)
	}
	var imageRows []model.PersonaImage
	if err := r.db.WithContext(ctx).
		Where("persona_id IN ?", ids).
		Order("persona_id ASC, position ASC").
		Find(&imageRows).Error; err != nil {
		return nil, shared.Internal("查询人设设定图失败", err)
	}

	factsByPersona := make(map[uuid.UUID][]*domainpersona.Fact, len(rows))
	for _, fact := range factRows {
		factsByPersona[fact.PersonaID] = append(factsByPersona[fact.PersonaID], domainpersona.ReconstructFact(fact.Position, fact.Label, fact.Value))
	}
	imagesByPersona := make(map[uuid.UUID][]*domainpersona.Image, len(rows))
	for _, image := range imageRows {
		imagesByPersona[image.PersonaID] = append(imagesByPersona[image.PersonaID], domainpersona.ReconstructImage(
			shared.IDFromUUID(image.FileID), image.Position, image.Caption, image.AltTextOverride,
		))
	}

	result := make([]*domainpersona.Persona, 0, len(rows))
	for _, row := range rows {
		facts := factsByPersona[row.ID]
		images := imagesByPersona[row.ID]
		sort.Slice(facts, func(i, j int) bool { return facts[i].Position() < facts[j].Position() })
		sort.Slice(images, func(i, j int) bool { return images[i].Position() < images[j].Position() })
		result = append(result, domainpersona.Reconstruct(
			shared.IDFromUUID(row.ID), shared.IDFromUUID(row.CreatedBy),
			row.Name, row.Subtitle, row.Summary, row.ContentMD, row.ContentHTML,
			facts, images, row.Version, row.CreatedAt, row.UpdatedAt,
		))
	}
	return result, nil
}

func personaToPO(persona *domainpersona.Persona) model.Persona {
	return model.Persona{
		ID: persona.ID().UUID(), CreatedBy: persona.CreatedBy().UUID(),
		Name: persona.Name(), Subtitle: persona.Subtitle(), Summary: persona.Summary(),
		ContentMD: persona.ContentMD(), ContentHTML: persona.ContentHTML(), Version: persona.Version(),
		CreatedAt: persona.CreatedAt(), UpdatedAt: persona.UpdatedAt(),
	}
}

var _ domainpersona.Repository = (*PersonaRepository)(nil)
