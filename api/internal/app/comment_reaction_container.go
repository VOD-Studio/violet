package app

import (
	"gorm.io/gorm"

	appcr "blog-api/internal/application/commentreaction"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	crhttp "blog-api/internal/interfaces/http/handler/commentreaction"
)

// CommentReactionContainer 评论反应模块容器
type CommentReactionContainer struct {
	CommentReactionHandler *crhttp.Handler
}

// NewCommentReactionContainer 装配评论反应模块
func NewCommentReactionContainer(db *gorm.DB) *CommentReactionContainer {
	store := gormrepo.NewCommentReactionStore(db)
	svc := appcr.NewService(store)
	return &CommentReactionContainer{CommentReactionHandler: crhttp.NewHandler(svc)}
}
