package app

import (
	"gorm.io/gorm"

	appann "blog-api/internal/application/announcement"
	appproj "blog-api/internal/application/project"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	contenthttp "blog-api/internal/interfaces/http/handler/content"
)

// ContentContainer announcement + project 模块容器
type ContentContainer struct {
	ContentHandler *contenthttp.Handler
}

// NewContentContainer 装配 announcement + project DDD 模块
func NewContentContainer(db *gorm.DB) *ContentContainer {
	annRepo := gormrepo.NewAnnouncementRepository(db)
	projRepo := gormrepo.NewProjectRepository(db)

	annSvc := appann.NewService(annRepo)
	projSvc := appproj.NewService(projRepo)

	return &ContentContainer{
		ContentHandler: contenthttp.NewHandler(annSvc, projSvc),
	}
}
