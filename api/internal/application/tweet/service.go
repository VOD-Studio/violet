// Package tweet 提供推文用例服务（application 层）。
//
// 承载推文的发/删/读：即发即出（Create 无审核状态机）、不可编辑（无 Update 用例）、
// 物理删除（Delete 直接清行，点赞/评论由 DB 级联）。
// 删除鉴权（作者本人或 tweet:delete-any）在应用层做（与 post.canModify 同构：
// 所有权 OR 权限码的双重判定无法由路由中间件单一表达）。
//
// 依赖方向：Service → domain 端口（TweetRepository / UserRepository），
// 图片归属校验通过 TweetImageChecker 端口反转依赖 upload 域。
package tweet

import (
	"context"
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
	repo     domaintweet.TweetRepository
	userRepo domainuser.UserRepository
	checker  TweetImageChecker
	perm     TweetPermissionChecker
	bus      appshared.EventBus
}

// NewService 构造服务。
// checker 为 nil 时跳过图片归属校验（仅限测试场景；生产容器必须注入）。
// perm 为 nil 时仅作者本人可删（无权限码放行路径）。
func NewService(
	repo domaintweet.TweetRepository,
	userRepo domainuser.UserRepository,
	checker TweetImageChecker,
	perm TweetPermissionChecker,
	bus appshared.EventBus,
) *Service {
	return &Service{repo: repo, userRepo: userRepo, checker: checker, perm: perm, bus: bus}
}

// --- 输入/输出 DTO ---

// CreateInput 发推文入参。
type CreateInput struct {
	// AuthorID 作者（当前登录用户 ID，handler 从 session ctx 提取）
	AuthorID string
	Content  string
	Images   []string
}

// AuthorDTO 推文作者资料卡（时间线/详情页展示用）。
type AuthorDTO struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatar_url"`
}

// UserProfileDTO 用户公开资料卡（公开，仅包含不敏感的非私域字段）。
type UserProfileDTO struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatar_url"`
	Bio       string `json:"bio"`
	CreatedAt string `json:"created_at"`
}

// TweetDTO 推文读模型（序列化跨层传输）。
type TweetDTO struct {
	ID        string    `json:"id"`
	Author    AuthorDTO `json:"author"`
	Content   string    `json:"content"`
	Images    []string  `json:"images"`
	LikeCount int       `json:"like_count"`
	// CreatedAt RFC3339 格式
	CreatedAt string `json:"created_at"`
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

	tw, err := domaintweet.NewTweet(authorID, in.Content, in.Images)
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
		ID:        u.GetID().String(),
		Username:  u.Username().String(),
		AvatarURL: u.AvatarURL(),
		Bio:       u.Bio(),
		CreatedAt: u.CreatedAt().Format(time.RFC3339),
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
	isBuiltin := middleware.GetUserIsBuiltinSuperAdmin(ctx)
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
	authorIDs := make([]shared.ID, 0, len(tweets))
	seen := make(map[string]bool, len(tweets))
	for _, tw := range tweets {
		id := tw.AuthorID()
		if !seen[id.String()] {
			seen[id.String()] = true
			authorIDs = append(authorIDs, id)
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

	dtos := make([]TweetDTO, 0, len(tweets))
	for _, tw := range tweets {
		dtos = append(dtos, TweetDTO{
			ID:        tw.ID().String(),
			Author:    authors[tw.AuthorID().String()],
			Content:   tw.Content(),
			Images:    tw.Images(),
			LikeCount: tw.LikeCount(),
			CreatedAt: tw.CreatedAt().UTC().Format(time.RFC3339),
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
