package app

import (
	"context"

	"gorm.io/gorm"

	appshared "blog-api/internal/application/shared"
	apptweet "blog-api/internal/application/tweet"
	"blog-api/internal/domain/shared"
	domainemoji "blog-api/internal/domain/emoji"
	domainupload "blog-api/internal/domain/upload"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	tweethttp "blog-api/internal/interfaces/http/handler/tweet"
)

// TweetContainer 聚合推文模块的 handler 与 service（供根容器/路由拆取）。
type TweetContainer struct {
	TweetHandler *tweethttp.Handler
	TweetService *apptweet.Service
}

// NewTweetContainer 装配推文 DDD 模块。
//
// fileRepo 适配为 TweetImageChecker（发布时图片归属校验）；
// emojiRepo 适配为 EmojiLookup（评论 emote 富化，解析 body [name] 查表）；
// userRepo 供作者资料填充与 username 解析；
// perm 供「作者或 tweet:delete-any」删除判定的权限码分支；
// bus 发布 TweetCreated/TweetDeleted（审计订阅者消费）。
func NewTweetContainer(
	db *gorm.DB,
	perm apptweet.TweetPermissionChecker,
	bus appshared.EventBus,
) *TweetContainer {
	tweetRepo := gormrepo.NewTweetRepository(db)
	commentRepo := gormrepo.NewTweetCommentRepository(db)
	userRepo := gormrepo.NewUserRepository(db)
	fileRepo := gormrepo.NewFileRepository(db)
	emojiRepo := gormrepo.NewEmojiGroupRepository(db)
	svc := apptweet.NewService(
		tweetRepo,
		commentRepo,
		userRepo,
		&tweetImageCheckerAdapter{repo: fileRepo},
		perm,
		&tweetEmojiLookupAdapter{repo: emojiRepo},
		bus,
	)
	return &TweetContainer{
		TweetHandler: tweethttp.NewHandler(svc),
		TweetService: svc,
	}
}

// tweetEmojiLookupAdapter 将 EmojiGroupRepository 适配为 tweet.EmojiLookup 端口。
// 通过 FindAll 加载全部启用表情，按 names 过滤返回 EmojiRef 映射
// （与 comment 容器 emojiLookupAdapter 同构，仅返回类型按 tweet 域独立）。
type tweetEmojiLookupAdapter struct {
	repo domainemoji.EmojiGroupRepository
}

var _ apptweet.EmojiLookup = (*tweetEmojiLookupAdapter)(nil)

func (a *tweetEmojiLookupAdapter) FindByNames(ctx context.Context, names []string) (map[string]apptweet.EmojiRef, error) {
	nameSet := make(map[string]bool, len(names))
	for _, n := range names {
		nameSet[n] = true
	}
	groups, err := a.repo.FindAll(ctx, true) // enabledOnly=true
	if err != nil {
		return nil, err
	}
	result := make(map[string]apptweet.EmojiRef)
	for _, g := range groups {
		for _, e := range g.Emojis() {
			if nameSet[e.Name()] {
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
