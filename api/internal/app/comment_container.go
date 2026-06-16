package app

import (
	"gorm.io/gorm"

	appcomment "blog-api/internal/application/comment"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	commenthttp "blog-api/internal/interfaces/http/handler/comment"
)

// CommentContainer 评论模块容器
type CommentContainer struct {
	CommentHandler *commenthttp.Handler
}

// NewCommentContainer 装配评论 DDD 模块
func NewCommentContainer(db *gorm.DB) *CommentContainer {
	commentRepo := gormrepo.NewCommentRepository(db)
	commentSvc := appcomment.NewService(commentRepo)
	return &CommentContainer{
		CommentHandler: commenthttp.NewHandler(commentSvc),
	}
}
