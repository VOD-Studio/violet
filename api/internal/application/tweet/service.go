// Package tweet 提供推文用例服务（application 层）。
//
// 承载推文的发/删/读：即发即出（Create 无审核状态机）、不可编辑（无 Update 用例）、
// 物理删除（Delete 直接清行，点赞/评论由 DB 级联）。
// 推文评论（P2）同属本服务：登录可评论/回复、作者或管理员可删、page/limit 分页。
// 删除鉴权（作者本人或 tweet:delete-any）在应用层做（与 post.canModify 同构：
// 所有权 OR 权限码的双重判定无法由路由中间件单一表达）。
//
// 依赖方向：Service → domain 端口（TweetRepository / CommentRepository / UserRepository），
// 图片归属校验通过 TweetImageChecker 端口反转依赖 upload 域。
package tweet

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
	domainuser "blog-api/internal/domain/user"
	"blog-api/internal/middleware"
)

// PermDeleteAny 删除任意推文的权限码（migration 067 seed）
const PermDeleteAny = "tweet:delete-any"

// Service 推文用例服务。
type Service struct {
	repo        domaintweet.TweetRepository
	commentRepo domaintweet.CommentRepository
	userRepo    domainuser.UserRepository
	checker     TweetImageChecker
	perm        TweetPermissionChecker
	emojiLookup EmojiLookup
	bus         appshared.EventBus
}

// NewService 构造服务。
// checker 为 nil 时跳过图片归属校验（仅限测试场景；生产容器必须注入）。
// commentRepo 为 nil 时跳过评论相关用例与评论数填充（仅限推文单测场景）。
// perm 为 nil 时仅作者本人可删（无权限码放行路径）。
// emojiLookup 为 nil 时跳过评论 emote 富化（仅限测试场景；生产容器必须注入）。
func NewService(
	repo domaintweet.TweetRepository,
	commentRepo domaintweet.CommentRepository,
	userRepo domainuser.UserRepository,
	checker TweetImageChecker,
	perm TweetPermissionChecker,
	emojiLookup EmojiLookup,
	bus appshared.EventBus,
) *Service {
	return &Service{repo: repo, commentRepo: commentRepo, userRepo: userRepo, checker: checker, perm: perm, emojiLookup: emojiLookup, bus: bus}
}

// --- 输入/输出 DTO ---

// CreateInput 发推文入参。
type CreateInput struct {
	// AuthorID 作者（当前登录用户 ID，handler 从 session ctx 提取）
	AuthorID string
	Content  string
	Images   []string
	QuoteOf  *string
}

// AuthorDTO 推文作者资料卡（时间线/详情页展示用）。
type AuthorDTO struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatar_url"`
}

// UserProfileDTO 用户公开资料卡（公开，仅包含不敏感的非私域字段）。
type UserProfileDTO struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
	Bio         string `json:"bio"`
	// CreatedAt RFC3339 格式
	CreatedAt string `json:"created_at"`
}

// QuotedTweetDTO 被引用推文读模型。
type QuotedTweetDTO struct {
	ID         string              `json:"id"`
	Author     AuthorDTO           `json:"author"`
	Content    string              `json:"content"`
	Images     []string            `json:"images"`
	Emote      map[string]EmojiRef `json:"emote,omitempty"`
	QuoteCount int                 `json:"quote_count"`
	CreatedAt  string              `json:"created_at"`
}

// TweetDTO 推文读模型（序列化跨层传输）。
type TweetDTO struct {
	ID           string              `json:"id"`
	Author       AuthorDTO           `json:"author"`
	Content      string              `json:"content"`
	Images       []string            `json:"images"`
	Emote        map[string]EmojiRef `json:"emote,omitempty"`
	LikeCount    int                 `json:"like_count"`
	IsLiked      bool                `json:"is_liked"`
	CommentCount int                 `json:"comment_count"`
	QuoteCount   int                 `json:"quote_count"`
	QuoteOf      *string             `json:"quote_of,omitempty"`
	QuotedTweet  *QuotedTweetDTO     `json:"quoted_tweet,omitempty"`
	CreatedAt    string              `json:"created_at"`
}

// --- 写用例 ---

// Create 发推文（即发即出：无审核状态机，保存即可见）。
//
// 编排：领域工厂（不变量）→ 图片归属校验（端口反转到 upload 域）→ Save → 发布事件。
func (s *Service) Create(ctx context.Context, in CreateInput) (TweetDTO, error) {
	authorID, err := shared.ParseID(in.AuthorID)
	if err != nil {
		return TweetDTO{}, shared.BadRequest("非法的作者 ID")
	}

	var quoteOf *shared.ID
	if in.QuoteOf != nil && *in.QuoteOf != "" {
		qid, err := shared.ParseID(*in.QuoteOf)
		if err != nil {
			return TweetDTO{}, shared.BadRequest("非法的引用推文 ID")
		}
		if _, err := s.repo.FindByID(ctx, qid); err != nil {
			if errors.Is(err, domaintweet.ErrNotFound) {
				return TweetDTO{}, shared.NotFound("被引用的推文")
			}
			return TweetDTO{}, err
		}
		quoteOf = &qid
	}

	tw, err := domaintweet.NewTweet(authorID, in.Content, in.Images, quoteOf)
	if err != nil {
		return TweetDTO{}, err
	}

	if s.checker != nil && len(tw.Images()) > 0 {
		if err := s.checker.CheckImagesOwnedBy(ctx, tw.Images(), tw.AuthorID()); err != nil {
			return TweetDTO{}, err
		}
	}

	if err := s.repo.Save(ctx, tw); err != nil {
		return TweetDTO{}, err
	}
	s.publishEvents(ctx, tw.PullEvents())

	return s.toDTOs(ctx, []*domaintweet.Tweet{tw})[0], nil
}

// Delete 删除推文（物理删除，点赞/评论由 DB ON DELETE CASCADE 连带清理）。
//
// 鉴权：作者本人，或持 tweet:delete-any 权限者（内置超管通配短路）。
func (s *Service) Delete(ctx context.Context, id string) error {
	tw, err := s.findByID(ctx, id)
	if err != nil {
		return err
	}
	if !s.canDelete(ctx, tw) {
		return shared.Forbidden("无权删除他人推文")
	}
	if err := s.repo.Delete(ctx, tw.ID()); err != nil {
		return err
	}
	// 物理删除后聚合根不复存在，删除事件由应用层手动构造发布
	s.publishEvents(ctx, []shared.DomainEvent{domaintweet.NewTweetDeleted(tw)})
	return nil
}

// Like 点赞推文（登录）：重复点赞幂等。
func (s *Service) Like(ctx context.Context, userIDStr, tweetIDStr string) error {
	userID, err := shared.ParseID(userIDStr)
	if err != nil {
		return shared.BadRequest("非法的用户 ID")
	}
	tweetID, err := shared.ParseID(tweetIDStr)
	if err != nil {
		return shared.BadRequest("非法的推文 ID")
	}
	return s.repo.Like(ctx, tweetID, userID)
}

// Unlike 取消点赞推文（登录）：未点赞幂等，不报错。
func (s *Service) Unlike(ctx context.Context, userIDStr, tweetIDStr string) error {
	userID, err := shared.ParseID(userIDStr)
	if err != nil {
		return shared.BadRequest("非法的用户 ID")
	}
	tweetID, err := shared.ParseID(tweetIDStr)
	if err != nil {
		return shared.BadRequest("非法的推文 ID")
	}
	return s.repo.Unlike(ctx, tweetID, userID)
}

// --- 读用例 ---

// GetByID 查单条推文详情（公开）。
func (s *Service) GetByID(ctx context.Context, id string) (TweetDTO, error) {
	tw, err := s.findByID(ctx, id)
	if err != nil {
		return TweetDTO{}, err
	}
	return s.toDTOs(ctx, []*domaintweet.Tweet{tw})[0], nil
}

// ListTimeline 全局时间线（公开）：倒序 cursor 分页。
//
// 取 limit+1 条判定 hasMore：多取的第 limit+1 条仅用于探测「还有下一页」，
// 不下发给客户端；nextCursor 由本页末条生成。
func (s *Service) ListTimeline(ctx context.Context, cursorStr string, limit int) ([]TweetDTO, string, error) {
	cursor, err := s.decodeCursorOrNil(cursorStr)
	if err != nil {
		return nil, "", err
	}
	tweets, err := s.repo.FindTimeline(ctx, cursor, limit+1)
	if err != nil {
		return nil, "", err
	}
	dtos, nextCursor := s.buildPage(ctx, tweets, limit)
	return dtos, nextCursor, nil
}

// ListByTopic 话题时间线（公开）：按话题标签倒序 cursor 分页。
func (s *Service) ListByTopic(ctx context.Context, tag, cursorStr string, limit int) ([]TweetDTO, string, error) {
	tag = strings.TrimSpace(tag)
	if tag == "" {
		return []TweetDTO{}, "", nil
	}
	cursor, err := s.decodeCursorOrNil(cursorStr)
	if err != nil {
		return nil, "", err
	}
	tweets, err := s.repo.FindByTopic(ctx, tag, cursor, limit+1)
	if err != nil {
		return nil, "", err
	}
	dtos, nextCursor := s.buildPage(ctx, tweets, limit)
	return dtos, nextCursor, nil
}

// ListByUser 用户主页推文列表（公开）：按 username 解析作者后同构分页。
// 用户名不存在返回 404（用户主页对不存在用户应 404 而非空列表）。
func (s *Service) ListByUser(ctx context.Context, username, cursorStr string, limit int) ([]TweetDTO, string, error) {
	uname, err := domainuser.ParseUsername(username)
	if err != nil {
		return nil, "", shared.BadRequest("非法的用户名")
	}
	u, err := s.userRepo.FindByUsername(ctx, uname)
	if err != nil {
		return nil, "", err
	}

	cursor, err := s.decodeCursorOrNil(cursorStr)
	if err != nil {
		return nil, "", err
	}
	tweets, err := s.repo.FindByAuthor(ctx, u.GetID(), cursor, limit+1)
	if err != nil {
		return nil, "", err
	}
	dtos, nextCursor := s.buildPage(ctx, tweets, limit)
	return dtos, nextCursor, nil
}

// GetUserProfile 获取公开用户资料（公开）：按 username 查找用户并转化公开资料卡。
func (s *Service) GetUserProfile(ctx context.Context, username string) (UserProfileDTO, error) {
	uname, err := domainuser.ParseUsername(username)
	if err != nil {
		return UserProfileDTO{}, shared.BadRequest("非法的用户名")
	}
	u, err := s.userRepo.FindByUsername(ctx, uname)
	if err != nil {
		return UserProfileDTO{}, err
	}
	return UserProfileDTO{
		ID:          u.GetID().String(),
		Username:    u.Username().String(),
		DisplayName: u.DisplayName().String(),
		AvatarURL:   u.AvatarURL(),
		Bio:         u.Bio(),
		CreatedAt:   u.CreatedAt().Format(time.RFC3339),
	}, nil
}

// --- 内部辅助 ---

// findByID 解析 ID + 走 repo。
func (s *Service) findByID(ctx context.Context, id string) (*domaintweet.Tweet, error) {
	tid, err := shared.ParseID(id)
	if err != nil {
		return nil, err
	}
	return s.repo.FindByID(ctx, tid)
}

// canDelete 判断操作者是否有权删除指定推文。
//
// 放行规则（任一满足，与 post.canModify 同构）：
//   - 内置超管（通配短路）
//   - 操作者是推文作者（所有权放行）
//   - 操作者拥有 tweet:delete-any 权限码
func (s *Service) canDelete(ctx context.Context, tw *domaintweet.Tweet) bool {
	isBuiltin := middleware.GetUserIsRoot(ctx)
	if isBuiltin {
		return true
	}
	if opID := middleware.GetUserID(ctx); opID != "" && opID == tw.AuthorID().String() {
		return true
	}
	if s.perm == nil {
		return false
	}
	return s.perm.HasPermission(middleware.GetUserRole(ctx), isBuiltin, PermDeleteAny)
}

// decodeCursorOrNil 解码游标字符串；空串返回 nil（第一页）。
func (s *Service) decodeCursorOrNil(cursorStr string) (*domaintweet.Cursor, error) {
	if cursorStr == "" {
		return nil, nil
	}
	cursor, err := decodeCursor(cursorStr)
	if err != nil {
		return nil, err
	}
	return &cursor, nil
}

// buildPage 把 limit+1 探测结果裁剪成一页 DTO + nextCursor。
func (s *Service) buildPage(ctx context.Context, tweets []*domaintweet.Tweet, limit int) ([]TweetDTO, string) {
	hasMore := len(tweets) > limit
	if hasMore {
		tweets = tweets[:limit]
	}
	nextCursor := ""
	if hasMore && len(tweets) > 0 {
		last := tweets[len(tweets)-1]
		nextCursor = encodeCursor(domaintweet.Cursor{CreatedAt: last.CreatedAt(), ID: last.ID()})
	}
	return s.toDTOs(ctx, tweets), nextCursor
}

// toDTOs 领域实体 → DTO，批量填充作者资料（FindByIDs 一次查询避免 N+1）。
//
// 作者缺失时留零值 AuthorDTO：users 表 ON DELETE CASCADE 保证作者恒存在，
// 缺失只会是数据异常，此时不阻断时间线读取（降级展示）。
func (s *Service) toDTOs(ctx context.Context, tweets []*domaintweet.Tweet) []TweetDTO {
	quoteIDs := make([]shared.ID, 0, len(tweets))
	quoteSeen := make(map[string]bool)
	for _, tw := range tweets {
		if q := tw.QuoteOf(); q != nil {
			qs := q.String()
			if !quoteSeen[qs] {
				quoteSeen[qs] = true
				quoteIDs = append(quoteIDs, *q)
			}
		}
	}
	quotedTweetsMap := make(map[string]*domaintweet.Tweet)
	if len(quoteIDs) > 0 {
		if qts, err := s.repo.FindByIDs(ctx, quoteIDs); err == nil {
			for _, qt := range qts {
				quotedTweetsMap[qt.ID().String()] = qt
			}
		}
	}

	authorIDs := make([]shared.ID, 0, len(tweets))
	seen := make(map[string]bool, len(tweets))
	for _, tw := range tweets {
		id := tw.AuthorID()
		if !seen[id.String()] {
			seen[id.String()] = true
			authorIDs = append(authorIDs, id)
		}
	}
	for _, qt := range quotedTweetsMap {
		aid := qt.AuthorID()
		if !seen[aid.String()] {
			seen[aid.String()] = true
			authorIDs = append(authorIDs, aid)
		}
	}

	authors := make(map[string]AuthorDTO, len(authorIDs))
	if len(authorIDs) > 0 {
		users, err := s.userRepo.FindByIDs(ctx, authorIDs)
		if err != nil {
			// 作者资料填充失败不阻断时间线：降级为零值作者（列表可用性优先）
			log.Warn().Err(err).Msg("推文作者资料批量查询失败，降级为空资料")
		}
		for _, u := range users {
			authors[u.GetID().String()] = AuthorDTO{
				ID:        u.GetID().String(),
				Username:  u.Username().String(),
				AvatarURL: u.AvatarURL(),
			}
		}
	}

	var tIDs []shared.ID
	if len(tweets) > 0 {
		tIDs = make([]shared.ID, len(tweets))
		for i, tw := range tweets {
			tIDs[i] = tw.ID()
		}
	}

	likedMap := make(map[string]bool)
	currentUserID := middleware.GetUserID(ctx)
	if currentUserID != "" && len(tIDs) > 0 {
		if uid, err := shared.ParseID(currentUserID); err == nil {
			if lm, err := s.repo.FindLikedTweetIDs(ctx, uid, tIDs); err == nil {
				likedMap = lm
			}
		}
	}
	// 批量填充评论数（详情页/卡片展示）。commentRepo 为 nil（推文单测）时跳过。
	commentCountMap := make(map[string]int64)
	if s.commentRepo != nil && len(tIDs) > 0 {
		if cm, err := s.commentRepo.CountByTweetIDs(ctx, tIDs); err == nil {
			commentCountMap = cm
		}
	}
	// 批量填充被引用次数
	quoteCountMap := make(map[string]int64)
	if len(tIDs) > 0 {
		if qm, err := s.repo.CountQuotesByTweetIDs(ctx, tIDs); err == nil {
			quoteCountMap = qm
		}
	}

	// 批量查表构建 emote 表情映射（推文正文与被引用推文正文）
	allEmoteMap := make(map[string]EmojiRef)
	if s.emojiLookup != nil && (len(tweets) > 0 || len(quotedTweetsMap) > 0) {
		nameSet := make(map[string]bool)
		for _, tw := range tweets {
			collectEmojiNames(tw.Content(), nameSet)
		}
		for _, qt := range quotedTweetsMap {
			collectEmojiNames(qt.Content(), nameSet)
		}
		if len(nameSet) > 0 {
			names := make([]string, 0, len(nameSet))
			for n := range nameSet {
				names = append(names, n)
			}
			if em, err := s.emojiLookup.FindByNames(ctx, names); err == nil {
				allEmoteMap = em
			} else {
				log.Warn().Err(err).Msg("推文表情批量查询失败，降级为空表情")
			}
		}
	}

	dtos := make([]TweetDTO, 0, len(tweets))
	for _, tw := range tweets {
		var quoteOfStr *string
		var quotedTweetDTO *QuotedTweetDTO
		if q := tw.QuoteOf(); q != nil {
			qs := q.String()
			quoteOfStr = &qs
			if qt, ok := quotedTweetsMap[qs]; ok {
				quotedTweetDTO = &QuotedTweetDTO{
					ID:         qt.ID().String(),
					Author:     authors[qt.AuthorID().String()],
					Content:    qt.Content(),
					Images:     qt.Images(),
					Emote:      filterEmoteForBody(qt.Content(), allEmoteMap),
					QuoteCount: int(quoteCountMap[qt.ID().String()]),
					CreatedAt:  qt.CreatedAt().UTC().Format(time.RFC3339),
				}
			}
		}

		dtos = append(dtos, TweetDTO{
			ID:           tw.ID().String(),
			Author:       authors[tw.AuthorID().String()],
			Content:      tw.Content(),
			Images:       tw.Images(),
			Emote:        filterEmoteForBody(tw.Content(), allEmoteMap),
			LikeCount:    tw.LikeCount(),
			IsLiked:      likedMap[tw.ID().String()],
			CommentCount: int(commentCountMap[tw.ID().String()]),
			QuoteCount:   int(quoteCountMap[tw.ID().String()]),
			QuoteOf:      quoteOfStr,
			QuotedTweet:  quotedTweetDTO,
			CreatedAt:    tw.CreatedAt().UTC().Format(time.RFC3339),
		})
	}
	return dtos
}

// publishEvents 发布领域事件。失败仅记日志不阻断主流程（与 announcement 一致）；
// bus 为 nil（测试场景未注入）时跳过。
func (s *Service) publishEvents(ctx context.Context, events []shared.DomainEvent) {
	if s.bus == nil || len(events) == 0 {
		return
	}
	if err := s.bus.Publish(ctx, events); err != nil {
		log.Warn().Err(err).Msg("推文领域事件发布失败")
	}
}

// --- 推文评论（P2 / issue #107）---

// EmojiRef 表情映射值（emote map 的 value）。
// 前端渲染 body 中的 [name] 占位符时查此表，优先使用 GifURL。
// Size 携带表情尺寸（1=小 2=大），供前端按尺寸渲染内联表情。
// CustomEmojiID/Relation 仅自定义表情（[name:uuid] token）非空，供前端挂右键菜单
// （PRD-0020：Relation 取值 owned/favorited/none，决定菜单项是删除/移出/收藏）。
type EmojiRef struct {
	URL           string `json:"url"`
	GifURL        string `json:"gif_url,omitempty"`
	Size          int    `json:"size,omitempty"`
	CustomEmojiID string `json:"custom_emoji_id,omitempty"`
	Relation      string `json:"relation,omitempty"`
}

// EmojiLookup 表情批量查找端口（application 层端口）。
// 评论 toDTO 后解析 body 中的 [name] 占位符，批量查表构建 emote 映射
// （与 comment 域 enrichEmotes 同构；实现方在 infrastructure 层）。
type EmojiLookup interface {
	FindByNames(ctx context.Context, names []string) (map[string]EmojiRef, error)
}

// CommentDTO 推文评论读模型。
type CommentDTO struct {
	ID      string    `json:"id"`
	TweetID string    `json:"tweet_id"`
	Author  AuthorDTO `json:"author"`
	Body    string    `json:"body"`
	// Pictures 评论附图（Bilibili 式，url/width/height/size）；无图恒为空数组
	Pictures []domaintweet.Picture `json:"pictures"`
	// Emote 表情映射表。key 为 [name]（含方括号），value 为表情图片 URL。
	// toDTO 后由 enrichEmotes 批量填充。body 中没有 [name] 时为 nil（JSON 省略）。
	Emote map[string]EmojiRef `json:"emote,omitempty"`
	// ParentID 被回复的评论 id；顶层评论省略（omitempty）
	ParentID string `json:"parent_id,omitempty"`
	Depth    int16  `json:"depth"`
	// RepliesCount 该评论的回复数；顶层评论列表批量统计，回复恒 0
	RepliesCount int64 `json:"replies_count"`
	// CreatedAt RFC3339 格式
	CreatedAt string `json:"created_at"`
}

// CreateCommentInput 创建评论入参。
type CreateCommentInput struct {
	TweetID string
	// AuthorID 当前登录用户 ID（handler 从 session ctx 提取）
	AuthorID string
	Body     string
	// Pictures 评论附图（可选）。URL 归属校验通过 TweetImageChecker 端口。
	Pictures []domaintweet.Picture
	// ParentID 被回复的评论 id；空串=顶层评论
	ParentID string
}

// PictureInput 评论附图请求 DTO（handler 层接收的 JSON 形态，转成 domain.Picture）。
type PictureInput struct {
	URL    string `json:"url"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
	Size   int64  `json:"size"`
}

// PicturesToDomain 切片转换：[]PictureInput → []domaintweet.Picture。
func PicturesToDomain(in []PictureInput) []domaintweet.Picture {
	if len(in) == 0 {
		return nil
	}
	out := make([]domaintweet.Picture, len(in))
	for i, p := range in {
		out[i] = domaintweet.Picture{URL: p.URL, Width: p.Width, Height: p.Height, Size: p.Size}
	}
	return out
}

// CreateComment 创建评论或回复（登录，即发即出：无审核状态机）。
//
// 编排：校验推文存在 → 领域工厂（不变量）→ 若有 parent 校验同推文且设回复层级 → Save。
func (s *Service) CreateComment(ctx context.Context, in CreateCommentInput) (CommentDTO, error) {
	if s.commentRepo == nil {
		return CommentDTO{}, errCommentRepoNotInjected
	}
	tweetID, err := shared.ParseID(in.TweetID)
	if err != nil {
		return CommentDTO{}, shared.BadRequest("非法的推文 ID")
	}
	authorID, err := shared.ParseID(in.AuthorID)
	if err != nil {
		return CommentDTO{}, shared.BadRequest("非法的用户 ID")
	}
	// 推文必须存在（评论挂推文下，推文删了不可评论）
	if _, err := s.repo.FindByID(ctx, tweetID); err != nil {
		return CommentDTO{}, err
	}

	c, err := domaintweet.NewComment(tweetID, authorID, in.Body)
	if err != nil {
		return CommentDTO{}, err
	}

	// 附图接线：数量不变量在聚合根（SetPictures），URL 归属走 upload 域校验
	// （防越权引用他人上传文件，与发推文 Create 的 checker 校验同构）。
	if err := c.SetPictures(in.Pictures); err != nil {
		return CommentDTO{}, err
	}
	if s.checker != nil && len(c.Pictures()) > 0 {
		urls := make([]string, len(c.Pictures()))
		for i, p := range c.Pictures() {
			urls[i] = p.URL
		}
		if err := s.checker.CheckImagesOwnedBy(ctx, urls, authorID); err != nil {
			return CommentDTO{}, err
		}
	}

	if in.ParentID != "" {
		parentID, err := shared.ParseID(in.ParentID)
		if err != nil {
			return CommentDTO{}, shared.BadRequest("非法的父评论 ID")
		}
		parent, err := s.commentRepo.FindByID(ctx, parentID)
		if err != nil {
			return CommentDTO{}, err
		}
		// 跨推文回复非法：parent 必须与当前评论同属一条推文
		if parent.TweetID() != tweetID {
			return CommentDTO{}, shared.BadRequest("父评论不属于该推文")
		}
		if err := c.SetParent(parent); err != nil {
			return CommentDTO{}, err
		}
	} else {
		_ = c.SetParent(nil)
	}

	if err := s.commentRepo.Save(ctx, c); err != nil {
		return CommentDTO{}, err
	}
	dto := s.commentsToDTOs(ctx, []*domaintweet.Comment{c})[0]
	if err := s.enrichSingleEmote(ctx, &dto); err != nil {
		return CommentDTO{}, err
	}
	return dto, nil
}

// DeleteComment 删除评论（物理删除；顶层评论的回复由 parent_id 自引用
// ON DELETE CASCADE 连带清理）。
//
// 鉴权：评论作者本人，或持 tweet:delete-any 权限者（内置超管通配短路）——
// 与推文删除同构，复用同一权限码（推文模块管理员管理全部推文内容）。
func (s *Service) DeleteComment(ctx context.Context, id string) error {
	if s.commentRepo == nil {
		return errCommentRepoNotInjected
	}
	cid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	c, err := s.commentRepo.FindByID(ctx, cid)
	if err != nil {
		return err
	}
	if !s.canDeleteComment(ctx, c) {
		return shared.Forbidden("无权删除他人评论")
	}
	return s.commentRepo.Delete(ctx, cid)
}

// ListComments 列出推文下的顶层评论（公开，page/limit 分页，最新在前）。
func (s *Service) ListComments(ctx context.Context, tweetIDStr string, page, limit int) ([]CommentDTO, int64, error) {
	if s.commentRepo == nil {
		return nil, 0, errCommentRepoNotInjected
	}
	tweetID, err := shared.ParseID(tweetIDStr)
	if err != nil {
		return nil, 0, shared.BadRequest("非法的推文 ID")
	}
	result, err := s.commentRepo.FindPage(ctx, domaintweet.ListFilter{TweetID: &tweetID},
		shared.PageQuery{Page: page, Limit: limit}.Normalize())
	if err != nil {
		return nil, 0, err
	}
	comments := result.Items
	dtos := s.commentsToDTOs(ctx, comments)
	if err := s.attachRepliesCount(ctx, comments, dtos); err != nil {
		return nil, 0, err
	}
	if err := s.enrichEmotes(ctx, dtos); err != nil {
		return nil, 0, err
	}
	return dtos, result.Total, nil
}

// attachRepliesCount 批量填充顶层评论的回复数（一次 GROUP BY 查询，避免 N+1）。
func (s *Service) attachRepliesCount(ctx context.Context, comments []*domaintweet.Comment, dtos []CommentDTO) error {
	if s.commentRepo == nil || len(comments) == 0 {
		return nil
	}
	ids := make([]shared.ID, 0, len(comments))
	for _, c := range comments {
		ids = append(ids, c.ID())
	}
	counts, err := s.commentRepo.CountRepliesByParents(ctx, ids)
	if err != nil {
		return err
	}
	for i := range dtos {
		dtos[i].RepliesCount = counts[dtos[i].ID]
	}
	return nil
}

// ListReplies 列出某顶层评论下的回复（公开，page/limit 分页，最早在前）。
func (s *Service) ListReplies(ctx context.Context, parentIDStr string, page, limit int) ([]CommentDTO, int64, error) {
	if s.commentRepo == nil {
		return nil, 0, errCommentRepoNotInjected
	}
	parentID, err := shared.ParseID(parentIDStr)
	if err != nil {
		return nil, 0, shared.BadRequest("非法的评论 ID")
	}
	result, err := s.commentRepo.FindPage(ctx, domaintweet.ListFilter{ParentID: &parentID, Sort: "asc"},
		shared.PageQuery{Page: page, Limit: limit}.Normalize())
	if err != nil {
		return nil, 0, err
	}
	replies := result.Items
	dtos := s.commentsToDTOs(ctx, replies)
	if err := s.enrichEmotes(ctx, dtos); err != nil {
		return nil, 0, err
	}
	return dtos, result.Total, nil
}

// commentsToDTOs 领域评论 → DTO，批量填充作者资料（FindByIDs 一次查询避免 N+1）。
func (s *Service) commentsToDTOs(ctx context.Context, comments []*domaintweet.Comment) []CommentDTO {
	authorIDs := make([]shared.ID, 0, len(comments))
	seen := make(map[string]bool, len(comments))
	for _, c := range comments {
		id := c.AuthorID()
		if !seen[id.String()] {
			seen[id.String()] = true
			authorIDs = append(authorIDs, id)
		}
	}
	authors := make(map[string]AuthorDTO, len(authorIDs))
	if len(authorIDs) > 0 {
		users, err := s.userRepo.FindByIDs(ctx, authorIDs)
		if err != nil {
			log.Warn().Err(err).Msg("推文评论作者资料批量查询失败，降级为空资料")
		}
		for _, u := range users {
			authors[u.GetID().String()] = AuthorDTO{
				ID: u.GetID().String(), Username: u.Username().String(), AvatarURL: u.AvatarURL(),
			}
		}
	}
	dtos := make([]CommentDTO, 0, len(comments))
	for _, c := range comments {
		parentID := ""
		if p := c.ParentID(); p != nil {
			parentID = p.String()
		}
		dtos = append(dtos, CommentDTO{
			ID:        c.ID().String(),
			TweetID:   c.TweetID().String(),
			Author:    authors[c.AuthorID().String()],
			Body:      c.Body(),
			Pictures:  c.Pictures(),
			ParentID:  parentID,
			Depth:     c.Depth(),
			CreatedAt: c.CreatedAt().UTC().Format(time.RFC3339),
		})
	}
	return dtos
}

// canDeleteComment 判断操作者是否有权删除指定评论。
//
// 放行规则（任一满足，与推文删除同构）：
//   - 内置超管（通配短路）
//   - 操作者是评论作者（所有权放行）
//   - 操作者拥有 tweet:delete-any 权限码
func (s *Service) canDeleteComment(ctx context.Context, c *domaintweet.Comment) bool {
	isBuiltin := middleware.GetUserIsRoot(ctx)
	if isBuiltin {
		return true
	}
	if opID := middleware.GetUserID(ctx); opID != "" && opID == c.AuthorID().String() {
		return true
	}
	if s.perm == nil {
		return false
	}
	return s.perm.HasPermission(middleware.GetUserRole(ctx), isBuiltin, PermDeleteAny)
}

// errCommentRepoNotInjected 评论仓储未注入（仅测试场景未传 commentRepo 时触发）。
var errCommentRepoNotInjected = shared.Internal("评论仓储未注入", nil)

// emojiBodyPattern 匹配 body 中的 [name] 表情占位符（含方括号）。
var emojiBodyPattern = regexp.MustCompile(`\[([^\]]+)\]`)

// collectEmojiNames 将 body 中所有 [name] 占位符加入 set（key 含方括号，如 "[doge]"）。
func collectEmojiNames(body string, set map[string]bool) {
	for _, m := range emojiBodyPattern.FindAllString(body, -1) {
		set[m] = true
	}
}

// filterEmoteForBody 从全量 emote 表中筛出 body 实际用到的表情。
func filterEmoteForBody(body string, all map[string]EmojiRef) map[string]EmojiRef {
	if len(all) == 0 {
		return nil
	}
	var result map[string]EmojiRef
	for _, m := range emojiBodyPattern.FindAllString(body, -1) {
		if ref, ok := all[m]; ok {
			if result == nil {
				result = make(map[string]EmojiRef)
			}
			result[m] = ref
		}
	}
	return result
}

// enrichEmotes 批量填充 DTO 切片的 Emote 字段（ListComments / ListReplies 路径）。
// 从所有 body 中提取唯一 [name]，一次批量查表，逐个按 body 过滤填充。
func (s *Service) enrichEmotes(ctx context.Context, dtos []CommentDTO) error {
	if s.emojiLookup == nil || len(dtos) == 0 {
		return nil
	}
	nameSet := make(map[string]bool)
	for i := range dtos {
		collectEmojiNames(dtos[i].Body, nameSet)
	}
	if len(nameSet) == 0 {
		return nil
	}
	names := make([]string, 0, len(nameSet))
	for n := range nameSet {
		names = append(names, n)
	}
	emoteMap, err := s.emojiLookup.FindByNames(ctx, names)
	if err != nil {
		return err
	}
	for i := range dtos {
		dtos[i].Emote = filterEmoteForBody(dtos[i].Body, emoteMap)
	}
	return nil
}

// enrichSingleEmote 单条 DTO 富化（CreateComment 返回路径）。
func (s *Service) enrichSingleEmote(ctx context.Context, dto *CommentDTO) error {
	if s.emojiLookup == nil {
		return nil
	}
	nameSet := make(map[string]bool)
	collectEmojiNames(dto.Body, nameSet)
	if len(nameSet) == 0 {
		return nil
	}
	names := make([]string, 0, len(nameSet))
	for n := range nameSet {
		names = append(names, n)
	}
	emoteMap, err := s.emojiLookup.FindByNames(ctx, names)
	if err != nil {
		return err
	}
	dto.Emote = filterEmoteForBody(dto.Body, emoteMap)
	return nil
}
