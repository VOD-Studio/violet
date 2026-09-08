package gorm

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	domainpersona "blog-api/internal/domain/persona"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// PersonaRepository 持久化多语言人设档案及站点当前选择关系。
type PersonaRepository struct {
	db *gorm.DB
}

func NewPersonaRepository(db *gorm.DB) *PersonaRepository {
	return &PersonaRepository{db: db}
}

func (r *PersonaRepository) Create(ctx context.Context, persona *domainpersona.Persona) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		row := personaToPO(persona)
		if err := tx.Create(&row).Error; err != nil {
			return shared.Internal("创建人设档案失败", err)
		}
		if err := persistPersonaLocalizations(tx, persona); err != nil {
			return err
		}
		return nil
	})
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
		query = query.Where(
			"EXISTS (SELECT 1 FROM persona_localizations pl WHERE pl.persona_id = personas.id AND LOWER(pl.name) LIKE ?)",
			"%"+strings.ToLower(search)+"%",
		)
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
	if err := r.db.WithContext(ctx).
		Where("persona_id = ?", persona.ID().UUID()).
		Delete(&model.PersonaLocalization{}).Error; err != nil {
		return shared.Internal("替换人设语言版本失败", err)
	}
	if err := persistPersonaLocalizations(r.db.WithContext(ctx), persona); err != nil {
		return err
	}

	result := r.db.WithContext(ctx).Model(&model.Persona{}).
		Where("id = ? AND version = ?", persona.ID().UUID(), expectedVersion).
		Updates(map[string]any{
			"default_locale": persona.DefaultLocale(),
			"avatar_file_id": nullableUUID(persona.AvatarFileID()),
			"version":        persona.Version(),
			"updated_at":     persona.UpdatedAt(),
		})
	if result.Error != nil {
		return shared.Internal("保存人设档案失败", result.Error)
	}
	if result.RowsAffected != 1 {
		return domainpersona.ErrVersionConflict
	}
	return nil
}

func persistPersonaLocalizations(db *gorm.DB, persona *domainpersona.Persona) error {
	localizations := persona.Localizations()
	localizationRows := make([]model.PersonaLocalization, 0, len(localizations))
	factRows := make([]model.PersonaFact, 0)
	imageRows := make([]model.PersonaImage, 0)
	for _, localization := range localizations {
		localizationRows = append(localizationRows, model.PersonaLocalization{
			PersonaID: persona.ID().UUID(), Locale: localization.Locale(),
			Name: localization.Name(), Subtitle: localization.Subtitle(), Summary: localization.Summary(),
			ContentMD: localization.ContentMD(), ContentHTML: localization.ContentHTML(),
		})
		for _, fact := range localization.Facts() {
			factRows = append(factRows, model.PersonaFact{
				PersonaID: persona.ID().UUID(), Locale: localization.Locale(),
				Position: fact.Position(), Label: fact.Label(), Value: fact.Value(),
			})
		}
		for _, image := range localization.Images() {
			imageRows = append(imageRows, model.PersonaImage{
				PersonaID: persona.ID().UUID(), Locale: localization.Locale(), Position: image.Position(),
				FileID: image.FileID().UUID(), Caption: image.Caption(), AltTextOverride: image.AltTextOverride(),
			})
		}
	}
	if len(localizationRows) > 0 {
		if err := db.Create(&localizationRows).Error; err != nil {
			return shared.Internal("保存人设语言版本失败", err)
		}
	}
	if len(factRows) > 0 {
		if err := db.Create(&factRows).Error; err != nil {
			return shared.Internal("保存人设资料项失败", err)
		}
	}
	if len(imageRows) > 0 {
		if err := db.Create(&imageRows).Error; err != nil {
			return shared.Internal("保存人设设定图失败", err)
		}
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

type personaLocalizationKey struct {
	personaID uuid.UUID
	locale    string
}

func (r *PersonaRepository) reconstructList(ctx context.Context, rows []model.Persona) ([]*domainpersona.Persona, error) {
	if len(rows) == 0 {
		return make([]*domainpersona.Persona, 0), nil
	}
	ids := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ID)
	}

	var localizationRows []model.PersonaLocalization
	if err := r.db.WithContext(ctx).
		Where("persona_id IN ?", ids).
		Order("persona_id ASC, locale ASC").
		Find(&localizationRows).Error; err != nil {
		return nil, shared.Internal("查询人设语言版本失败", err)
	}
	var factRows []model.PersonaFact
	if err := r.db.WithContext(ctx).
		Where("persona_id IN ?", ids).
		Order("persona_id ASC, locale ASC, position ASC").
		Find(&factRows).Error; err != nil {
		return nil, shared.Internal("查询人设资料项失败", err)
	}
	var imageRows []model.PersonaImage
	if err := r.db.WithContext(ctx).
		Where("persona_id IN ?", ids).
		Order("persona_id ASC, locale ASC, position ASC").
		Find(&imageRows).Error; err != nil {
		return nil, shared.Internal("查询人设设定图失败", err)
	}

	factsByLocalization := make(map[personaLocalizationKey][]*domainpersona.Fact)
	for _, fact := range factRows {
		key := personaLocalizationKey{personaID: fact.PersonaID, locale: fact.Locale}
		factsByLocalization[key] = append(factsByLocalization[key], domainpersona.ReconstructFact(fact.Position, fact.Label, fact.Value))
	}
	imagesByLocalization := make(map[personaLocalizationKey][]*domainpersona.Image)
	for _, image := range imageRows {
		key := personaLocalizationKey{personaID: image.PersonaID, locale: image.Locale}
		imagesByLocalization[key] = append(imagesByLocalization[key], domainpersona.ReconstructImage(
			shared.IDFromUUID(image.FileID), image.Position, image.Caption, image.AltTextOverride,
		))
	}
	localizationsByPersona := make(map[uuid.UUID][]*domainpersona.Localization, len(rows))
	for _, localization := range localizationRows {
		key := personaLocalizationKey{personaID: localization.PersonaID, locale: localization.Locale}
		localizationsByPersona[localization.PersonaID] = append(
			localizationsByPersona[localization.PersonaID],
			domainpersona.ReconstructLocalization(
				localization.Locale, localization.Name, localization.Subtitle, localization.Summary,
				localization.ContentMD, localization.ContentHTML,
				factsByLocalization[key], imagesByLocalization[key],
			),
		)
	}

	result := make([]*domainpersona.Persona, 0, len(rows))
	for _, row := range rows {
		result = append(result, domainpersona.Reconstruct(
			shared.IDFromUUID(row.ID), shared.IDFromUUID(row.CreatedBy),
			row.DefaultLocale, idFromNullableUUID(row.AvatarFileID), localizationsByPersona[row.ID],
			row.Version, row.CreatedAt, row.UpdatedAt,
		))
	}
	return result, nil
}

func personaToPO(persona *domainpersona.Persona) model.Persona {
	return model.Persona{
		ID: persona.ID().UUID(), CreatedBy: persona.CreatedBy().UUID(),
		DefaultLocale: persona.DefaultLocale(), AvatarFileID: nullableUUID(persona.AvatarFileID()),
		Version: persona.Version(), CreatedAt: persona.CreatedAt(), UpdatedAt: persona.UpdatedAt(),
	}
}

func nullableUUID(id shared.ID) *uuid.UUID {
	if id.IsZero() {
		return nil
	}
	value := id.UUID()
	return &value
}

func idFromNullableUUID(id *uuid.UUID) shared.ID {
	if id == nil {
		return shared.ID{}
	}
	return shared.IDFromUUID(*id)
}

var _ domainpersona.Repository = (*PersonaRepository)(nil)
