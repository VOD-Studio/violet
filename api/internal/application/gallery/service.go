package gallery

import (
	"context"
	"sort"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	domaingallery "blog-api/internal/domain/gallery"
	"blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
)

// Service 编排图集工作稿的创建、读取与完整保存。
type Service struct {
	repo   domaingallery.Repository
	assets AssetStore
	uow    UnitOfWork
	bus    appshared.EventBus
}

func NewService(repo domaingallery.Repository, assets AssetStore, uow UnitOfWork, bus appshared.EventBus) *Service {
	return &Service{repo: repo, assets: assets, uow: uow, bus: bus}
}

func (s *Service) CreateDraft(ctx context.Context, userID string) (GalleryDetailDTO, error) {
	authorID, err := shared.ParseID(userID)
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	gallery, err := domaingallery.NewGallery(shared.NewID(), authorID, shared.NewID())
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	if err := s.uow.Do(ctx, func(tx Transaction) error {
		return tx.Galleries().Create(ctx, gallery)
	}); err != nil {
		return GalleryDetailDTO{}, err
	}
	if err := s.bus.Publish(ctx, gallery.PullEvents()); err != nil {
		log.Error().Err(err).Str("gallery_id", gallery.ID().String()).Msg("发布图集创建事件失败")
	}
	return toDetailDTO(gallery, nil)
}

// ListForEditor 分页读取当前作者自己的图集工作稿。
func (s *Service) ListForEditor(ctx context.Context, userID string, page, limit int) ([]GallerySummaryDTO, int64, error) {
	authorID, err := shared.ParseID(userID)
	if err != nil {
		return nil, 0, err
	}
	q := shared.PageQuery{Page: page, Limit: limit}.Normalize()
	result, err := s.repo.FindPageByAuthor(ctx, authorID, q)
	if err != nil {
		return nil, 0, err
	}
	dtos := make([]GallerySummaryDTO, 0, len(result.Items))
	for _, gallery := range result.Items {
		dtos = append(dtos, toSummaryDTO(gallery))
	}
	return dtos, result.Total, nil
}

// GetForEditor 读取当前作者自己的工作稿详情。
func (s *Service) GetForEditor(ctx context.Context, userID, galleryID string) (GalleryDetailDTO, error) {
	authorID, id, err := parseActorAndGallery(userID, galleryID)
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	gallery, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	if !gallery.AuthorID().Equal(authorID) {
		return GalleryDetailDTO{}, domaingallery.ErrNotOwner
	}
	assets, err := s.assets.FindByIDs(ctx, fileIDs(gallery.WorkingRevision().Items()))
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	return toDetailDTO(gallery, assets)
}

// Save 完整替换工作稿，并在同一事务内更新素材引用计数。
func (s *Service) Save(ctx context.Context, in SaveInput) (GalleryDetailDTO, error) {
	authorID, galleryID, err := parseActorAndGallery(in.UserID, in.GalleryID)
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	document, ids, err := parseDocumentItems(in.Items)
	if err != nil {
		return GalleryDetailDTO{}, err
	}

	var saved *domaingallery.Gallery
	var savedAssets []Asset
	err = s.uow.Do(ctx, func(tx Transaction) error {
		gallery, err := tx.Galleries().FindByIDForUpdate(ctx, galleryID)
		if err != nil {
			return err
		}
		if !gallery.AuthorID().Equal(authorID) {
			return domaingallery.ErrNotOwner
		}
		oldIDs := fileIDs(gallery.WorkingRevision().Items())
		if err := gallery.EnsureVersion(in.ExpectedVersion); err != nil {
			return err
		}
		copyOnWrite := gallery.WorkingRevisionIsPublished()
		if copyOnWrite {
			if err := gallery.CloneWorkingRevision(shared.NewID()); err != nil {
				return err
			}
		}
		if err := gallery.ReplaceWorkingDocument(in.ExpectedVersion, in.Title, in.Summary, document); err != nil {
			return err
		}
		assets, err := tx.Assets().FindByIDsForUpdate(ctx, sortedIDUnion(oldIDs, ids))
		if err != nil {
			return err
		}
		if err := validateAssets(authorID, ids, assets); err != nil {
			return err
		}
		added, removed := diffIDs(oldIDs, ids)
		if copyOnWrite {
			added, removed = ids, nil
		}
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
		if err := tx.Galleries().SaveWorking(ctx, gallery, in.ExpectedVersion); err != nil {
			return err
		}
		saved, savedAssets = gallery, assets
		return nil
	})
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	return toDetailDTO(saved, savedAssets)
}

// Publish 首次把当前工作稿设为公开版本。
func (s *Service) Publish(ctx context.Context, in PublishInput) (GalleryDetailDTO, error) {
	authorID, galleryID, err := parseActorAndGallery(in.UserID, in.GalleryID)
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	var published *domaingallery.Gallery
	var assets []Asset
	err = s.uow.Do(ctx, func(tx Transaction) error {
		gallery, err := tx.Galleries().FindByIDForUpdate(ctx, galleryID)
		if err != nil {
			return err
		}
		if !gallery.AuthorID().Equal(authorID) {
			return domaingallery.ErrNotOwner
		}
		ids := fileIDs(gallery.WorkingRevision().Items())
		slug := "gallery-" + gallery.ID().String()
		if err := gallery.Publish(in.ExpectedVersion, slug, time.Now().UTC()); err != nil {
			return err
		}
		assets, err = tx.Assets().FindByIDsForUpdate(ctx, sortedIDUnion(ids))
		if err != nil {
			return err
		}
		if err := validateAssets(authorID, ids, assets); err != nil {
			return err
		}
		if err := tx.Galleries().SavePublished(ctx, gallery, in.ExpectedVersion); err != nil {
			return err
		}
		published = gallery
		return nil
	})
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	if err := s.bus.Publish(ctx, published.PullEvents()); err != nil {
		log.Error().Err(err).Str("gallery_id", published.ID().String()).Msg("发布图集公开事件失败")
	}
	return toDetailDTO(published, assets)
}

// BrowsePublished 按稳定复合游标读取公开图集。
func (s *Service) BrowsePublished(ctx context.Context, encodedCursor string, limit int) ([]PublicGalleryDTO, string, error) {
	cursor, err := decodePublishedCursor(encodedCursor)
	if err != nil {
		return nil, "", err
	}
	limit = normalizePublicLimit(limit)
	rows, err := s.repo.FindPublishedPage(ctx, cursor, limit+1)
	if err != nil {
		return nil, "", err
	}
	hasMore := len(rows) > limit
	if hasMore {
		rows = rows[:limit]
	}
	ids := make([]shared.ID, 0)
	for _, row := range rows {
		ids = append(ids, fileIDs(row.Revision.Items())...)
	}
	assets, err := s.assets.FindByIDs(ctx, sortedIDUnion(ids))
	if err != nil {
		return nil, "", err
	}
	items := make([]PublicGalleryDTO, 0, len(rows))
	for _, row := range rows {
		dto, err := toPublicDTO(row, assets)
		if err != nil {
			return nil, "", err
		}
		items = append(items, dto)
	}
	next := ""
	if hasMore && len(rows) > 0 {
		next = encodePublishedCursor(domaingallery.PublishedCursor{PublishedAt: rows[len(rows)-1].PublishedAt, ID: rows[len(rows)-1].ID})
	}
	return items, next, nil
}

// GetPublished 只读取 slug 当前指向的公开快照。
func (s *Service) GetPublished(ctx context.Context, slug string) (PublicGalleryDTO, error) {
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return PublicGalleryDTO{}, domaingallery.ErrNotFound
	}
	gallery, err := s.repo.FindPublishedBySlug(ctx, slug)
	if err != nil {
		return PublicGalleryDTO{}, err
	}
	assets, err := s.assets.FindByIDs(ctx, fileIDs(gallery.Revision.Items()))
	if err != nil {
		return PublicGalleryDTO{}, err
	}
	return toPublicDTO(gallery, assets)
}

func normalizePublicLimit(limit int) int {
	if limit < 1 {
		return 20
	}
	if limit > 50 {
		return 50
	}
	return limit
}

func parseActorAndGallery(userID, galleryID string) (shared.ID, shared.ID, error) {
	authorID, err := shared.ParseID(userID)
	if err != nil {
		return shared.ID{}, shared.ID{}, err
	}
	id, err := shared.ParseID(galleryID)
	if err != nil {
		return shared.ID{}, shared.ID{}, err
	}
	return authorID, id, nil
}

func parseDocumentItems(input []SaveItemInput) ([]domaingallery.DocumentItem, []shared.ID, error) {
	document := make([]domaingallery.DocumentItem, 0, len(input))
	ids := make([]shared.ID, 0, len(input))
	for _, item := range input {
		id, err := shared.ParseID(item.FileID)
		if err != nil {
			return nil, nil, err
		}
		document = append(document, domaingallery.DocumentItem{FileID: id, Caption: item.Caption, AltTextOverride: item.AltTextOverride})
		ids = append(ids, id)
	}
	return document, ids, nil
}

func validateAssets(authorID shared.ID, requested []shared.ID, assets []Asset) error {
	byID := make(map[shared.ID]Asset, len(assets))
	for _, asset := range assets {
		byID[asset.ID] = asset
	}
	for _, id := range requested {
		asset, ok := byID[id]
		if !ok {
			return shared.BadRequest("图集包含不存在的素材")
		}
		if !asset.OwnerID.Equal(authorID) {
			return shared.BadRequest("图集只能引用作者自己的素材")
		}
		if asset.Status != domainupload.StatusReady || asset.DeletedAt != nil {
			return shared.BadRequest("图集只能引用已就绪且未删除的素材")
		}
		if !strings.HasPrefix(strings.ToLower(asset.MimeType), "image/") {
			return shared.BadRequest("图集只支持图片素材")
		}
	}
	return nil
}

func fileIDs(items []*domaingallery.RevisionItem) []shared.ID {
	ids := make([]shared.ID, 0, len(items))
	for _, item := range items {
		ids = append(ids, item.FileID())
	}
	return ids
}

func diffIDs(oldIDs, newIDs []shared.ID) (added, removed []shared.ID) {
	oldSet := make(map[shared.ID]struct{}, len(oldIDs))
	newSet := make(map[shared.ID]struct{}, len(newIDs))
	for _, id := range oldIDs {
		oldSet[id] = struct{}{}
	}
	for _, id := range newIDs {
		newSet[id] = struct{}{}
		if _, exists := oldSet[id]; !exists {
			added = append(added, id)
		}
	}
	for _, id := range oldIDs {
		if _, exists := newSet[id]; !exists {
			removed = append(removed, id)
		}
	}
	return added, removed
}

func sortedIDUnion(groups ...[]shared.ID) []shared.ID {
	seen := make(map[shared.ID]struct{})
	for _, ids := range groups {
		for _, id := range ids {
			seen[id] = struct{}{}
		}
	}
	result := make([]shared.ID, 0, len(seen))
	for id := range seen {
		result = append(result, id)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].String() < result[j].String()
	})
	return result
}
