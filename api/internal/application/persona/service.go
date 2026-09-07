package persona

import (
	"context"
	"sort"
	"strconv"
	"strings"
	"time"

	"blog-api/internal/application/markdown"
	domainpersona "blog-api/internal/domain/persona"
	"blog-api/internal/domain/shared"
)

// Service 编排人设档案管理、当前选择和公开读取。
type Service struct {
	repo   domainpersona.Repository
	assets AssetStore
	uow    UnitOfWork
}

func NewService(repo domainpersona.Repository, assets AssetStore, uow UnitOfWork) *Service {
	return &Service{repo: repo, assets: assets, uow: uow}
}

// Create 创建空人设档案。
func (s *Service) Create(ctx context.Context, userID string) (DetailDTO, error) {
	creatorID, err := shared.ParseID(userID)
	if err != nil {
		return DetailDTO{}, err
	}
	persona, err := domainpersona.NewPersona(shared.NewID(), creatorID)
	if err != nil {
		return DetailDTO{}, err
	}
	if err := s.repo.Create(ctx, persona); err != nil {
		return DetailDTO{}, err
	}
	return toDetailDTO(persona, nil, false)
}

// List 分页读取后台人设档案。
func (s *Service) List(ctx context.Context, query ListQuery) ([]SummaryDTO, int64, int, int, error) {
	pageQuery := shared.PageQuery{Page: query.Page, Limit: query.Limit}.Normalize()
	page, err := s.repo.FindPage(ctx, domainpersona.ListFilter{Search: query.Search}, pageQuery)
	if err != nil {
		return nil, 0, 0, 0, err
	}
	activeID, err := s.repo.FindActiveID(ctx)
	if err != nil {
		return nil, 0, 0, 0, err
	}
	items := make([]SummaryDTO, 0, len(page.Items))
	for _, persona := range page.Items {
		items = append(items, toSummaryDTO(persona, idsEqual(activeID, persona.ID())))
	}
	return items, page.Total, page.Page, page.Limit, nil
}

// GetForAdmin 读取后台完整人设档案。
func (s *Service) GetForAdmin(ctx context.Context, personaID string) (DetailDTO, error) {
	id, err := shared.ParseID(personaID)
	if err != nil {
		return DetailDTO{}, err
	}
	persona, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return DetailDTO{}, err
	}
	assets, err := s.assets.FindByIDs(ctx, imageIDs(persona.Images()))
	if err != nil {
		return DetailDTO{}, err
	}
	activeID, err := s.repo.FindActiveID(ctx)
	if err != nil {
		return DetailDTO{}, err
	}
	return toDetailDTO(persona, assets, idsEqual(activeID, id))
}

// Save 全量保存人设档案，并在同一事务内维护素材引用计数。
func (s *Service) Save(ctx context.Context, input SaveInput) (DetailDTO, error) {
	personaID, err := shared.ParseID(input.PersonaID)
	if err != nil {
		return DetailDTO{}, err
	}
	document, desiredIDs, err := parseDocument(input)
	if err != nil {
		return DetailDTO{}, err
	}
	document.ContentHTML, err = markdown.ToHTML(document.ContentMD)
	if err != nil {
		return DetailDTO{}, shared.Internal("渲染人设设定正文失败", err)
	}

	var saved *domainpersona.Persona
	var savedAssets []Asset
	var active bool
	err = s.uow.Do(ctx, func(tx Transaction) error {
		persona, err := tx.Personas().FindByIDForUpdate(ctx, personaID)
		if err != nil {
			return err
		}
		activeID, err := tx.Personas().FindActiveID(ctx)
		if err != nil {
			return err
		}
		active = idsEqual(activeID, personaID)
		oldIDs := imageIDs(persona.Images())
		if err := persona.ReplaceDocument(input.ExpectedVersion, document, active); err != nil {
			return err
		}
		assets, err := tx.Assets().FindByIDsForUpdate(ctx, sortedIDUnion(oldIDs, desiredIDs))
		if err != nil {
			return err
		}
		if err := validateAssets(desiredIDs, assets); err != nil {
			return err
		}
		added, removed := diffIDs(oldIDs, desiredIDs)
		for _, id := range added {
			if err := tx.Assets().UpdateRefCount(ctx, id, 1); err != nil {
				return err
			}
		}
		for _, id := range removed {
			if err := tx.Assets().UpdateRefCount(ctx, id, -1); err != nil {
				return err
			}
		}
		if err := tx.Personas().Save(ctx, persona, input.ExpectedVersion); err != nil {
			return err
		}
		saved, savedAssets = persona, assets
		return nil
	})
	if err != nil {
		return DetailDTO{}, err
	}
	return toDetailDTO(saved, savedAssets, active)
}

// Activate 把完整档案设为站点当前人设。
func (s *Service) Activate(ctx context.Context, input VersionInput) (DetailDTO, error) {
	personaID, err := shared.ParseID(input.PersonaID)
	if err != nil {
		return DetailDTO{}, err
	}
	var activated *domainpersona.Persona
	var activatedAssets []Asset
	err = s.uow.Do(ctx, func(tx Transaction) error {
		persona, err := tx.Personas().FindByIDForUpdate(ctx, personaID)
		if err != nil {
			return err
		}
		if err := persona.EnsureVersion(input.ExpectedVersion); err != nil {
			return err
		}
		if err := persona.ValidateForActivation(); err != nil {
			return err
		}
		ids := imageIDs(persona.Images())
		assets, err := tx.Assets().FindByIDsForUpdate(ctx, ids)
		if err != nil {
			return err
		}
		if err := validateAssets(ids, assets); err != nil {
			return err
		}
		if err := tx.Personas().SetActive(ctx, personaID, time.Now()); err != nil {
			return err
		}
		activated, activatedAssets = persona, assets
		return nil
	})
	if err != nil {
		return DetailDTO{}, err
	}
	return toDetailDTO(activated, activatedAssets, true)
}

// Delete 删除非当前人设档案并释放素材引用。
func (s *Service) Delete(ctx context.Context, input VersionInput) error {
	personaID, err := shared.ParseID(input.PersonaID)
	if err != nil {
		return err
	}
	return s.uow.Do(ctx, func(tx Transaction) error {
		persona, err := tx.Personas().FindByIDForUpdate(ctx, personaID)
		if err != nil {
			return err
		}
		if err := persona.EnsureVersion(input.ExpectedVersion); err != nil {
			return err
		}
		activeID, err := tx.Personas().FindActiveID(ctx)
		if err != nil {
			return err
		}
		if idsEqual(activeID, personaID) {
			return domainpersona.ErrActiveDelete
		}
		ids := imageIDs(persona.Images())
		if _, err := tx.Assets().FindByIDsForUpdate(ctx, ids); err != nil {
			return err
		}
		if err := tx.Personas().Delete(ctx, personaID, input.ExpectedVersion); err != nil {
			return err
		}
		for _, id := range ids {
			if err := tx.Assets().UpdateRefCount(ctx, id, -1); err != nil {
				return err
			}
		}
		return nil
	})
}

// GetActive 返回唯一当前人设的公开投影。
func (s *Service) GetActive(ctx context.Context) (PublicPersonaDTO, error) {
	activeID, err := s.repo.FindActiveID(ctx)
	if err != nil {
		return PublicPersonaDTO{}, err
	}
	if activeID == nil {
		return PublicPersonaDTO{}, domainpersona.ErrNoActivePersona
	}
	persona, err := s.repo.FindByID(ctx, *activeID)
	if err != nil {
		return PublicPersonaDTO{}, err
	}
	assets, err := s.assets.FindByIDs(ctx, imageIDs(persona.Images()))
	if err != nil {
		return PublicPersonaDTO{}, err
	}
	return toPublicDTO(persona, assets)
}

func parseDocument(input SaveInput) (domainpersona.Document, []shared.ID, error) {
	facts := make([]domainpersona.FactInput, 0, len(input.Facts))
	for _, fact := range input.Facts {
		facts = append(facts, domainpersona.FactInput{Label: fact.Label, Value: fact.Value})
	}
	images := make([]domainpersona.ImageInput, 0, len(input.Images))
	ids := make([]shared.ID, 0, len(input.Images))
	for _, image := range input.Images {
		id, err := shared.ParseID(image.FileID)
		if err != nil {
			return domainpersona.Document{}, nil, err
		}
		ids = append(ids, id)
		images = append(images, domainpersona.ImageInput{
			FileID: id, Caption: image.Caption, AltTextOverride: image.AltTextOverride,
		})
	}
	return domainpersona.Document{
		Name: input.Name, Subtitle: input.Subtitle, Summary: input.Summary,
		ContentMD: input.ContentMD, Facts: facts, Images: images,
	}, ids, nil
}

func validateAssets(desiredIDs []shared.ID, assets []Asset) error {
	byID := make(map[shared.ID]Asset, len(assets))
	for _, asset := range assets {
		byID[asset.ID] = asset
	}
	for _, id := range desiredIDs {
		asset, ok := byID[id]
		if !ok {
			return shared.BadRequest("部分人设设定图素材不存在")
		}
		if asset.DeletedAt != nil || asset.Status != "ready" {
			return shared.BadRequest("人设设定图必须已处理完成且未删除")
		}
		if !strings.HasPrefix(asset.MimeType, "image/") {
			return shared.BadRequest("人设档案只接受图片素材")
		}
	}
	return nil
}

func toDetailDTO(persona *domainpersona.Persona, assets []Asset, active bool) (DetailDTO, error) {
	adminImages, err := adminImagesToDTO(persona, assets)
	if err != nil {
		return DetailDTO{}, err
	}
	return DetailDTO{
		ID: persona.ID().String(), CreatedBy: persona.CreatedBy().String(),
		Name: persona.Name(), Subtitle: persona.Subtitle(), Summary: persona.Summary(),
		ContentMD: persona.ContentMD(), ContentHTML: persona.ContentHTML(), Facts: factsToDTO(persona),
		Images: adminImages, IsActive: active, IsComplete: persona.ValidateForActivation() == nil,
		Version: persona.Version(), CreatedAt: formatTime(persona.CreatedAt()), UpdatedAt: formatTime(persona.UpdatedAt()),
	}, nil
}

func toPublicDTO(persona *domainpersona.Persona, assets []Asset) (PublicPersonaDTO, error) {
	byID := assetsByID(assets)
	images := make([]PublicImageDTO, 0, len(persona.Images()))
	for position, image := range persona.Images() {
		asset, ok := byID[image.FileID()]
		if !ok {
			return PublicPersonaDTO{}, shared.Internal("当前人设缺少设定图素材", nil)
		}
		images = append(images, PublicImageDTO{
			URL: asset.URL, Thumbnail: asset.Thumbnail, Width: asset.Width, Height: asset.Height,
			Caption: image.Caption(), AltText: resolveAlt(persona.Name(), position, image.AltTextOverride(), asset.AltText),
		})
	}
	return PublicPersonaDTO{
		Name: persona.Name(), Subtitle: persona.Subtitle(), Summary: persona.Summary(),
		ContentHTML: persona.ContentHTML(), Facts: factsToDTO(persona), Images: images,
	}, nil
}

func adminImagesToDTO(persona *domainpersona.Persona, assets []Asset) ([]AdminImageDTO, error) {
	if len(persona.Images()) == 0 {
		return make([]AdminImageDTO, 0), nil
	}
	byID := assetsByID(assets)
	images := make([]AdminImageDTO, 0, len(persona.Images()))
	for position, image := range persona.Images() {
		asset, ok := byID[image.FileID()]
		if !ok {
			return nil, shared.Internal("人设档案缺少设定图素材", nil)
		}
		images = append(images, AdminImageDTO{
			FileID: image.FileID().String(), URL: asset.URL, Thumbnail: asset.Thumbnail,
			MimeType: asset.MimeType, Width: asset.Width, Height: asset.Height,
			Caption: image.Caption(), AltText: resolveAlt(persona.Name(), position, image.AltTextOverride(), asset.AltText),
			AltTextOverride: image.AltTextOverride(),
		})
	}
	return images, nil
}

func resolveAlt(name string, position int, override, fallback string) string {
	if value := strings.TrimSpace(override); value != "" {
		return value
	}
	if value := strings.TrimSpace(fallback); value != "" {
		return value
	}
	return strings.TrimSpace(name) + "设定图 " + strconv.Itoa(position+1)
}

func assetsByID(assets []Asset) map[shared.ID]Asset {
	result := make(map[shared.ID]Asset, len(assets))
	for _, asset := range assets {
		result[asset.ID] = asset
	}
	return result
}

func imageIDs(images []*domainpersona.Image) []shared.ID {
	result := make([]shared.ID, 0, len(images))
	for _, image := range images {
		result = append(result, image.FileID())
	}
	return result
}

func idsEqual(activeID *shared.ID, id shared.ID) bool {
	return activeID != nil && activeID.Equal(id)
}

func sortedIDUnion(left, right []shared.ID) []shared.ID {
	set := make(map[shared.ID]struct{}, len(left)+len(right))
	for _, id := range left {
		set[id] = struct{}{}
	}
	for _, id := range right {
		set[id] = struct{}{}
	}
	result := make([]shared.ID, 0, len(set))
	for id := range set {
		result = append(result, id)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].String() < result[j].String() })
	return result
}

func diffIDs(before, after []shared.ID) (added, removed []shared.ID) {
	beforeSet := make(map[shared.ID]struct{}, len(before))
	afterSet := make(map[shared.ID]struct{}, len(after))
	for _, id := range before {
		beforeSet[id] = struct{}{}
	}
	for _, id := range after {
		afterSet[id] = struct{}{}
		if _, ok := beforeSet[id]; !ok {
			added = append(added, id)
		}
	}
	for _, id := range before {
		if _, ok := afterSet[id]; !ok {
			removed = append(removed, id)
		}
	}
	return added, removed
}
