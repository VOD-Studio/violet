package app

import (
	"gorm.io/gorm"

	appmedia "blog-api/internal/application/media"
	domainemoji "blog-api/internal/domain/emoji"
	infrapimage "blog-api/internal/infrastructure/image"
	inframusic "blog-api/internal/infrastructure/music"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	"blog-api/internal/infrastructure/storage"
	mediahttp "blog-api/internal/interfaces/http/handler/media"
)

// MediaContainer emoji/music/upload 模块容器
type MediaContainer struct {
	MediaHandler *mediahttp.Handler
}

// NewMediaContainer 装配 emoji/music/upload DDD 模块。
// reseeder/statusStore 用于「重新拉取」功能。
func NewMediaContainer(
	db *gorm.DB,
	emojiDir, chunkDir, uploadDir, urlPrefix string,
	reseeder appmedia.ReseedRunner,
	statusStore domainemoji.RefetchStatusStore,
) *MediaContainer {
	emojiRepo := gormrepo.NewEmojiGroupRepository(db)
	musicRepo := gormrepo.NewPlaylistRepository(db)
	fileRepo := gormrepo.NewFileRepository(db)
	sessionRepo := gormrepo.NewUploadSessionRepository(db)
	localStorage := storage.NewLocalStorage(uploadDir, urlPrefix)
	musicProvider := inframusic.NewProvider()
	musicSettingStore := gormrepo.NewMusicSettingStore(db)

	emojiSvc := appmedia.NewEmojiService(emojiRepo, emojiDir, urlPrefix, reseeder, statusStore)
	musicSvc := appmedia.NewMusicService(musicRepo, musicProvider, musicSettingStore)
	processor := infrapimage.NewProcessor(uploadDir, urlPrefix)
	uploadSvc := appmedia.NewUploadService(fileRepo, sessionRepo, localStorage, processor, chunkDir, uploadDir, urlPrefix)

	return &MediaContainer{
		MediaHandler: mediahttp.NewHandler(emojiSvc, musicSvc, uploadSvc),
	}
}
