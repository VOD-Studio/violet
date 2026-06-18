package app

import (
	"gorm.io/gorm"

	apptag "blog-api/internal/application/tag"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	taghttp "blog-api/internal/interfaces/http/handler/tag"
)

// TagContainer 标签模块容器
type TagContainer struct {
	TagHandler *taghttp.Handler
}

// NewTagContainer 装配标签模块
func NewTagContainer(db *gorm.DB) *TagContainer {
	repo := gormrepo.NewTagRepository(db)
	svc := apptag.NewService(repo)
	return &TagContainer{TagHandler: taghttp.NewHandler(svc)}
}
