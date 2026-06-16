package app

import (
	"gorm.io/gorm"

	apppost "blog-api/internal/application/post"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	posthttp "blog-api/internal/interfaces/http/handler/post"
)

// PostContainer 文章模块容器
type PostContainer struct {
	PostHandler *posthttp.Handler
}

func NewPostContainer(db *gorm.DB) *PostContainer {
	repo := gormrepo.NewPostRepository(db)
	svc := apppost.NewService(repo)
	return &PostContainer{PostHandler: posthttp.NewHandler(svc)}
}
