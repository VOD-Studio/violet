package gallery

import (
	"context"
	"sort"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	domaingallery "blog-api/internal/domain/gallery"
	"blog-api/internal/domain/permission"
	"blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
	"blog-api/internal/middleware"
)

// Service 编排图集工作稿的创建、读取与完整保存。
type Service struct {
	repo   domaingallery.Repository
	assets AssetStore
	uow    UnitOfWork
	bus    appshared.EventBus
	// perm 供「作者或 gallery:moderate」维护判定的权限码分支（与 tweet.PermDeleteAny 同构）。
	perm  PermissionChecker
	users UserDirectory
}

func NewService(
	repo domaingallery.Repository,
	assets AssetStore,
	uow UnitOfWork,
	bus appshared.EventBus,
	perm PermissionChecker,
	users UserDirectory,
) *Service {
	return &Service{repo: repo, assets: assets, uow: uow, bus: bus, perm: perm, users: users}
}

// canMaintain 判断操作者可否对该图集执行撤回或删除。
//
// 放行规则（任一满足）：
//   - 内置超管（通配短路）
//   - 操作者是图集作者且持有 gallery:manage（作者对自己的作品负责）
//   - 操作者拥有 gallery:moderate 权限码（审核员处置他人作品）
func (s *Service) canMaintain(ctx context.Context, gallery *domaingallery.Gallery) bool {
	isRoot := middleware.GetUserIsRoot(ctx)
	if isRoot {
		return true
	}
	role := middleware.GetUserRole(ctx)
	if s.perm != nil && s.perm.HasPermission(role, isRoot, permission.GalleryModerate.String()) {
		return true
	}
	if opID := middleware.GetUserID(ctx); opID == "" || opID != gallery.AuthorID().String() {
		return false
	}
	return s.perm != nil && s.perm.HasPermission(role, isRoot, permission.GalleryManage.String())
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

// ListForEditor 按作者与状态筛选分页读取管理列表；入口权限由路由层 gallery:view 把守。
func (s *Service) ListForEditor(ctx context.Context, query ListQuery) ([]GallerySummaryDTO, int64, error) {
	filter := domaingallery.ListFilter{Status: strings.TrimSpace(query.Status)}
	if filter.Status != "" && !validStatus(filter.Status) {
		return nil, 0, shared.BadRequest("非法的图集状态筛选")
	}
	if username := strings.TrimSpace(query.Author); username != "" {
		authorID, found, err := s.users.FindIDByUsername(ctx, username)
		if err != nil {
			return nil, 0, err
		}
		if !found {
			return []GallerySummaryDTO{}, 0, nil
		}
		filter.AuthorID = &authorID
	}
	q := shared.PageQuery{Page: query.Page, Limit: query.Limit}.Normalize()
	result, err := s.repo.FindPage(ctx, filter, q)
	if err != nil {
		return nil, 0, err
	}
	names, err := s.users.DisplayNamesByIDs(ctx, authorIDs(result.Items))
	if err != nil {
		return nil, 0, err
	}
	dtos := make([]GallerySummaryDTO, 0, len(result.Items))
	for _, gallery := range result.Items {
		dto := toSummaryDTO(gallery)
		dto.AuthorName = names[gallery.AuthorID()]
		dtos = append(dtos, dto)
	}
	return dtos, result.Total, nil
}

// GetForEditor 读取工作稿详情；入口权限由路由层 gallery:view 把守，作者信息随详情返回。
func (s *Service) GetForEditor(ctx context.Context, galleryID string) (GalleryDetailDTO, error) {
	id, err := shared.ParseID(galleryID)
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	gallery, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	assets, err := s.assets.FindByIDs(ctx, fileIDs(gallery.WorkingRevision().Items()))
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	names, err := s.users.DisplayNamesByIDs(ctx, []shared.ID{gallery.AuthorID()})
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	dto, err := toDetailDTO(gallery, assets)
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	dto.AuthorName = names[gallery.AuthorID()]
	return dto, nil
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

// Publish 把当前工作稿设为公开版本，并清理被替换的旧公开快照。
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
		if err := gallery.EnsureVersion(in.ExpectedVersion); err != nil {
			return err
		}
		workingIDs := fileIDs(gallery.WorkingRevision().Items())
		obsoleteRevisionID, oldPublishedIDs := obsoletePublishedRevision(gallery)
		slug := "gallery-" + gallery.ID().String()
		if err := gallery.Publish(in.ExpectedVersion, slug, time.Now().UTC()); err != nil {
			return err
		}
		assets, err = tx.Assets().FindByIDsForUpdate(ctx, sortedIDUnion(workingIDs, oldPublishedIDs))
		if err != nil {
			return err
		}
		if err := validateAssets(authorID, workingIDs, assets); err != nil {
			return err
		}
		if obsoleteRevisionID != nil {
			for _, fileID := range oldPublishedIDs {
				if err := tx.Assets().UpdateRefCount(ctx, fileID, -1); err != nil {
					return err
				}
			}
		}
		if err := tx.Galleries().SavePublishingState(ctx, gallery, obsoleteRevisionID, in.ExpectedVersion); err != nil {
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

// Unpublish 撤回当前公开版本，并保留工作稿、slug 与首次发布时间。
func (s *Service) Unpublish(ctx context.Context, in VersionInput) (GalleryDetailDTO, error) {
	galleryID, err := shared.ParseID(in.GalleryID)
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	var unpublished *domaingallery.Gallery
	var assets []Asset
	err = s.uow.Do(ctx, func(tx Transaction) error {
		gallery, err := tx.Galleries().FindByIDForUpdate(ctx, galleryID)
		if err != nil {
			return err
		}
		if !s.canMaintain(ctx, gallery) {
			return domaingallery.ErrCannotMaintain
		}
		if err := gallery.EnsureVersion(in.ExpectedVersion); err != nil {
			return err
		}
		obsoleteRevisionID, obsoleteIDs := obsoletePublishedRevision(gallery)
		if err := gallery.Unpublish(in.ExpectedVersion, time.Now().UTC()); err != nil {
			return err
		}
		workingIDs := fileIDs(gallery.WorkingRevision().Items())
		assets, err = tx.Assets().FindByIDsForUpdate(ctx, sortedIDUnion(workingIDs, obsoleteIDs))
		if err != nil {
			return err
		}
		for _, fileID := range obsoleteIDs {
			if err := tx.Assets().UpdateRefCount(ctx, fileID, -1); err != nil {
				return err
			}
		}
		if err := tx.Galleries().SavePublishingState(ctx, gallery, obsoleteRevisionID, in.ExpectedVersion); err != nil {
			return err
		}
		unpublished = gallery
		return nil
	})
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	if err := s.bus.Publish(ctx, unpublished.PullEvents()); err != nil {
		log.Error().Err(err).Str("gallery_id", unpublished.ID().String()).Msg("发布图集撤回事件失败")
	}
	return toDetailDTO(unpublished, assets)
}

// Delete 永久删除图集及其有效快照，并释放全部素材引用。
func (s *Service) Delete(ctx context.Context, in VersionInput) error {
	galleryID, err := shared.ParseID(in.GalleryID)
	if err != nil {
		return err
	}
	var deleted *domaingallery.Gallery
	err = s.uow.Do(ctx, func(tx Transaction) error {
		gallery, err := tx.Galleries().FindByIDForUpdate(ctx, galleryID)
		if err != nil {
			return err
		}
		if !s.canMaintain(ctx, gallery) {
			return domaingallery.ErrCannotMaintain
		}
		if err := gallery.EnsureVersion(in.ExpectedVersion); err != nil {
			return err
		}
		counts := gallery.FileReferenceCounts()
		ids := make([]shared.ID, 0, len(counts))
		for id := range counts {
			ids = append(ids, id)
		}
		if _, err := tx.Assets().FindByIDsForUpdate(ctx, sortedIDUnion(ids)); err != nil {
			return err
		}
		for id, count := range counts {
			if err := tx.Assets().UpdateRefCount(ctx, id, -count); err != nil {
				return err
			}
		}
		if err := tx.Galleries().Delete(ctx, gallery.ID(), in.ExpectedVersion); err != nil {
			return err
		}
		deleted = gallery
		return nil
	})
	if err != nil {
		return err
	}
	// 聚合已删除,事件不再挂在聚合上,按删除成功时的快照手动构造发布。
	if err := s.bus.Publish(ctx, []shared.DomainEvent{
		domaingallery.NewGalleryDeleted(deleted.ID(), deleted.AuthorID(), deleted.WorkingRevision().Title()),
	}); err != nil {
		log.Error().Err(err).Str("gallery_id", deleted.ID().String()).Msg("发布图集删除事件失败")
	}
	return nil
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

func validStatus(status string) bool {
	switch status {
	case domaingallery.StatusDraft, domaingallery.StatusPublished,
		domaingallery.StatusModified, domaingallery.StatusUnpublished:
		return true
	default:
		return false
	}
}

func authorIDs(galleries []*domaingallery.Gallery) []shared.ID {
	seen := make(map[shared.ID]struct{}, len(galleries))
	ids := make([]shared.ID, 0, len(galleries))
	for _, gallery := range galleries {
		if _, ok := seen[gallery.AuthorID()]; ok {
			continue
		}
		seen[gallery.AuthorID()] = struct{}{}
		ids = append(ids, gallery.AuthorID())
	}
	return ids
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

func obsoletePublishedRevision(gallery *domaingallery.Gallery) (*shared.ID, []shared.ID) {
	published := gallery.PublishedRevision()
	if published == nil || published.ID().Equal(gallery.WorkingRevision().ID()) {
		return nil, nil
	}
	id := published.ID()
	return &id, fileIDs(published.Items())
}
