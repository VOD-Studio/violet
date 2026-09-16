// Package chatappearance 编排公开聊天外观读取与仅限本人的偏好写入。
package chatappearance

import (
	"context"
	"errors"
	"fmt"

	domain "blog-api/internal/domain/chatappearance"
)

// Service 不持有进程级用户状态;鉴权由 HTTP 边界完成。
type Service struct {
	store  domain.Store
	badges domain.BadgeStore
}

// NewService 注入外观偏好与徽章持有两个存储。
func NewService(store domain.Store, badges domain.BadgeStore) *Service {
	return &Service{store: store, badges: badges}
}

// Get 返回用户当前生效的外观;佩戴徽章与持有台账求交集,被撤销的徽章不再出现。
func (s *Service) Get(ctx context.Context, actorID string) (domain.State, error) {
	if !domain.ValidUserID(actorID) {
		return domain.State{}, domain.ErrInvalid
	}
	state, err := s.store.Get(ctx, actorID)
	if err != nil {
		return domain.State{}, err
	}
	grants, err := s.badges.Grants(ctx, actorID)
	if err != nil {
		return domain.State{}, err
	}
	state.BadgeIDs = filterOwned(state.BadgeIDs, grantBadgeIDs(grants))
	return state, nil
}

// Update 全量替换选择,带乐观并发保护。
func (s *Service) Update(ctx context.Context, actorID string, selection domain.Selection, revision int64) (domain.State, error) {
	if !domain.ValidUserID(actorID) || revision < 0 || revision > domain.MaxRevision {
		return domain.State{}, domain.ErrInvalid
	}
	if err := selection.Validate(); err != nil {
		return domain.State{}, err
	}
	grants, err := s.badges.Grants(ctx, actorID)
	if err != nil {
		return domain.State{}, err
	}
	if missing := missingBadges(selection.BadgeIDs, grantBadgeIDs(grants)); len(missing) > 0 {
		return domain.State{}, fmt.Errorf("%w: 未持有徽章 %v", domain.ErrInvalid, missing)
	}
	state, err := s.store.CompareAndSwap(ctx, actorID, selection, revision)
	if !errors.Is(err, domain.ErrConflict) {
		return state, err
	}
	// 传输层重试可能在响应丢失后重放已成功的 PUT:仅当已存内容与本次完全一致
	// 且版本号恰好是下一个时,视为同一次保存,返回成功。
	current, readErr := s.store.Get(ctx, actorID)
	if readErr != nil {
		return domain.State{}, readErr
	}
	if current.Revision == revision+1 && current.Equal(selection) {
		return current, nil
	}
	return domain.State{}, domain.ErrConflict
}

// List 只返回公开装饰,不含私有账号数据或他人的版本号;徽章同样按持有交集过滤。
func (s *Service) List(ctx context.Context, ids []string) (map[string]domain.Selection, error) {
	if len(ids) == 0 || len(ids) > domain.MaxBatch {
		return nil, domain.ErrInvalid
	}
	unique := make([]string, 0, len(ids))
	seen := make(map[string]bool, len(ids))
	for _, id := range ids {
		if !domain.ValidUserID(id) {
			return nil, fmt.Errorf("%w: user_ids", domain.ErrInvalid)
		}
		if !seen[id] {
			unique = append(unique, id)
			seen[id] = true
		}
	}
	selections, err := s.store.GetMany(ctx, unique)
	if err != nil {
		return nil, err
	}
	grantsByUser, err := s.badges.GrantsForUsers(ctx, unique)
	if err != nil {
		return nil, err
	}
	for id, selection := range selections {
		selection.BadgeIDs = filterOwned(selection.BadgeIDs, grantsByUser[id])
		selections[id] = selection
	}
	return selections, nil
}

// MyBadges 返回本人徽章持有记录,按授予时间升序。
func (s *Service) MyBadges(ctx context.Context, actorID string) ([]domain.BadgeGrant, error) {
	if !domain.ValidUserID(actorID) {
		return nil, domain.ErrInvalid
	}
	return s.badges.Grants(ctx, actorID)
}

// GrantsOf 返回指定用户的持有记录,供管理端查看。
func (s *Service) GrantsOf(ctx context.Context, userID string) ([]domain.BadgeGrant, error) {
	if !domain.ValidUserID(userID) {
		return nil, domain.ErrInvalid
	}
	return s.badges.Grants(ctx, userID)
}

// Grant 由持有 chat:manage 权限的管理员批量授予徽章;已持有的 ID 静默跳过,数量不限佩戴上限。
func (s *Service) Grant(ctx context.Context, operatorID, userID string, badgeIDs []string) error {
	if !domain.ValidUserID(operatorID) || !domain.ValidUserID(userID) || len(badgeIDs) == 0 {
		return domain.ErrInvalid
	}
	if err := domain.ValidateBadgeIDs(badgeIDs); err != nil {
		return err
	}
	return s.badges.Grant(ctx, operatorID, userID, badgeIDs)
}

// Revoke 撤销一枚徽章;展示侧因读取交集在下次查询自动消失。
func (s *Service) Revoke(ctx context.Context, userID, badgeID string) error {
	if !domain.ValidUserID(userID) {
		return domain.ErrInvalid
	}
	if err := domain.ValidateBadgeIDs([]string{badgeID}); err != nil {
		return err
	}
	return s.badges.Revoke(ctx, userID, badgeID)
}

// filterOwned 按原顺序保留已持有的佩戴项;恒返回非 nil 切片,序列化时稳定为 []。
func filterOwned(selection []string, owned []string) []string {
	kept := make([]string, 0, len(selection))
	if len(selection) == 0 || len(owned) == 0 {
		return kept
	}
	set := make(map[string]struct{}, len(owned))
	for _, id := range owned {
		set[id] = struct{}{}
	}
	for _, id := range selection {
		if _, ok := set[id]; ok {
			kept = append(kept, id)
		}
	}
	return kept
}

// missingBadges 返回佩戴列表中未被持有的徽章 ID,用于保存前的持有校验。
func missingBadges(selection []string, owned []string) []string {
	set := make(map[string]struct{}, len(owned))
	for _, id := range owned {
		set[id] = struct{}{}
	}
	var missing []string
	for _, id := range selection {
		if _, ok := set[id]; !ok {
			missing = append(missing, id)
		}
	}
	return missing
}

// grantBadgeIDs 提取持有记录中的徽章 ID。
func grantBadgeIDs(grants []domain.BadgeGrant) []string {
	ids := make([]string, 0, len(grants))
	for _, grant := range grants {
		ids = append(ids, grant.BadgeID)
	}
	return ids
}
