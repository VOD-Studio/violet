package app

import (
	"gorm.io/gorm"

	"blog-api/config"
	applp "blog-api/internal/application/linkpreview"
	domainimage "blog-api/internal/domain/image"
	infraimage "blog-api/internal/infrastructure/image"
	infralp "blog-api/internal/infrastructure/linkpreview"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	linkpreviewhttp "blog-api/internal/interfaces/http/handler/linkpreview"
)

// LinkPreviewContainer 链接卡片模块容器。
//
// 独立于 tweet：卡片缓存按 URL 跨内容共享，tweet 只是消费方之一。
type LinkPreviewContainer struct {
	// LinkCardHandler 通用取卡片端点（POST /link-cards/lookup）
	LinkCardHandler *linkpreviewhttp.Handler
	// Service 批量查询与惰性刷新用例（推文 DTO 组装复用同一实例）
	Service *applp.Service
}

// NewLinkPreviewContainer 装配链接卡片模块。
func NewLinkPreviewContainer(
	db *gorm.DB,
	cfg *config.Config,
	policies domainimage.PolicyProvider,
	encoder *infraimage.Encoder,
) *LinkPreviewContainer {
	svc := applp.NewService(
		gormrepo.NewLinkCardRepository(db),
		infralp.NewFetcher(nil),
		infralp.NewCoverStore(cfg.UploadDir, cfg.UploadPathPrefix, infraimage.NewProcessor(cfg.UploadDir, cfg.UploadPathPrefix, policies, encoder), nil),
		4,
	)
	return &LinkPreviewContainer{
		LinkCardHandler: linkpreviewhttp.NewHandler(svc),
		Service:         svc,
	}
}
