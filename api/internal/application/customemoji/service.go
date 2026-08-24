package customemoji

import (
	"context"
	"net/url"
	"path"
	"regexp"
	"strings"
	"time"

	appshared "blog-api/internal/application/shared"
	domain "blog-api/internal/domain/customemoji"
	"blog-api/internal/domain/shared"
	"blog-api/internal/middleware"
)

// Relation 表示 viewer 与某个自定义表情的关系，决定全站右键菜单展示哪一项：
// owned→「删除表情」；favorited→「移出我的表情」；none→「收藏到我的表情」。
type Relation string

const (
	RelationOwned     Relation = "owned"
	RelationFavorited Relation = "favorited"
	RelationNone      Relation = "none"
)

// ErrInvalidURL 上传结果不是允许的本地表情图片地址。
var ErrInvalidURL = shared.BadRequest("自定义表情图片地址无效")

var customEmojiTokenPattern = regexp.MustCompile(`\[([^\]]+)\]`)

// CustomEmojiRef 表情解析结果（共享 resolver 的返回值），供 comment/tweet/chat
// 三域的 adapter 各自转换成本域 DTO 形态。
type CustomEmojiRef struct {
	URL      string
	OwnerID  shared.ID
	Relation Relation
}

// CustomEmojiDTO 自定义表情读模型（我的表情 tab 用）。
type CustomEmojiDTO struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	URL  string `json:"url"`
}

// MineDTO 「我的表情」聚合读模型：GET /custom-emojis/mine 响应。
type MineDTO struct {
	Owned     []CustomEmojiDTO `json:"owned"`
	Favorited []CustomEmojiDTO `json:"favorited"`
}

// Service 自定义表情用例服务。
type Service struct {
	repo           domain.Repository
	quota          QuotaPolicy
	perm           PermissionChecker
	emojiURLPrefix string
}

// NewService 构造自定义表情用例服务。
// emojiURLPrefix 为空时跳过 URL 路径校验，仅供不涉及 HTTP 装配的单元测试使用。
func NewService(repo domain.Repository, quota QuotaPolicy, perm PermissionChecker, emojiURLPrefix string) *Service {
	return &Service{repo: repo, quota: quota, perm: perm, emojiURLPrefix: emojiURLPrefix}
}

// CreateInput 上传自定义表情入参。
type CreateInput struct {
	OwnerID shared.ID
	Name    string
	URL     string
}

// Create 上传自定义表情。
//
// 校验顺序：同 owner 下同名唯一（先查重，给出更精确的错误）→ 份额（自传+收藏
// 合计）未超上限。DB 唯一索引兜底并发场景下的竞态重名。
func (s *Service) Create(ctx context.Context, in CreateInput) (CustomEmojiDTO, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return CustomEmojiDTO{}, domain.ErrEmptyName
	}
	if err := validateEmojiURL(in.URL, s.emojiURLPrefix); err != nil {
		return CustomEmojiDTO{}, err
	}
	exists, err := s.repo.ExistsByOwnerAndName(ctx, in.OwnerID, name)
	if err != nil {
		return CustomEmojiDTO{}, err
	}
	if exists {
		return CustomEmojiDTO{}, domain.ErrNameExists
	}
	maxPerUser, err := s.quota.MaxPerUser(ctx)
	if err != nil {
		return CustomEmojiDTO{}, err
	}
	e, err := domain.NewCustomEmoji(in.OwnerID, name, in.URL, time.Now())
	if err != nil {
		return CustomEmojiDTO{}, err
	}
	if atomicRepo, ok := s.repo.(domain.QuotaRepository); ok {
		if err := atomicRepo.SaveWithQuota(ctx, e, int64(maxPerUser)); err != nil {
			return CustomEmojiDTO{}, err
		}
	} else {
		if err := s.checkQuotaAt(ctx, in.OwnerID, int64(maxPerUser)); err != nil {
			return CustomEmojiDTO{}, err
		}
		if err := s.repo.Save(ctx, e); err != nil {
			return CustomEmojiDTO{}, err
		}
	}
	return toDTO(e), nil
}
func validateEmojiURL(value, prefix string) error {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 512 {
		return ErrInvalidURL
	}
	if prefix == "" {
		return nil
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.IsAbs() || parsed.Host != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return ErrInvalidURL
	}
	cleanPath := path.Clean(parsed.Path)
	expectedPrefix := strings.TrimRight(prefix, "/") + "/emojis/"
	if cleanPath != parsed.Path || !strings.HasPrefix(cleanPath, expectedPrefix) {
		return ErrInvalidURL
	}
	switch strings.ToLower(path.Ext(cleanPath)) {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp":
		return nil
	default:
		return ErrInvalidURL
	}
}

// Delete 删除自定义表情（软删除）。
//
// 鉴权（与 apptweet.Service.canDelete 同构）：actor 是 owner 本人，或持有
// customemoji:manage 权限（内置超管通配短路）——放行任意用户的强制下架。
func (s *Service) Delete(ctx context.Context, emojiID shared.ID) error {
	e, err := s.repo.FindByID(ctx, emojiID)
	if err != nil {
		return err
	}
	if !s.canDelete(ctx, e) {
		return shared.Forbidden("无权删除该表情")
	}
	e.Delete(time.Now())
	return s.repo.Delete(ctx, e)
}

func (s *Service) canDelete(ctx context.Context, e *domain.CustomEmoji) bool {
	isRoot := middleware.GetUserIsRoot(ctx)
	if isRoot {
		return true
	}
	if actorID := middleware.GetUserID(ctx); actorID != "" && actorID == e.OwnerID().String() {
		return true
	}
	if s.perm == nil {
		return false
	}
	return s.perm.HasPermission(middleware.GetUserRole(ctx), isRoot, ManagePermission)
}

// ListMine 列出用户自己拥有和收藏的自定义表情（EmojiPicker「我的表情」tab 用）。
func (s *Service) ListMine(ctx context.Context, userID shared.ID) (MineDTO, error) {
	owned, err := s.repo.ListOwned(ctx, userID)
	if err != nil {
		return MineDTO{}, err
	}
	favorited, err := s.repo.ListFavorited(ctx, userID)
	if err != nil {
		return MineDTO{}, err
	}
	return MineDTO{Owned: toDTOs(owned), Favorited: toDTOs(favorited)}, nil
}

// ValidateContent 校验正文中的自定义表情均属于当前用户或其收藏。
func (s *Service) ValidateContent(ctx context.Context, content string, viewerID shared.ID) error {
	var ids []shared.ID
	seen := make(map[shared.ID]struct{})
	for _, token := range customEmojiTokenPattern.FindAllString(content, -1) {
		if len(token) < 2 {
			continue
		}
		id, ok := appshared.ParseCustomEmojiToken(token[1 : len(token)-1])
		if !ok {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return nil
	}
	refs, err := s.ResolveByIDs(ctx, ids, viewerID)
	if err != nil {
		return err
	}
	for _, id := range ids {
		ref, ok := refs[id]
		if !ok || (ref.Relation != RelationOwned && ref.Relation != RelationFavorited) {
			return shared.Forbidden("无权使用该自定义表情")
		}
	}
	return nil
}

// Favorite 收藏一个表情（引用式，非拷贝）。
//
// 拒绝收藏自己上传的表情（无意义操作）；拒绝超份额（owned+favorited 合计）；
// 已收藏过重复调用幂等（不重复计份额、不报错）。
func (s *Service) Favorite(ctx context.Context, userID, emojiID shared.ID) error {
	e, err := s.repo.FindByID(ctx, emojiID)
	if err != nil {
		return err
	}
	if !e.IsUsable() {
		return domain.ErrNotFound
	}
	if e.OwnerID().Equal(userID) {
		return domain.ErrFavoriteOwnEmoji
	}
	already, err := s.repo.IsFavorited(ctx, userID, emojiID)
	if err != nil {
		return err
	}
	if already {
		return nil
	}
	maxPerUser, err := s.quota.MaxPerUser(ctx)
	if err != nil {
		return err
	}
	if atomicRepo, ok := s.repo.(domain.QuotaRepository); ok {
		return atomicRepo.AddFavoriteWithQuota(ctx, userID, emojiID, int64(maxPerUser))
	}
	if err := s.checkQuotaAt(ctx, userID, int64(maxPerUser)); err != nil {
		return err
	}
	return s.repo.AddFavorite(ctx, userID, emojiID)
}

// Unfavorite 移出收藏（幂等：未收藏不报错）。
func (s *Service) Unfavorite(ctx context.Context, userID, emojiID shared.ID) error {
	return s.repo.RemoveFavorite(ctx, userID, emojiID)
}

// checkQuotaAt 校验当前份额（自传+收藏合计）未超上限。
func (s *Service) checkQuotaAt(ctx context.Context, userID shared.ID, maxPerUser int64) error {
	owned, err := s.repo.CountOwned(ctx, userID)
	if err != nil {
		return err
	}
	favorited, err := s.repo.CountFavorited(ctx, userID)
	if err != nil {
		return err
	}
	if owned+favorited >= maxPerUser {
		return domain.ErrQuotaExceeded
	}
	return nil
}

// ResolveByIDs 批量按 ID 解析自定义表情引用，供 comment/tweet/chat 三域共享
// （评论/推文的 adapter、聊天的 CustomEmojiResolver 均调用本方法）。
//
// 下架/不存在的 ID 静默跳过，不出现在返回 map 中——调用方据此判定「未命中」，
// 前端渲染回退到占位文本，不报错。viewerID 为零值（匿名/未知 viewer）时
// relation 恒为 none。
func (s *Service) ResolveByIDs(ctx context.Context, ids []shared.ID, viewerID shared.ID) (map[shared.ID]CustomEmojiRef, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	emojis, err := s.repo.FindByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	if len(emojis) == 0 {
		return nil, nil
	}
	var favoritedIDs map[shared.ID]bool
	if !viewerID.IsZero() {
		favoritedIDs, err = s.repo.FindFavoritedIDs(ctx, viewerID, ids)
		if err != nil {
			return nil, err
		}
	}
	result := make(map[shared.ID]CustomEmojiRef, len(emojis))
	for _, e := range emojis {
		relation := RelationNone
		switch {
		case e.OwnerID().Equal(viewerID):
			relation = RelationOwned
		case favoritedIDs[e.ID()]:
			relation = RelationFavorited
		}
		result[e.ID()] = CustomEmojiRef{URL: e.URL(), OwnerID: e.OwnerID(), Relation: relation}
	}
	return result, nil
}

func toDTO(e *domain.CustomEmoji) CustomEmojiDTO {
	return CustomEmojiDTO{ID: e.ID().String(), Name: e.Name(), URL: e.URL()}
}

func toDTOs(emojis []*domain.CustomEmoji) []CustomEmojiDTO {
	out := make([]CustomEmojiDTO, 0, len(emojis))
	for _, e := range emojis {
		out = append(out, toDTO(e))
	}
	return out
}
