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

// Service 编排多语言人设档案管理、当前选择和公开读取。
type Service struct {
	repo   domainpersona.Repository
	assets AssetStore
	uow    UnitOfWork
}

func NewService(repo domainpersona.Repository, assets AssetStore, uow UnitOfWork) *Service {
	return &Service{repo: repo, assets: assets, uow: uow}
}

// Create 创建带空默认语言版本的人设档案。
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
	assets, err := s.assets.FindByIDs(ctx, idsFromCounts(persona.FileReferenceCounts()))
	if err != nil {
		return DetailDTO{}, err
	}
	activeID, err := s.repo.FindActiveID(ctx)
	if err != nil {
		return DetailDTO{}, err
	}
	return toDetailDTO(persona, assets, idsEqual(activeID, id))
}

// Save 全量保存头像与语言版本，并在同一事务内维护素材引用计数。
func (s *Service) Save(ctx context.Context, input SaveInput) (DetailDTO, error) {
	personaID, err := shared.ParseID(input.PersonaID)
	if err != nil {
		return DetailDTO{}, err
	}
	document, err := parseDocument(input)
	if err != nil {
		return DetailDTO{}, err
	}

	var saved *domainpersona.Persona
	var savedAssets []Asset
	var active bool
	err = s.uow.Do(ctx, func(tx Transaction) error {
		persona, findErr := tx.Personas().FindByIDForUpdate(ctx, personaID)
		if findErr != nil {
			return findErr
		}
		activeID, activeErr := tx.Personas().FindActiveID(ctx)
		if activeErr != nil {
			return activeErr
		}
		active = idsEqual(activeID, personaID)
		before := persona.FileReferenceCounts()
		if replaceErr := persona.ReplaceDocument(input.ExpectedVersion, document, active); replaceErr != nil {
			return replaceErr
		}
		after := persona.FileReferenceCounts()
		allIDs := unionCountIDs(before, after)
		assets, assetErr := tx.Assets().FindByIDsForUpdate(ctx, allIDs)
		if assetErr != nil {
			return assetErr
		}
		if validateErr := validateAssets(idsFromCounts(after), assets); validateErr != nil {
			return validateErr
		}
		if updateErr := applyReferenceCountDiff(ctx, tx.Assets(), before, after); updateErr != nil {
			return updateErr
		}
		if saveErr := tx.Personas().Save(ctx, persona, input.ExpectedVersion); saveErr != nil {
			return saveErr
		}
		saved, savedAssets = persona, assets
		return nil
	})
	if err != nil {
		return DetailDTO{}, err
	}
	return toDetailDTO(saved, savedAssets, active)
}

// Activate 把默认语言完整的档案设为站点当前人设。
func (s *Service) Activate(ctx context.Context, input VersionInput) (DetailDTO, error) {
	personaID, err := shared.ParseID(input.PersonaID)
	if err != nil {
		return DetailDTO{}, err
	}
	var activated *domainpersona.Persona
	var activatedAssets []Asset
	err = s.uow.Do(ctx, func(tx Transaction) error {
		persona, findErr := tx.Personas().FindByIDForUpdate(ctx, personaID)
		if findErr != nil {
			return findErr
		}
		if versionErr := persona.EnsureVersion(input.ExpectedVersion); versionErr != nil {
			return versionErr
		}
		if validationErr := persona.ValidateForActivation(); validationErr != nil {
			return validationErr
		}
		ids := idsFromCounts(persona.FileReferenceCounts())
		assets, assetErr := tx.Assets().FindByIDsForUpdate(ctx, ids)
		if assetErr != nil {
			return assetErr
		}
		if validationErr := validateAssets(ids, assets); validationErr != nil {
			return validationErr
		}
		if activeErr := tx.Personas().SetActive(ctx, personaID, time.Now()); activeErr != nil {
			return activeErr
		}
		activated, activatedAssets = persona, assets
		return nil
	})
	if err != nil {
		return DetailDTO{}, err
	}
	return toDetailDTO(activated, activatedAssets, true)
}

// Delete 删除非当前人设档案并释放全部语言版本的素材引用。
func (s *Service) Delete(ctx context.Context, input VersionInput) error {
	personaID, err := shared.ParseID(input.PersonaID)
	if err != nil {
		return err
	}
	return s.uow.Do(ctx, func(tx Transaction) error {
		persona, findErr := tx.Personas().FindByIDForUpdate(ctx, personaID)
		if findErr != nil {
			return findErr
		}
		if versionErr := persona.EnsureVersion(input.ExpectedVersion); versionErr != nil {
			return versionErr
		}
		activeID, activeErr := tx.Personas().FindActiveID(ctx)
		if activeErr != nil {
			return activeErr
		}
		if idsEqual(activeID, personaID) {
			return domainpersona.ErrActiveDelete
		}
		counts := persona.FileReferenceCounts()
		if _, assetErr := tx.Assets().FindByIDsForUpdate(ctx, idsFromCounts(counts)); assetErr != nil {
			return assetErr
		}
		if deleteErr := tx.Personas().Delete(ctx, personaID, input.ExpectedVersion); deleteErr != nil {
			return deleteErr
		}
		for _, id := range idsFromCounts(counts) {
			if updateErr := tx.Assets().UpdateRefCount(ctx, id, -counts[id]); updateErr != nil {
				return updateErr
			}
		}
		return nil
	})
}

// GetActive 返回按请求语言匹配后的当前人设公开投影。
func (s *Service) GetActive(ctx context.Context, requestedLocale string) (PublicPersonaDTO, error) {
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
	localization, err := persona.ResolveLocalization(requestedLocale)
	if err != nil {
		return PublicPersonaDTO{}, err
	}
	counts := referenceCountsForPublic(persona, localization)
	assets, err := s.assets.FindByIDs(ctx, idsFromCounts(counts))
	if err != nil {
		return PublicPersonaDTO{}, err
	}
	return toPublicDTO(persona, localization, assets)
}

func parseDocument(input SaveInput) (domainpersona.Document, error) {
	avatarID := shared.ID{}
	if value := strings.TrimSpace(input.AvatarFileID); value != "" {
		parsed, err := shared.ParseID(value)
		if err != nil {
			return domainpersona.Document{}, err
		}
		avatarID = parsed
	}
	localizations := make([]domainpersona.LocalizationInput, 0, len(input.Localizations))
	for _, localization := range input.Localizations {
		facts := make([]domainpersona.FactInput, 0, len(localization.Facts))
		for _, fact := range localization.Facts {
			facts = append(facts, domainpersona.FactInput{Label: fact.Label, Value: fact.Value})
		}
		images := make([]domainpersona.ImageInput, 0, len(localization.Images))
		for _, image := range localization.Images {
			id, err := shared.ParseID(image.FileID)
			if err != nil {
				return domainpersona.Document{}, err
			}
			images = append(images, domainpersona.ImageInput{
				FileID: id, Caption: image.Caption, AltTextOverride: image.AltTextOverride,
			})
		}
		contentHTML, err := markdown.ToHTML(localization.ContentMD)
		if err != nil {
			return domainpersona.Document{}, shared.Internal("渲染人设设定正文失败", err)
		}
		localizations = append(localizations, domainpersona.LocalizationInput{
			Locale: localization.Locale, Name: localization.Name, Subtitle: localization.Subtitle,
			Summary: localization.Summary, ContentMD: localization.ContentMD, ContentHTML: contentHTML,
			Facts: facts, Images: images,
		})
	}
	return domainpersona.Document{
		DefaultLocale: input.DefaultLocale,
		AvatarFileID:  avatarID,
		Localizations: localizations,
	}, nil
}

func validateAssets(desiredIDs []shared.ID, assets []Asset) error {
	byID := assetsByID(assets)
	for _, id := range desiredIDs {
		asset, ok := byID[id]
		if !ok {
			return shared.BadRequest("部分人设图片素材不存在")
		}
		if asset.DeletedAt != nil || asset.Status != "ready" {
			return shared.BadRequest("人设图片必须已处理完成且未删除")
		}
		if !strings.HasPrefix(asset.MimeType, "image/") {
			return shared.BadRequest("人设档案只接受图片素材")
		}
	}
	return nil
}

func applyReferenceCountDiff(ctx context.Context, assets AssetStore, before, after map[shared.ID]int) error {
	for _, id := range unionCountIDs(before, after) {
		delta := after[id] - before[id]
		if delta != 0 {
			if err := assets.UpdateRefCount(ctx, id, delta); err != nil {
				return err
			}
		}
	}
	return nil
}

func toDetailDTO(persona *domainpersona.Persona, assets []Asset, active bool) (DetailDTO, error) {
	byID := assetsByID(assets)
	var avatar *AdminAssetDTO
	if avatarID := persona.AvatarFileID(); !avatarID.IsZero() {
		asset, ok := byID[avatarID]
		if !ok {
			return DetailDTO{}, shared.Internal("人设档案缺少头像素材", nil)
		}
		avatar = &AdminAssetDTO{
			FileID: asset.ID.String(), URL: asset.URL, Thumbnail: asset.Thumbnail,
			MimeType: asset.MimeType, Width: asset.Width, Height: asset.Height, AltText: asset.AltText,
		}
	}
	localizations := make([]LocalizationDTO, 0, len(persona.Localizations()))
	for _, localization := range persona.Localizations() {
		images, err := adminImagesToDTO(localization, byID)
		if err != nil {
			return DetailDTO{}, err
		}
		localizations = append(localizations, LocalizationDTO{
			Locale: localization.Locale(), Name: localization.Name(), Subtitle: localization.Subtitle(),
			Summary: localization.Summary(), ContentMD: localization.ContentMD(), ContentHTML: localization.ContentHTML(),
			Facts: factsToDTO(localization), Images: images,
			IsComplete: persona.IsLocalizationComplete(localization.Locale()),
		})
	}
	return DetailDTO{
		ID: persona.ID().String(), CreatedBy: persona.CreatedBy().String(),
		DefaultLocale: persona.DefaultLocale(), Avatar: avatar, Localizations: localizations,
		IsActive: active, IsComplete: persona.ValidateForActivation() == nil, Version: persona.Version(),
		CreatedAt: formatTime(persona.CreatedAt()), UpdatedAt: formatTime(persona.UpdatedAt()),
	}, nil
}

func toPublicDTO(persona *domainpersona.Persona, localization *domainpersona.Localization, assets []Asset) (PublicPersonaDTO, error) {
	byID := assetsByID(assets)
	avatarAsset, ok := byID[persona.AvatarFileID()]
	if !ok {
		return PublicPersonaDTO{}, shared.Internal("当前人设缺少头像素材", nil)
	}
	images := make([]PublicImageDTO, 0, len(localization.Images()))
	for position, image := range localization.Images() {
		asset, exists := byID[image.FileID()]
		if !exists {
			return PublicPersonaDTO{}, shared.Internal("当前人设缺少设定图素材", nil)
		}
		images = append(images, PublicImageDTO{
			URL: asset.URL, Thumbnail: asset.Thumbnail, Width: asset.Width, Height: asset.Height,
			Caption: image.Caption(), AltText: resolveAlt(localization.Name(), position, image.AltTextOverride(), asset.AltText),
		})
	}
	avatarAlt := strings.TrimSpace(avatarAsset.AltText)
	if avatarAlt == "" {
		avatarAlt = localization.Name() + "头像"
	}
	return PublicPersonaDTO{
		Locale: localization.Locale(), DefaultLocale: persona.DefaultLocale(),
		AvailableLocales: persona.AvailableLocales(),
		Avatar: PublicAssetDTO{
			URL: avatarAsset.URL, Thumbnail: avatarAsset.Thumbnail,
			Width: avatarAsset.Width, Height: avatarAsset.Height, AltText: avatarAlt,
		},
		Name: localization.Name(), Subtitle: localization.Subtitle(), Summary: localization.Summary(),
		ContentHTML: localization.ContentHTML(), Facts: factsToDTO(localization), Images: images,
	}, nil
}

func adminImagesToDTO(localization *domainpersona.Localization, byID map[shared.ID]Asset) ([]AdminImageDTO, error) {
	images := make([]AdminImageDTO, 0, len(localization.Images()))
	for position, image := range localization.Images() {
		asset, ok := byID[image.FileID()]
		if !ok {
			return nil, shared.Internal("人设档案缺少设定图素材", nil)
		}
		images = append(images, AdminImageDTO{
			FileID: image.FileID().String(), URL: asset.URL, Thumbnail: asset.Thumbnail,
			MimeType: asset.MimeType, Width: asset.Width, Height: asset.Height,
			Caption: image.Caption(), AltText: resolveAlt(localization.Name(), position, image.AltTextOverride(), asset.AltText),
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

func referenceCountsForPublic(persona *domainpersona.Persona, localization *domainpersona.Localization) map[shared.ID]int {
	counts := make(map[shared.ID]int, len(localization.Images())+1)
	counts[persona.AvatarFileID()] = 1
	for _, image := range localization.Images() {
		counts[image.FileID()]++
	}
	return counts
}

func idsFromCounts(counts map[shared.ID]int) []shared.ID {
	ids := make([]shared.ID, 0, len(counts))
	for id, count := range counts {
		if count > 0 && !id.IsZero() {
			ids = append(ids, id)
		}
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i].String() < ids[j].String() })
	return ids
}

func unionCountIDs(left, right map[shared.ID]int) []shared.ID {
	counts := make(map[shared.ID]int, len(left)+len(right))
	for id, count := range left {
		counts[id] += count
	}
	for id, count := range right {
		counts[id] += count
	}
	return idsFromCounts(counts)
}

func idsEqual(activeID *shared.ID, id shared.ID) bool {
	return activeID != nil && activeID.Equal(id)
}
