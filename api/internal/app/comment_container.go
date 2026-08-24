package app

import (
	"context"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	appcomment "blog-api/internal/application/comment"
	appcustomemoji "blog-api/internal/application/customemoji"
	appsettings "blog-api/internal/application/settings"
	appshared "blog-api/internal/application/shared"
	domainemoji "blog-api/internal/domain/emoji"
	"blog-api/internal/domain/shared"
	infraauth "blog-api/internal/infrastructure/auth"
	infraemail "blog-api/internal/infrastructure/email"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	commenthttp "blog-api/internal/interfaces/http/handler/comment"
	"blog-api/internal/middleware"
)

// CommentContainer 评论模块容器
type CommentContainer struct {
	CommentHandler *commenthttp.Handler
	CommentService *appcomment.Service
}

// NewCommentContainer 装配评论 DDD 模块。
//
// redisClient 用于匿名评论邮箱验证码存储（Redis，内部自建 codeStore）；
// emailSender 用于匿名评论邮箱验证码两步流（PRD-0001）；
// userRepo 用于登录评论者的 author_* 资料填充；
// emojiRepo 用于评论 emote 映射（解析 body 中的 [name] 查表构建）；
// customEmojiSvc 解析 body 中的 [name:uuid] 自定义表情占位符。
func NewCommentContainer(db *gorm.DB, redisClient *redis.Client, emailSender *infraemail.Sender, settingsSvc *appsettings.Service, customEmojiSvc *appcustomemoji.Service, bus appshared.EventBus) *CommentContainer {
	commentRepo := gormrepo.NewCommentRepository(db)
	userRepo := gormrepo.NewUserRepository(db)
	postRepo := gormrepo.NewPostRepository(db)
	emojiRepo := gormrepo.NewEmojiGroupRepository(db)
	codeStore := infraauth.NewRedisCodeStore(redisClient)
	commentSvc := appcomment.NewService(commentRepo, codeStore, emailSender, &emojiLookupAdapter{repo: emojiRepo, customEmojiSvc: customEmojiSvc}, &commentSitePolicy{svc: settingsSvc}, bus)
	return &CommentContainer{
		CommentHandler: commenthttp.NewHandler(commentSvc, userRepo, postRepo),
		CommentService: commentSvc,
	}
}

// commentSitePolicy 将 settings 模块适配为 comment.SitePolicy 端口。
type commentSitePolicy struct {
	svc *appsettings.Service
}

func (a *commentSitePolicy) CommentPolicy(ctx context.Context) (bool, bool, error) {
	s, err := a.svc.GetAll(ctx)
	if err != nil {
		return false, false, err
	}
	return s.CommentsEnabled, s.CommentsModeration, nil
}

// emojiLookupAdapter 将系统表情目录与自定义表情 resolver 适配为 comment.EmojiLookup。
type emojiLookupAdapter struct {
	repo           domainemoji.EmojiGroupRepository
	customEmojiSvc *appcustomemoji.Service
}

func (a *emojiLookupAdapter) FindByNames(ctx context.Context, names []string) (map[string]appcomment.EmojiRef, error) {
	tokens := appshared.SplitCustomEmojiTokens(names)
	result := make(map[string]appcomment.EmojiRef)
	if len(tokens.IDs) > 0 && a.customEmojiSvc != nil {
		viewerID, _ := shared.ParseID(middleware.GetUserID(ctx))
		refs, err := a.customEmojiSvc.ResolveByIDs(ctx, tokens.IDs, viewerID)
		if err != nil {
			return nil, err
		}
		for id, ref := range refs {
			for _, token := range tokens.TokensByID[id] {
				result[token] = appcomment.EmojiRef{
					URL:           ref.URL,
					CustomEmojiID: id.String(),
					Relation:      string(ref.Relation),
				}
			}
		}
	}
	groups, err := a.repo.FindAll(ctx, true) // enabledOnly=true
	if err != nil {
		return nil, err
	}
	for _, g := range groups {
		for _, e := range g.Emojis() {
			if tokens.SystemNames[e.Name()] {
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

func (a *emojiLookupAdapter) ValidateContent(ctx context.Context, content string, viewerID shared.ID) error {
	if a.customEmojiSvc == nil {
		return nil
	}
	return a.customEmojiSvc.ValidateContent(ctx, content, viewerID)
}
