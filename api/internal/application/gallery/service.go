// Package gallery 提供图集用例服务（application 层）。
//
// 承载图集的建/编/删/读与治理：即发即出（Create 无审核状态机）、可编辑
// （Update 改字段 + SetItems 全量替换）、双轨删除（作者物理删 / 管理员软删下架）。
// 删除鉴权（作者本人或 gallery:delete-any）在应用层做（与 tweet.canDelete 同构：
// 所有权 OR 权限码的双重判定无法由路由中间件单一表达）。
//
// 依赖方向：Service → domain 端口（GalleryRepository），媒体归属/类型校验与
// 引用计数维护通过 GalleryMediaChecker 端口反转依赖 upload 域。
package gallery

import (
	"context"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	domaingallery "blog-api/internal/domain/gallery"
	"blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
	domainuser "blog-api/internal/domain/user"
	"blog-api/internal/middleware"
)

// PermDeleteAny 治理任意图集的权限码（migration 112 seed）
const PermDeleteAny = "gallery:delete-any"

// Service 图集用例服务。
type Service struct {
	repo     domaingallery.GalleryRepository
	media    GalleryMediaChecker
	userRepo domainuser.UserRepository
	perm     GalleryPermissionChecker
	bus      appshared.EventBus
}

// NewService 构造服务。
// perm 为 nil 时仅作者本人可删（无权限码放行路径，仅限测试场景）。
// bus 发布 gallery.* 事件（审计订阅者消费）。
func NewService(
	repo domaingallery.GalleryRepository,
	media GalleryMediaChecker,
	userRepo domainuser.UserRepository,
	perm GalleryPermissionChecker,
	bus appshared.EventBus,
) *Service {
	return &Service{repo: repo, media: media, userRepo: userRepo, perm: perm, bus: bus}
}

// ============================================================
// 写用例
// ============================================================

// Create 建图集（即发即出，登录 + 发布限流由路由层承担）。
//
// 编排：聚合校验 → 媒体归属/类型校验 → 引用计数 +1（部分失败回滚）→ Save
// （失败全量解绑）→ 发布事件。
func (s *Service) Create(ctx context.Context, in CreateInput) (GalleryDetailDTO, error) {
	ownerID, err := shared.ParseID(in.OwnerID)
	if err != nil {
		return GalleryDetailDTO{}, shared.BadRequest("非法的用户 ID")
	}
	items, err := parseItems(in.Items)
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	coverID, err := parseOptionalID(in.CoverFileID)
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	g, err := domaingallery.NewGallery(shared.NewID(), ownerID, in.Title, in.Description, coverID, items)
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	if err := s.checkCoverInItems(g); err != nil {
		return GalleryDetailDTO{}, err
	}
	fileIDs := itemFileIDs(g.Items())
	if err := s.media.CheckFilesUsable(ctx, fileIDs, ownerID); err != nil {
		return GalleryDetailDTO{}, err
	}
	if err := s.attachRefs(ctx, fileIDs); err != nil {
		return GalleryDetailDTO{}, err
	}
	if err := s.repo.Save(ctx, g); err != nil {
		s.detachRefs(ctx, fileIDs)
		return GalleryDetailDTO{}, err
	}
	s.publishEvents(ctx, g.PullEvents())
	return s.buildDetail(ctx, g)
}

// Update 编辑图集（owner；removed 态由聚合拒绝）。
//
// items 全量替换时按 diff 维护引用计数：新增 +1、移除 -1。
func (s *Service) Update(ctx context.Context, id string, in UpdateInput) (GalleryDetailDTO, error) {
	g, err := s.loadOwned(ctx, id)
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	oldFileIDs := itemFileIDs(g.Items())

	var newItems []domaingallery.GalleryItem
	itemsChanged := in.Items != nil
	if itemsChanged {
		newItems, err = parseItems(in.Items)
		if err != nil {
			return GalleryDetailDTO{}, err
		}
	}
	coverID, err := parseOptionalID(in.CoverFileID)
	if err != nil {
		return GalleryDetailDTO{}, err
	}

	// 媒体校验：全量校验最终项（挂过的文件可能已被软删，复查最稳）
	finalItems := g.Items()
	if itemsChanged {
		finalItems = newItems
	}
	finalFileIDs := itemFileIDs(finalItems)
	if err := s.media.CheckFilesUsable(ctx, finalFileIDs, g.OwnerID()); err != nil {
		return GalleryDetailDTO{}, err
	}

	// 引用计数 diff：先挂新增（失败回滚），保存成功后解绑移除
	added, removed := diffFileIDs(oldFileIDs, finalFileIDs)
	if itemsChanged {
		if err := s.attachRefs(ctx, added); err != nil {
			return GalleryDetailDTO{}, err
		}
	}

	if itemsChanged {
		if err := g.SetItems(newItems); err != nil {
			s.detachRefs(ctx, added)
			return GalleryDetailDTO{}, err
		}
	}
	if err := g.Update(domaingallery.UpdateParams{
		Title:       in.Title,
		Description: in.Description,
		CoverFileID: coverID,
		ClearCover:  in.ClearCover,
	}); err != nil {
		s.detachRefs(ctx, added)
		return GalleryDetailDTO{}, err
	}
	if err := s.checkCoverInItems(g); err != nil {
		s.detachRefs(ctx, added)
		return GalleryDetailDTO{}, err
	}
	if err := s.repo.Save(ctx, g); err != nil {
		s.detachRefs(ctx, added)
		return GalleryDetailDTO{}, err
	}
	if itemsChanged {
		s.detachRefs(ctx, removed)
	}
	s.publishEvents(ctx, g.PullEvents())
	return s.buildDetail(ctx, g)
}

// Delete 删除图集（物理删除；作者本人或 gallery:delete-any）。
//
// gallery_items 行由 FK 级联清理；媒体文件本身不删，仅解绑引用计数。
func (s *Service) Delete(ctx context.Context, id string) error {
	g, err := s.findByID(ctx, id)
	if err != nil {
		return err
	}
	if !s.canDelete(ctx, g) {
		return shared.Forbidden("无权删除他人图集")
	}
	if err := s.repo.Delete(ctx, g.ID()); err != nil {
		return err
	}
	s.detachRefs(ctx, itemFileIDs(g.Items()))
	// 物理删除后聚合根不复存在，删除事件由应用层手动构造发布
	s.publishEvents(ctx, []shared.DomainEvent{domaingallery.NewGalleryDeleted(g)})
	return nil
}

// SetStatus 治理状态切换（removed ↔ published）。
//
// 权限码 gallery:delete-any 由路由层 RequirePermission 承担（治理端点无所有权放行）。
func (s *Service) SetStatus(ctx context.Context, id, status string) error {
	g, err := s.findByID(ctx, id)
	if err != nil {
		return err
	}
	switch status {
	case domaingallery.StatusRemoved:
		err = g.Remove()
	case domaingallery.StatusPublished:
		err = g.Restore()
	default:
		return shared.BadRequest("非法的状态：仅支持 published / removed")
	}
	if err != nil {
		return err
	}
	if err := s.repo.Save(ctx, g); err != nil {
		return err
	}
	s.publishEvents(ctx, g.PullEvents())
	return nil
}

// ============================================================
// 读用例
// ============================================================

// ListPublished 全站浏览流（公开，仅 published）。
func (s *Service) ListPublished(ctx context.Context, q shared.PageQuery) ([]GalleryDTO, int64, error) {
	page, err := s.repo.FindPublishedPage(ctx, q.Normalize())
	if err != nil {
		return nil, 0, err
	}
	dtos, err := s.toDTOs(ctx, page.Items)
	if err != nil {
		return nil, 0, err
	}
	return dtos, page.Total, nil
}

// GetPublic 公开详情（removed → 404，不暴露治理痕迹）。
func (s *Service) GetPublic(ctx context.Context, id string) (GalleryDetailDTO, error) {
	g, err := s.findByID(ctx, id)
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	if !g.IsPublished() {
		return GalleryDetailDTO{}, domaingallery.ErrGalleryNotFound
	}
	return s.buildDetail(ctx, g)
}

// ListByUsername 用户主页图集列表（公开，仅 published）。
// 用户名不存在返回 404（用户主页对不存在用户应 404 而非空列表）。
func (s *Service) ListByUsername(ctx context.Context, username string, q shared.PageQuery) ([]GalleryDTO, int64, error) {
	uname, err := domainuser.ParseUsername(username)
	if err != nil {
		return nil, 0, shared.BadRequest("非法的用户名")
	}
	u, err := s.userRepo.FindByUsername(ctx, uname)
	if err != nil {
		return nil, 0, err
	}
	page, err := s.repo.FindPageByOwner(ctx, u.GetID(), q.Normalize())
	if err != nil {
		return nil, 0, err
	}
	dtos, err := s.toDTOs(ctx, page.Items)
	if err != nil {
		return nil, 0, err
	}
	return dtos, page.Total, nil
}

// ListAdmin 管理列表（全部状态，gallery:view 由路由层承担）。
func (s *Service) ListAdmin(ctx context.Context, q shared.PageQuery) ([]GalleryDTO, int64, error) {
	page, err := s.repo.FindAdminPage(ctx, q.Normalize())
	if err != nil {
		return nil, 0, err
	}
	dtos, err := s.toDTOs(ctx, page.Items)
	if err != nil {
		return nil, 0, err
	}
	return dtos, page.Total, nil
}

// ============================================================
// 内部辅助
// ============================================================

// findByID 解析 ID + 走 repo。
func (s *Service) findByID(ctx context.Context, id string) (*domaingallery.Gallery, error) {
	gid, err := shared.ParseID(id)
	if err != nil {
		return nil, err
	}
	return s.repo.FindByID(ctx, gid)
}

// loadOwned 加载并校验 owner（非 owner → 403）。
func (s *Service) loadOwned(ctx context.Context, id string) (*domaingallery.Gallery, error) {
	g, err := s.findByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if opID := middleware.GetUserID(ctx); opID == "" || opID != g.OwnerID().String() {
		return nil, shared.Forbidden("仅作者本人可编辑图集")
	}
	return g, nil
}

// canDelete 判断操作者是否有权删除指定图集。
//
// 放行规则（任一满足，与 tweet.canDelete 同构）：
//   - 内置超管（通配短路）
//   - 操作者是图集作者（所有权放行）
//   - 操作者拥有 gallery:delete-any 权限码
func (s *Service) canDelete(ctx context.Context, g *domaingallery.Gallery) bool {
	isBuiltin := middleware.GetUserIsRoot(ctx)
	if isBuiltin {
		return true
	}
	if opID := middleware.GetUserID(ctx); opID != "" && opID == g.OwnerID().String() {
		return true
	}
	if s.perm == nil {
		return false
	}
	return s.perm.HasPermission(middleware.GetUserRole(ctx), isBuiltin, PermDeleteAny)
}

// checkCoverInItems 校验封面引用来自图集媒体项：
// 封面复用项的引用计数（不单独 +1），所以必须在项集合内。
func (s *Service) checkCoverInItems(g *domaingallery.Gallery) error {
	coverID := g.CoverFileID()
	if coverID == nil {
		return nil
	}
	for _, it := range g.Items() {
		if it.FileID() == *coverID {
			return nil
		}
	}
	return ErrCoverNotInItems
}

// attachRefs 批量引用计数 +1；中途失败回滚已挂接的部分。
func (s *Service) attachRefs(ctx context.Context, fileIDs []shared.ID) error {
	for i, id := range fileIDs {
		if err := s.media.UpdateRefCount(ctx, id, 1); err != nil {
			for _, prev := range fileIDs[:i] {
				_ = s.media.UpdateRefCount(ctx, prev, -1)
			}
			return err
		}
	}
	return nil
}

// detachRefs 批量引用计数 -1（尽力而为：单个失败不阻断，记告警）。
func (s *Service) detachRefs(ctx context.Context, fileIDs []shared.ID) {
	for _, id := range fileIDs {
		if err := s.media.UpdateRefCount(ctx, id, -1); err != nil {
			log.Warn().Err(err).Str("file_id", id.String()).Msg("图集解绑引用计数失败")
		}
	}
}

// publishEvents 发布聚合/手动构造的领域事件（失败仅告警，不阻断用例）。
func (s *Service) publishEvents(ctx context.Context, events []shared.DomainEvent) {
	if len(events) == 0 {
		return
	}
	if err := s.bus.Publish(ctx, events); err != nil {
		log.Warn().Err(err).Int("count", len(events)).Msg("发布图集领域事件失败")
	}
}

// ============================================================
// DTO 组装
// ============================================================

// buildDetail 组装详情（解析全部媒体项元数据 + 作者资料）。
func (s *Service) buildDetail(ctx context.Context, g *domaingallery.Gallery) (GalleryDetailDTO, error) {
	dtos, err := s.toDTOs(ctx, []*domaingallery.Gallery{g})
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	files, err := s.media.FindByIDs(ctx, itemFileIDs(g.Items()))
	if err != nil {
		return GalleryDetailDTO{}, err
	}
	items := make([]GalleryItemDTO, 0, len(g.Items()))
	for _, it := range g.Items() {
		items = append(items, toItemDTO(it, files[it.FileID()]))
	}
	return GalleryDetailDTO{GalleryDTO: dtos[0], Items: items}, nil
}

// toDTOs 批量组装列表卡片（作者与封面各一次批量查询，不随条数放大）。
func (s *Service) toDTOs(ctx context.Context, galleries []*domaingallery.Gallery) ([]GalleryDTO, error) {
	ownerIDs := make([]shared.ID, 0, len(galleries))
	coverIDs := make([]shared.ID, 0, len(galleries))
	for _, g := range galleries {
		ownerIDs = append(ownerIDs, g.OwnerID())
		coverIDs = append(coverIDs, coverFileIDOf(g))
	}
	users, err := s.userRepo.FindByIDs(ctx, ownerIDs)
	if err != nil {
		return nil, err
	}
	authorByID := make(map[shared.ID]*domainuser.User, len(users))
	for _, u := range users {
		authorByID[u.GetID()] = u
	}
	files, err := s.media.FindByIDs(ctx, coverIDs)
	if err != nil {
		return nil, err
	}

	// 浏览流照片堆叠预览：收集各集前 previewLimit 项文件 ID，一次批量查
	previewLimit := 3
	previewSeen := make(map[shared.ID]struct{}, len(galleries)*previewLimit)
	previewIDs := make([]shared.ID, 0, len(galleries)*previewLimit)
	for _, g := range galleries {
		for i, it := range g.Items() {
			if i >= previewLimit {
				break
			}
			if _, ok := previewSeen[it.FileID()]; ok {
				continue
			}
			previewSeen[it.FileID()] = struct{}{}
			previewIDs = append(previewIDs, it.FileID())
		}
	}
	previewFiles, err := s.media.FindByIDs(ctx, previewIDs)
	if err != nil {
		return nil, err
	}

	dtos := make([]GalleryDTO, 0, len(galleries))
	for _, g := range galleries {
		author := AuthorDTO{}
		if u := authorByID[g.OwnerID()]; u != nil {
			author = AuthorDTO{ID: u.GetID().String(), Username: u.Username().String(), AvatarURL: u.AvatarURL()}
		}
		coverURL := ""
		if f := files[coverFileIDOf(g)]; f != nil {
			// 视频封面给首帧缩略图：源文件 URL 无法当封面渲染（前端 <img> 会破图）
			coverURL = f.Thumbnail()
			if coverURL == "" && !strings.HasPrefix(f.MimeType(), "video/") {
				coverURL = f.URL()
			}
		}
		dtos = append(dtos, GalleryDTO{
			ID:          g.ID().String(),
			Title:       g.Title(),
			Description: g.Description(),
			CoverURL:    coverURL,
			ItemCount:   len(g.Items()),
			Status:      g.Status(),
			Author:      author,
			CreatedAt:   g.CreatedAt().Format(time.RFC3339),
			UpdatedAt:   g.UpdatedAt().Format(time.RFC3339),
			PreviewURLs: previewURLsOf(g, previewFiles, previewLimit),
		})
	}
	return dtos, nil
}

// previewURLsOf 前 limit 项中可展示媒体的地址（位置截断，不跨位补位）：
// 优先缩略图（图片缩略档/视频首帧），图片回退源 URL；视频无首帧跳过
// （源文件无法当预览渲染），文件缺失跳过——返回数可少于 limit。
func previewURLsOf(g *domaingallery.Gallery, files map[shared.ID]*domainupload.File, limit int) []string {
	urls := make([]string, 0, limit)
	for i, it := range g.Items() {
		if i >= limit {
			break;
		}
		f := files[it.FileID()]
		if f == nil {
			continue
		}
		if f.Thumbnail() != "" {
			urls = append(urls, f.Thumbnail())
		} else if !strings.HasPrefix(f.MimeType(), "video/") {
			urls = append(urls, f.URL())
		}
	}
	return urls
}

// toItemDTO 组装媒体项（文件缺失时保留占位，URL 为空串——文件被软删后详情不崩）。
func toItemDTO(it domaingallery.GalleryItem, f *domainupload.File) GalleryItemDTO {
	dto := GalleryItemDTO{FileID: it.FileID().String(), Caption: it.Caption()}
	if f == nil {
		return dto
	}
	dto.URL = f.URL()
	dto.Thumbnail = f.Thumbnail()
	dto.MimeType = f.MimeType()
	dto.Width = f.Width()
	dto.Height = f.Height()
	return dto
}

// coverFileIDOf 封面文件 ID：指定封面优先，否则取首项媒体。
func coverFileIDOf(g *domaingallery.Gallery) shared.ID {
	if c := g.CoverFileID(); c != nil {
		return *c
	}
	items := g.Items()
	if len(items) == 0 {
		return shared.ID{}
	}
	return items[0].FileID()
}

// parseItems 入参 → 领域媒体项。
func parseItems(in []ItemInput) ([]domaingallery.GalleryItem, error) {
	items := make([]domaingallery.GalleryItem, 0, len(in))
	for _, it := range in {
		fid, err := shared.ParseID(it.FileID)
		if err != nil {
			return nil, shared.BadRequest("非法的文件 ID")
		}
		items = append(items, domaingallery.NewGalleryItem(fid, it.Caption))
	}
	return items, nil
}

// parseOptionalID 解析可空 ID（空串 → nil）。
func parseOptionalID(raw string) (*shared.ID, error) {
	if raw == "" {
		return nil, nil
	}
	id, err := shared.ParseID(raw)
	if err != nil {
		return nil, shared.BadRequest("非法的封面文件 ID")
	}
	return &id, nil
}

// itemFileIDs 提取媒体项的文件 ID 列表（保持展示顺序）。
func itemFileIDs(items []domaingallery.GalleryItem) []shared.ID {
	ids := make([]shared.ID, 0, len(items))
	for _, it := range items {
		ids = append(ids, it.FileID())
	}
	return ids
}

// diffFileIDs 计算全量替换的差集：added = 新有旧无，removed = 旧有新无。
func diffFileIDs(oldIDs, newIDs []shared.ID) (added, removed []shared.ID) {
	oldSet := make(map[shared.ID]struct{}, len(oldIDs))
	for _, id := range oldIDs {
		oldSet[id] = struct{}{}
	}
	newSet := make(map[shared.ID]struct{}, len(newIDs))
	for _, id := range newIDs {
		newSet[id] = struct{}{}
		if _, ok := oldSet[id]; !ok {
			added = append(added, id)
		}
	}
	for _, id := range oldIDs {
		if _, ok := newSet[id]; !ok {
			removed = append(removed, id)
		}
	}
	return added, removed
}

// 用例错误（媒体校验失败在适配器侧定义，见 GalleryMediaChecker 实现）
var ErrCoverNotInItems = shared.BadRequest("封面必须来自图集媒体项")
