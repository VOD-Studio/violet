package app

import (
	"gorm.io/gorm"

	appmedia "blog-api/internal/application/media"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	mediahttp "blog-api/internal/interfaces/http/handler/media"
)

// MediaContainer emoji/music/upload 模块容器
type MediaContainer struct {
	MediaHandler *mediahttp.Handler
}

// NewMediaContainer 装配 emoji/music/upload DDD 模块
func NewMediaContainer(db *gorm.DB) *MediaContainer {
	emojiRepo := gormrepo.NewEmojiGroupRepository(db)
	musicRepo := gormrepo.NewPlaylistRepository(db)
	fileRepo := gormrepo.NewFileRepository(db)
	sessionRepo := gormrepo.NewUploadSessionRepository(db)

	emojiSvc := appmedia.NewEmojiService(emojiRepo)
	musicSvc := appmedia.NewMusicService(musicRepo)
	uploadSvc := appmedia.NewUploadService(fileRepo, sessionRepo)

	return &MediaContainer{
		MediaHandler: mediahttp.NewHandler(emojiSvc, musicSvc, uploadSvc),
	}
}
