package chatappearance

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	domain "blog-api/internal/domain/chatappearance"
)

const userA = "11111111-1111-4111-8111-111111111111"
const userB = "22222222-2222-4222-8222-222222222222"
const operator = "33333333-3333-4333-8333-333333333333"

type memoryStore struct {
	mu         sync.Mutex
	rows       map[string]domain.State
	batchCalls int
	lastBatch  []string
}

func newMemoryStore() *memoryStore { return &memoryStore{rows: map[string]domain.State{}} }
func (s *memoryStore) Get(ctx context.Context, id string) (domain.State, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return domain.State{}, err
	}
	return s.rows[id], nil
}
func (s *memoryStore) GetMany(ctx context.Context, ids []string) (map[string]domain.Selection, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	s.batchCalls++
	s.lastBatch = append([]string(nil), ids...)
	r := map[string]domain.Selection{}
	for _, id := range ids {
		r[id] = s.rows[id].Selection
	}
	return r, nil
}
func (s *memoryStore) CompareAndSwap(ctx context.Context, id string, v domain.Selection, expected int64) (domain.State, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return domain.State{}, err
	}
	if s.rows[id].Revision != expected {
		return domain.State{}, domain.ErrConflict
	}
	next := domain.State{Selection: v, Revision: expected + 1}
	s.rows[id] = next
	return next, nil
}

type memoryBadgeStore struct {
	mu      sync.Mutex
	grants  map[string][]domain.BadgeGrant
	calls   int
	revoked int
}

func newMemoryBadgeStore() *memoryBadgeStore {
	return &memoryBadgeStore{grants: map[string][]domain.BadgeGrant{}}
}
func (s *memoryBadgeStore) Grants(ctx context.Context, userID string) ([]domain.BadgeGrant, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return append([]domain.BadgeGrant(nil), s.grants[userID]...), nil
}
func (s *memoryBadgeStore) GrantsForUsers(ctx context.Context, userIDs []string) (map[string][]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	out := make(map[string][]string, len(userIDs))
	for _, id := range userIDs {
		for _, grant := range s.grants[id] {
			out[id] = append(out[id], grant.BadgeID)
		}
	}
	return out, nil
}
func (s *memoryBadgeStore) Grant(ctx context.Context, operatorID, userID string, badgeIDs []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.calls++
	known := map[string]bool{}
	for _, grant := range s.grants[userID] {
		known[grant.BadgeID] = true
	}
	for _, badgeID := range badgeIDs {
		if !known[badgeID] {
			s.grants[userID] = append(s.grants[userID], domain.BadgeGrant{BadgeID: badgeID, AwardedAt: time.Now(), AwardedBy: operatorID})
		}
	}
	return nil
}
func (s *memoryBadgeStore) Revoke(ctx context.Context, userID, badgeID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	kept := s.grants[userID][:0]
	for _, grant := range s.grants[userID] {
		if grant.BadgeID != badgeID {
			kept = append(kept, grant)
		}
	}
	if len(kept) == len(s.grants[userID]) {
		return domain.ErrInvalid
	}
	s.grants[userID] = kept
	s.revoked++
	return nil
}

func newTestService(store *memoryStore, badges *memoryBadgeStore) *Service {
	return NewService(store, badges)
}

func TestLifecycleIsolationAndReset(t *testing.T) {
	ctx := context.Background()
	store := newMemoryStore()
	svc := newTestService(store, newMemoryBadgeStore())
	zero, err := svc.Get(ctx, userA)
	if err != nil || zero.Revision != 0 || len(zero.BadgeIDs) != 0 {
		t.Fatal(zero, err)
	}
	desired := domain.Selection{AvatarFrameID: "moon-cloud", AvatarCharmID: "a-star-bow", BubbleThemeID: "moon-letter"}
	saved, err := svc.Update(ctx, userA, desired, 0)
	if err != nil || saved.Revision != 1 || !saved.Equal(desired) {
		t.Fatal(saved, err)
	}
	other, _ := svc.Get(ctx, userB)
	if other.Revision != 0 || !other.Equal(domain.Selection{}) {
		t.Fatal("偏好泄漏给了用户 B")
	}
	// 新建服务实例重新从 store 读取,验证不依赖进程/用户级内存状态。
	loaded, _ := newTestService(store, newMemoryBadgeStore()).Get(ctx, userA)
	if loaded.Revision != saved.Revision || !loaded.Equal(saved.Selection) {
		t.Fatal("未持久化")
	}
	reset, err := svc.Update(ctx, userA, domain.Selection{}, 1)
	if err != nil || reset.Revision != 2 || !reset.Equal(domain.Selection{}) {
		t.Fatal(reset, err)
	}
}
func TestConflictAndLostResponseRetry(t *testing.T) {
	ctx := context.Background()
	svc := newTestService(newMemoryStore(), newMemoryBadgeStore())
	a := domain.Selection{BubbleThemeID: "tea-time"}
	b := domain.Selection{BubbleThemeID: "velvet-night"}
	first, err := svc.Update(ctx, userA, a, 0)
	if err != nil {
		t.Fatal(err)
	}
	duplicate, err := svc.Update(ctx, userA, a, 0)
	if err != nil || duplicate.Revision != first.Revision || !duplicate.Equal(first.Selection) {
		t.Fatal("幂等重放失败", duplicate, err)
	}
	if _, err = svc.Update(ctx, userA, b, 0); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("过期草稿覆写了已存状态", err)
	}
	if _, err = svc.Update(ctx, userA, b, 1); err != nil {
		t.Fatal(err)
	}
	if _, err = svc.Update(ctx, userA, a, 0); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("过期版本的重放被接受", err)
	}
}
func TestConcurrentDifferentSelectionsOneWinner(t *testing.T) {
	svc := newTestService(newMemoryStore(), newMemoryBadgeStore())
	start := make(chan struct{})
	errs := make(chan error, 2)
	for _, theme := range []string{"moon-letter", "tea-time"} {
		go func(v string) {
			<-start
			_, err := svc.Update(context.Background(), userA, domain.Selection{BubbleThemeID: v}, 0)
			errs <- err
		}(theme)
	}
	close(start)
	won, conflicts := 0, 0
	for i := 0; i < 2; i++ {
		err := <-errs
		if err == nil {
			won++
		} else if errors.Is(err, domain.ErrConflict) {
			conflicts++
		} else {
			t.Fatal(err)
		}
	}
	if won != 1 || conflicts != 1 {
		t.Fatalf("winners=%d conflicts=%d", won, conflicts)
	}
}
func TestBatchValidationAndSingleStoreCall(t *testing.T) {
	store := newMemoryStore()
	svc := newTestService(store, newMemoryBadgeStore())
	ctx := context.Background()
	result, err := svc.List(ctx, []string{userA, userB, userA})
	if err != nil || len(result) != 2 || store.batchCalls != 1 || len(store.lastBatch) != 2 {
		t.Fatal(result, err)
	}
	for _, ids := range [][]string{nil, {"bad"}, make([]string, 51)} {
		if _, err := svc.List(ctx, ids); !errors.Is(err, domain.ErrInvalid) {
			t.Fatal("接受了非法批量请求", ids, err)
		}
	}
}
func TestInvalidInputCannotWrite(t *testing.T) {
	ctx := context.Background()
	svc := newTestService(newMemoryStore(), newMemoryBadgeStore())
	for _, rev := range []int64{-1, domain.MaxRevision + 1} {
		if _, err := svc.Update(ctx, userA, domain.Selection{}, rev); !errors.Is(err, domain.ErrInvalid) {
			t.Fatal(err)
		}
	}
	if _, err := svc.Update(ctx, userA, domain.Selection{BubbleThemeID: "unknown"}, 0); !errors.Is(err, domain.ErrInvalid) {
		t.Fatal(err)
	}
	if _, err := svc.Update(ctx, "bad", domain.Selection{}, 0); !errors.Is(err, domain.ErrInvalid) {
		t.Fatal(err)
	}
	if _, err := svc.Get(ctx, "bad"); !errors.Is(err, domain.ErrInvalid) {
		t.Fatal(err)
	}
	state, _ := svc.Get(ctx, userA)
	if state.Revision != 0 {
		t.Fatal("非法请求改动了数据")
	}
	cancelCtx, cancel := context.WithCancel(ctx)
	cancel()
	if _, err := svc.Get(cancelCtx, userA); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
}
func TestBadgeGrantEquipAndRevoke(t *testing.T) {
	ctx := context.Background()
	svc := newTestService(newMemoryStore(), newMemoryBadgeStore())
	// 未持有即佩戴,保存被拒。
	equip := domain.Selection{BadgeIDs: []string{"rua"}}
	if _, err := svc.Update(ctx, userA, equip, 0); !errors.Is(err, domain.ErrInvalid) {
		t.Fatal("未持有徽章被允许佩戴", err)
	}
	if err := svc.Grant(ctx, operator, userA, []string{"rua", "starlight-wish"}); err != nil {
		t.Fatal(err)
	}
	// 重复授予幂等。
	if err := svc.Grant(ctx, operator, userA, []string{"rua"}); err != nil {
		t.Fatal(err)
	}
	owned, err := svc.MyBadges(ctx, userA)
	if err != nil || len(owned) != 2 || owned[0].BadgeID != "rua" || owned[0].AwardedBy != operator {
		t.Fatal(owned, err)
	}
	saved, err := svc.Update(ctx, userA, equip, 0)
	if err != nil || saved.Revision != 1 || len(saved.BadgeIDs) != 1 {
		t.Fatal(saved, err)
	}
	// 佩戴他人没有的目录项在 domain 校验即被拒。
	if _, err = svc.Update(ctx, userA, domain.Selection{BadgeIDs: []string{"no-such-badge"}}, 1); !errors.Is(err, domain.ErrInvalid) {
		t.Fatal(err)
	}
	// 撤销后读取被交集过滤,展示自动消失。
	if err = svc.Revoke(ctx, userA, "rua"); err != nil {
		t.Fatal(err)
	}
	state, err := svc.Get(ctx, userA)
	if err != nil || len(state.BadgeIDs) != 0 {
		t.Fatal("撤销后的徽章仍出现在读取结果", state, err)
	}
	// 撤销未持有的徽章报错而非静默成功。
	if err = svc.Revoke(ctx, userA, "rua"); !errors.Is(err, domain.ErrInvalid) {
		t.Fatal(err)
	}
}
func TestBadgeGrantValidationAndPublicFiltering(t *testing.T) {
	ctx := context.Background()
	store := newMemoryStore()
	badges := newMemoryBadgeStore()
	svc := newTestService(store, badges)
	// 授予不受佩戴上限约束:一次授 3 枚合法。
	if err := svc.Grant(ctx, operator, userA, []string{"rua", "starlight-wish", "night-owl"}); err != nil {
		t.Fatal(err)
	}
	for _, badgeIDs := range [][]string{nil, {"unknown-badge"}, {"rua", "rua"}} {
		if err := svc.Grant(ctx, operator, userA, badgeIDs); !errors.Is(err, domain.ErrInvalid) {
			t.Fatal("接受了非法授予请求", badgeIDs, err)
		}
	}
	if err := svc.Grant(ctx, "bad", userA, []string{"rua"}); !errors.Is(err, domain.ErrInvalid) {
		t.Fatal(err)
	}
	if err := svc.Grant(ctx, operator, "bad", []string{"rua"}); !errors.Is(err, domain.ErrInvalid) {
		t.Fatal(err)
	}
	// 公开批量查询按持有交集过滤佩戴列表(撤销后未重新保存的场景)。
	if err := badges.Grant(ctx, "", userB, []string{"tea-party", "night-owl"}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Update(ctx, userA, domain.Selection{BadgeIDs: []string{"rua", "night-owl"}}, 0); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Update(ctx, userB, domain.Selection{BadgeIDs: []string{"tea-party", "night-owl"}}, 0); err != nil {
		t.Fatal(err)
	}
	// B 的 night-owl 被撤销:自己的读取与公开读取都不再出现。
	if err := svc.Revoke(ctx, userB, "night-owl"); err != nil {
		t.Fatal(err)
	}
	public, err := svc.List(ctx, []string{userA, userB})
	if err != nil {
		t.Fatal(err)
	}
	if len(public[userA].BadgeIDs) != 2 || public[userA].BadgeIDs[0] != "rua" {
		t.Fatal(public[userA])
	}
	if len(public[userB].BadgeIDs) != 1 || public[userB].BadgeIDs[0] != "tea-party" {
		t.Fatal(public[userB])
	}
	own, err := svc.Get(ctx, userB)
	if err != nil || len(own.BadgeIDs) != 1 || own.BadgeIDs[0] != "tea-party" {
		t.Fatal(own, err)
	}
}
