package app

import (
	"gorm.io/gorm"

	appmedia "blog-api/internal/application/media"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	"blog-api/internal/infrastructure/storage"
	mediahttp "blog-api/internal/interfaces/http/handler/media"
)

// MediaContainer emoji/music/upload 模块容器
type MediaContainer struct {
	MediaHandler *mediahttp.Handler
}

// NewMediaContainer 装配 emoji/music/upload DDD 模块
//
// emojiDir:  表情文件存储目录
// chunkDir:  分片上传临时目录
// uploadDir: 最终文件存储目录
// urlPrefix: 文件访问 URL 前缀
func NewMediaContainer(db *gorm.DB, emojiDir, chunkDir, uploadDir, urlPrefix string) *MediaContainer {
	emojiRepo := gormrepo.NewEmojiGroupRepository(db)
	musicRepo := gormrepo.NewPlaylistRepository(db)
	fileRepo := gormrepo.NewFileRepository(db)
	sessionRepo := gormrepo.NewUploadSessionRepository(db)
	localStorage := storage.NewLocalStorage(uploadDir, urlPrefix)

	emojiSvc := appmedia.NewEmojiService(emojiRepo, emojiDir)
	musicSvc := appmedia.NewMusicService(musicRepo)
	uploadSvc := appmedia.NewUploadService(fileRepo, sessionRepo, localStorage, chunkDir)

	return &MediaContainer{
		MediaHandler: mediahttp.NewHandler(emojiSvc, musicSvc, uploadSvc),
	}
}
