package app

import (
	"path/filepath"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"blog-api/config"
	appmedia "blog-api/internal/application/media"
	infraemoji "blog-api/internal/infrastructure/emoji"
	infrapimage "blog-api/internal/infrastructure/image"
	inframusic "blog-api/internal/infrastructure/music"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	"blog-api/internal/infrastructure/storage"
	mediahttp "blog-api/internal/interfaces/http/handler/media"
)

// MediaContainer emoji/music/upload 模块容器
type MediaContainer struct {
	MediaHandler     *mediahttp.Handler
	EmojiSeedService *infraemoji.EmojiSeedService
	// UploadService 供其他模块（series AI 封面）复用上传落盘管线。
	UploadService *appmedia.UploadService
}

// NewMediaContainer 装配 emoji/music/upload DDD 模块。
// 内部自建 emojiRepo / refetchStatusStore / emojiSeedService，
// 调用方只需传入 db / redisClient / cfg，不再在 main 构造 infra 对象。
func NewMediaContainer(db *gorm.DB, redisClient *redis.Client, cfg *config.Config) *MediaContainer {
	uploadRoot := cfg.UploadDir
	emojiDir := filepath.Join(uploadRoot, "emojis")
	chunkDir := filepath.Join(uploadRoot, "tmp")
	urlPrefix := cfg.UploadPathPrefix
	kiteURL := cfg.KiteURL

	emojiRepo := gormrepo.NewEmojiGroupRepository(db)
	musicRepo := gormrepo.NewPlaylistRepository(db)
	fileRepo := gormrepo.NewFileRepository(db)
	sessionRepo := gormrepo.NewUploadSessionRepository(db)
	localStorage := storage.NewLocalStorage(uploadRoot, urlPrefix)
	musicProvider := inframusic.NewKiteProvider(kiteURL)
	musicSettingStore := gormrepo.NewMusicSettingStore(db)

	emojiSeedService := infraemoji.NewEmojiSeedService(emojiRepo, emojiDir, urlPrefix, cfg.BilibiliCookie, cfg.BilibiliAPIType)
	refetchStatusStore := infraemoji.NewRefetchStatusStore(redisClient)

	emojiSvc := appmedia.NewEmojiService(emojiRepo, emojiDir, urlPrefix, emojiSeedService, refetchStatusStore)
	musicSvc := appmedia.NewMusicService(musicRepo, musicProvider, musicSettingStore)
	processor := infrapimage.NewProcessor(uploadRoot, urlPrefix)
	uploadSvc := appmedia.NewUploadService(fileRepo, sessionRepo, localStorage, processor, chunkDir, uploadRoot, urlPrefix)

	return &MediaContainer{
		MediaHandler:     mediahttp.NewHandler(emojiSvc, musicSvc, uploadSvc),
		EmojiSeedService: emojiSeedService,
		UploadService:    uploadSvc,
	}
}
