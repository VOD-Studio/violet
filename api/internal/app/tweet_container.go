package app

import (
	"context"

	"gorm.io/gorm"

	appcustomemoji "blog-api/internal/application/customemoji"
	appshared "blog-api/internal/application/shared"
	apptweet "blog-api/internal/application/tweet"
	domainemoji "blog-api/internal/domain/emoji"
	"blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	tweethttp "blog-api/internal/interfaces/http/handler/tweet"
	"blog-api/internal/middleware"
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
// customEmojiSvc 用于解析 body 中的 [name:uuid] 自定义表情占位符（PRD-0020）；
// userRepo 供作者资料填充与 username 解析；
// perm 供「作者或 tweet:delete-any」删除判定的权限码分支；
// bus 发布 TweetCreated/TweetDeleted（审计订阅者消费）。
func NewTweetContainer(
	db *gorm.DB,
	perm apptweet.TweetPermissionChecker,
	customEmojiSvc *appcustomemoji.Service,
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
		&tweetEmojiLookupAdapter{repo: emojiRepo, customEmojiSvc: customEmojiSvc},
		bus,
	)
	return &TweetContainer{
		TweetHandler: tweethttp.NewHandler(svc),
		TweetService: svc,
	}
}

// tweetEmojiLookupAdapter 将 EmojiGroupRepository + customemoji.Service 适配为
// tweet.EmojiLookup 端口（与 comment 容器 emojiLookupAdapter 同构，仅返回类型按
// tweet 域独立）。token 含 : 且冒号后段是合法 UUID 时委托给共享 customemoji
// resolver（PRD-0020），两条分支合并进同一个 map[string]EmojiRef 返回值。
type tweetEmojiLookupAdapter struct {
	repo           domainemoji.EmojiGroupRepository
	customEmojiSvc *appcustomemoji.Service
}

var _ apptweet.EmojiLookup = (*tweetEmojiLookupAdapter)(nil)

func (a *tweetEmojiLookupAdapter) FindByNames(ctx context.Context, names []string) (map[string]apptweet.EmojiRef, error) {
	nameSet := make(map[string]bool, len(names))
	var customIDs []shared.ID
	tokenByID := make(map[shared.ID][]string, len(names))
	seenCustomIDs := make(map[shared.ID]struct{}, len(names))
	for _, n := range names {
		if len(n) >= 2 {
			if id, ok := appcustomemoji.ParseToken(n[1 : len(n)-1]); ok {
				tokenByID[id] = append(tokenByID[id], n)
				if _, seen := seenCustomIDs[id]; !seen {
					seenCustomIDs[id] = struct{}{}
					customIDs = append(customIDs, id)
				}
				continue
			}
		}
		nameSet[n] = true
	}
	result := make(map[string]apptweet.EmojiRef)
	if len(customIDs) > 0 && a.customEmojiSvc != nil {
		viewerID, _ := shared.ParseID(middleware.GetUserID(ctx))
		refs, err := a.customEmojiSvc.ResolveByIDs(ctx, customIDs, viewerID)
		if err != nil {
			return nil, err
		}
		for id, ref := range refs {
			for _, token := range tokenByID[id] {
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
