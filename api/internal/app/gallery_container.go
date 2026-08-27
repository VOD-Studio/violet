package app

import (
	"context"
	"strings"

	"gorm.io/gorm"

	appgallery "blog-api/internal/application/gallery"
	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	galleryhttp "blog-api/internal/interfaces/http/handler/gallery"
)

type GalleryContainer struct {
	GalleryHandler *galleryhttp.Handler
	GalleryService *appgallery.Service
}

// NewGalleryContainer 装配图集模块（PRD-0022）。
//
// fileRepo 适配为 GalleryMediaChecker（归属/类型校验 + 引用计数维护）；
// userRepo 供作者资料填充与 username 解析；
// perm 供「作者或 gallery:delete-any」删除判定的权限码分支；
// bus 发布 gallery.* 事件（审计订阅者消费）。
func NewGalleryContainer(db *gorm.DB, perm appgallery.GalleryPermissionChecker, bus appshared.EventBus) *GalleryContainer {
	repo := gormrepo.NewGalleryRepository(db)
	svc := appgallery.NewService(
		repo,
		&galleryMediaCheckerAdapter{repo: gormrepo.NewFileRepository(db)},
		gormrepo.NewUserRepository(db),
		perm,
		bus,
	)
	return &GalleryContainer{
		GalleryHandler: galleryhttp.NewHandler(svc),
		GalleryService: svc,
	}
}

// galleryMediaCheckerAdapter 将 upload.FileRepository 适配为 GalleryMediaChecker 端口
// （依赖反转：application/gallery 不感知 upload 域细节，与 tweetImageCheckerAdapter 同构）。
type galleryMediaCheckerAdapter struct {
	repo domainupload.FileRepository
}

var _ appgallery.GalleryMediaChecker = (*galleryMediaCheckerAdapter)(nil)

// CheckFilesUsable 校验所有文件存在、就绪、归属 ownerID，且类型为图片或 mp4/webm。
// 不存在/未就绪/非本人统一报 Forbidden（不暴露他人文件存在性）；类型不符报 BadRequest。
func (a *galleryMediaCheckerAdapter) CheckFilesUsable(ctx context.Context, fileIDs []shared.ID, ownerID shared.ID) error {
	if len(fileIDs) == 0 {
		return nil
	}
	uniq := make([]shared.ID, 0, len(fileIDs))
	seen := make(map[shared.ID]struct{}, len(fileIDs))
	for _, id := range fileIDs {
		if _, ok := seen[id]; !ok {
			seen[id] = struct{}{}
			uniq = append(uniq, id)
		}
	}
	files, err := a.repo.FindByIDs(ctx, uniq)
	if err != nil {
		return err
	}
	byID := make(map[shared.ID]*domainupload.File, len(files))
	for _, f := range files {
		byID[f.ID()] = f
	}
	for _, id := range uniq {
		f, ok := byID[id]
		if !ok || f.OwnerID() != ownerID || f.Status() != domainupload.StatusReady {
			return shared.Forbidden("媒体文件不存在或不属于当前用户")
		}
		if !isGalleryMediaType(f.MimeType()) {
			return shared.BadRequest("图集仅支持图片或 mp4/webm 视频")
		}
	}
	return nil
}

// UpdateRefCount 维护文件引用计数。
func (a *galleryMediaCheckerAdapter) UpdateRefCount(ctx context.Context, fileID shared.ID, delta int) error {
	return a.repo.UpdateRefCount(ctx, fileID, delta)
}

// FindByIDs 批量取文件并索引为 map（调用方按 items 顺序自行组装）。
func (a *galleryMediaCheckerAdapter) FindByIDs(ctx context.Context, fileIDs []shared.ID) (map[shared.ID]*domainupload.File, error) {
	files, err := a.repo.FindByIDs(ctx, fileIDs)
	if err != nil {
		return nil, err
	}
	byID := make(map[shared.ID]*domainupload.File, len(files))
	for _, f := range files {
		byID[f.ID()] = f
	}
	return byID, nil
}

// isGalleryMediaType 图集媒体类型白名单：图片或浏览器原生可播的 mp4/webm。
func isGalleryMediaType(mime string) bool {
	if strings.HasPrefix(mime, "image/") {
		return true
	}
	return mime == "video/mp4" || mime == "video/webm"
}
