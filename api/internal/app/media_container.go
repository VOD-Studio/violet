package app

import (
	"path/filepath"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"blog-api/config"
	appmedia "blog-api/internal/application/media"
	domainimage "blog-api/internal/domain/image"
	infraemoji "blog-api/internal/infrastructure/emoji"
	infrapimage "blog-api/internal/infrastructure/image"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	"blog-api/internal/infrastructure/storage"
	mediahttp "blog-api/internal/interfaces/http/handler/media"
)

// MediaContainer emoji/upload 模块容器
type MediaContainer struct {
	MediaHandler     *mediahttp.Handler
	EmojiSeedService *infraemoji.EmojiSeedService
	// UploadService 供其他模块（series AI 封面）复用上传落盘管线。
	UploadService *appmedia.UploadService
}

// NewMediaContainer 装配 emoji/upload DDD 模块。
// 内部自建 emojiRepo / refetchStatusStore / emojiSeedService，
// 图片策略与编码准入器由根容器注入，与动态图片和外部媒体共用。
func NewMediaContainer(db *gorm.DB, redisClient *redis.Client, cfg *config.Config, policies domainimage.PolicyProvider, encoder *infrapimage.Encoder) *MediaContainer {
	uploadRoot := cfg.UploadDir
	emojiDir := filepath.Join(uploadRoot, "emojis")
	chunkDir := filepath.Join(uploadRoot, "tmp")
	urlPrefix := cfg.UploadPathPrefix

	emojiRepo := gormrepo.NewEmojiGroupRepository(db)
	fileRepo := gormrepo.NewFileRepository(db)
	sessionRepo := gormrepo.NewUploadSessionRepository(db)
	localStorage := storage.NewLocalStorage(uploadRoot, urlPrefix)

	emojiSeedService := infraemoji.NewEmojiSeedService(emojiRepo, emojiDir, urlPrefix, cfg.BilibiliCookie, cfg.BilibiliAPIType)
	refetchStatusStore := infraemoji.NewRefetchStatusStore(redisClient)

	emojiSvc := appmedia.NewEmojiService(emojiRepo, emojiDir, urlPrefix, emojiSeedService, refetchStatusStore)
	processor := infrapimage.NewProcessor(uploadRoot, urlPrefix, policies, encoder)
	uploadSvc := appmedia.NewUploadService(fileRepo, sessionRepo, localStorage, processor, chunkDir, uploadRoot, urlPrefix)

	return &MediaContainer{
		MediaHandler:     mediahttp.NewHandler(emojiSvc, uploadSvc),
		EmojiSeedService: emojiSeedService,
		UploadService:    uploadSvc,
	}
}
