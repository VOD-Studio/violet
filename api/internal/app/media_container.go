package app

import (
	"gorm.io/gorm"

	appmedia "blog-api/internal/application/media"
	infrapimage "blog-api/internal/infrastructure/image"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	inframusic "blog-api/internal/infrastructure/music"
	"blog-api/internal/infrastructure/storage"
	mediahttp "blog-api/internal/interfaces/http/handler/media"
)

// MediaContainer emoji/music/upload 模块容器
type MediaContainer struct {
	MediaHandler *mediahttp.Handler
}

// NewMediaContainer 装配 emoji/music/upload DDD 模块
func NewMediaContainer(db *gorm.DB, emojiDir, chunkDir, uploadDir, urlPrefix string) *MediaContainer {
	emojiRepo := gormrepo.NewEmojiGroupRepository(db)
	musicRepo := gormrepo.NewPlaylistRepository(db)
	fileRepo := gormrepo.NewFileRepository(db)
	sessionRepo := gormrepo.NewUploadSessionRepository(db)
	localStorage := storage.NewLocalStorage(uploadDir, urlPrefix)
	musicProvider := inframusic.NewProvider()
	musicSettingStore := gormrepo.NewMusicSettingStore(db)

	emojiSvc := appmedia.NewEmojiService(emojiRepo, emojiDir)
	musicSvc := appmedia.NewMusicService(musicRepo, musicProvider, musicSettingStore)
	processor := infrapimage.NewProcessor(uploadDir, urlPrefix)
	uploadSvc := appmedia.NewUploadService(fileRepo, sessionRepo, localStorage, processor, chunkDir)

	return &MediaContainer{
		MediaHandler: mediahttp.NewHandler(emojiSvc, musicSvc, uploadSvc),
	}
}
