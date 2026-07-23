package app

import (
	"context"

	"gorm.io/gorm"

	appcomment "blog-api/internal/application/comment"
	appshared "blog-api/internal/application/shared"
	domainemoji "blog-api/internal/domain/emoji"
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
// userRepo 用于登录评论者的 author_* 资料填充；
// emojiRepo 用于评论 emote 映射（解析 body 中的 [name] 查表构建）。
func NewCommentContainer(db *gorm.DB, codeStore appshared.CodeStore, emailSender *infraemail.Sender) *CommentContainer {
	commentRepo := gormrepo.NewCommentRepository(db)
	userRepo := gormrepo.NewUserRepository(db)
	postRepo := gormrepo.NewPostRepository(db)
	emojiRepo := gormrepo.NewEmojiGroupRepository(db)
	commentSvc := appcomment.NewService(commentRepo, codeStore, emailSender, &emojiLookupAdapter{repo: emojiRepo})
	return &CommentContainer{
		CommentHandler: commenthttp.NewHandler(commentSvc, userRepo, postRepo),
	}
}

// emojiLookupAdapter 将 EmojiGroupRepository 适配为 comment.EmojiLookup 端口。
// 通过 FindAll 加载全部启用表情，按 names 过滤返回 EmojiRef 映射。
type emojiLookupAdapter struct {
	repo domainemoji.EmojiGroupRepository
}

func (a *emojiLookupAdapter) FindByNames(ctx context.Context, names []string) (map[string]appcomment.EmojiRef, error) {
	nameSet := make(map[string]bool, len(names))
	for _, n := range names {
		nameSet[n] = true
	}
	groups, err := a.repo.FindAll(ctx, true) // enabledOnly=true
	if err != nil {
		return nil, err
	}
	result := make(map[string]appcomment.EmojiRef)
	for _, g := range groups {
		for _, e := range g.Emojis() {
			if nameSet[e.Name()] {
			result[e.Name()] = appcomment.EmojiRef{
				URL:    e.URL(),
				GifURL: e.GifURL(),
				Size:   int(e.Meta().Size()),
			}
			}
		}
	}
	return result, nil
}
