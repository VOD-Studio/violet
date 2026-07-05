package app

import (
	"gorm.io/gorm"

	appcomment "blog-api/internal/application/comment"
	appshared "blog-api/internal/application/shared"
	infraemail "blog-api/internal/infrastructure/email"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	commenthttp "blog-api/internal/interfaces/http/handler/comment"
)

// CommentContainer 评论模块容器
type CommentContainer struct {
	CommentHandler *commenthttp.Handler
}

// NewCommentContainer 装配评论 DDD 模块。
//
// codeStore 和 emailSender 用于匿名评论邮箱验证码两步流（PRD-0001）；
// userRepo 用于登录评论者的 author_* 资料填充。
func NewCommentContainer(db *gorm.DB, codeStore appshared.CodeStore, emailSender *infraemail.Sender) *CommentContainer {
	commentRepo := gormrepo.NewCommentRepository(db)
	userRepo := gormrepo.NewUserRepository(db)
	postRepo := gormrepo.NewPostRepository(db)
	commentSvc := appcomment.NewService(commentRepo, codeStore, emailSender)
	return &CommentContainer{
		CommentHandler: commenthttp.NewHandler(commentSvc, userRepo, postRepo),
	}
}
