package app

import (
	"context"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"blog-api/config"
	appcustomemoji "blog-api/internal/application/customemoji"
	appshared "blog-api/internal/application/shared"
	apptweet "blog-api/internal/application/tweet"
	domainemoji "blog-api/internal/domain/emoji"
	"blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
	infraimage "blog-api/internal/infrastructure/image"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	"blog-api/internal/infrastructure/xtweet"
	tweethttp "blog-api/internal/interfaces/http/handler/tweet"
	"blog-api/internal/middleware"
)

type TweetContainer struct {
	TweetHandler    *tweethttp.Handler
	TweetService    *apptweet.Service
	ExternalService *apptweet.ExternalService
}

func NewTweetContainer(
	db *gorm.DB,
	redisClient *redis.Client,
	cfg *config.Config,
	perm apptweet.TweetPermissionChecker,
	customEmojiSvc *appcustomemoji.Service,
	bus appshared.EventBus,
) *TweetContainer {
	tweetRepo := gormrepo.NewTweetRepository(db)
	commentRepo := gormrepo.NewTweetCommentRepository(db)
	userRepo := gormrepo.NewUserRepository(db)
	fileRepo := gormrepo.NewFileRepository(db)
	emojiRepo := gormrepo.NewEmojiGroupRepository(db)
	external := apptweet.NewExternalService(
		gormrepo.NewExternalTweetRepository(db), xtweet.NewFetcher(nil),
		xtweet.NewMediaStore(cfg.UploadDir, cfg.UploadPathPrefix, infraimage.NewProcessor(cfg.UploadDir, cfg.UploadPathPrefix), nil),
		xtweet.NewPreviewStore(redisClient),
	)
	svc := apptweet.NewService(
		tweetRepo,
		commentRepo,
		userRepo,
		&tweetImageCheckerAdapter{repo: fileRepo},
		perm,
		&tweetEmojiLookupAdapter{repo: emojiRepo, customEmojiSvc: customEmojiSvc},
		bus,
	).WithExternal(external)
	return &TweetContainer{
		TweetHandler:    tweethttp.NewHandler(svc),
		TweetService:    svc,
		ExternalService: external,
	}
}

// tweetEmojiLookupAdapter 将系统表情目录与自定义表情 resolver 适配为 tweet.EmojiLookup。
type tweetEmojiLookupAdapter struct {
	repo           domainemoji.EmojiGroupRepository
	customEmojiSvc *appcustomemoji.Service
}

var _ apptweet.EmojiLookup = (*tweetEmojiLookupAdapter)(nil)

func (a *tweetEmojiLookupAdapter) FindByNames(ctx context.Context, names []string) (map[string]apptweet.EmojiRef, error) {
	tokens := appshared.SplitCustomEmojiTokens(names)
	result := make(map[string]apptweet.EmojiRef)
	if len(tokens.IDs) > 0 && a.customEmojiSvc != nil {
		viewerID, _ := shared.ParseID(middleware.GetUserID(ctx))
		refs, err := a.customEmojiSvc.ResolveByIDs(ctx, tokens.IDs, viewerID)
		if err != nil {
			return nil, err
		}
		for id, ref := range refs {
			for _, token := range tokens.TokensByID[id] {
				result[token] = apptweet.EmojiRef{
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
				result[e.Name()] = apptweet.EmojiRef{
					URL:    e.URL(),
					GifURL: e.GifURL(),
					Size:   int(e.Meta().Size()),
				}
			}
		}
	}
	return result, nil
}

func (a *tweetEmojiLookupAdapter) ValidateContent(ctx context.Context, content string, viewerID shared.ID) error {
	if a.customEmojiSvc == nil {
		return nil
	}
	return a.customEmojiSvc.ValidateContent(ctx, content, viewerID)
}

// tweetImageCheckerAdapter 将 upload.FileRepository 适配为 TweetImageChecker 端口
// （依赖反转：application/tweet 不感知 upload 域细节，与 mcp.PostService 端口同构）。
type tweetImageCheckerAdapter struct {
	repo domainupload.FileRepository
}

var _ apptweet.TweetImageChecker = (*tweetImageCheckerAdapter)(nil)

// CheckImagesOwnedBy 校验所有 URL 命中就绪文件且归属 authorID。
// 不存在/未就绪/非本人统一报 Forbidden，不区分（不暴露他人文件存在性）。
func (a *tweetImageCheckerAdapter) CheckImagesOwnedBy(ctx context.Context, urls []string, authorID shared.ID) error {
	// 去重：同一图片重复引用不重复校验（也避免命中数与传入数不等长误判）
	uniq := make([]string, 0, len(urls))
	seen := make(map[string]bool, len(urls))
	for _, u := range urls {
		if !seen[u] {
			seen[u] = true
			uniq = append(uniq, u)
		}
	}
	files, err := a.repo.FindByURLs(ctx, uniq)
	if err != nil {
		return err
	}
	if len(files) != len(uniq) {
		return shared.Forbidden("推文图片不存在或不属于当前用户")
	}
	for _, f := range files {
		if !f.OwnerID().Equal(authorID) {
			return shared.Forbidden("推文图片不存在或不属于当前用户")
		}
	}
	return nil
}
