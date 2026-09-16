package chatappearance

import (
	"context"
	"errors"
	"sync"
	"testing"

	domain "blog-api/internal/domain/chatappearance"
)

const userA = "11111111-1111-4111-8111-111111111111"
const userB = "22222222-2222-4222-8222-222222222222"

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
func TestLifecycleIsolationAndReset(t *testing.T) {
	ctx := context.Background()
	store := newMemoryStore()
	svc := NewService(store)
	zero, err := svc.Get(ctx, userA)
	if err != nil || zero.Revision != 0 {
		t.Fatal(zero, err)
	}
	desired := domain.Selection{AvatarFrameID: "moon-cloud", AvatarCharmID: "a-star-bow", BubbleThemeID: "moon-letter"}
	saved, err := svc.Update(ctx, userA, desired, 0)
	if err != nil || saved.Revision != 1 || saved.Selection != desired {
		t.Fatal(saved, err)
	}
	other, _ := svc.Get(ctx, userB)
	if other != (domain.State{}) {
		t.Fatal("偏好泄漏给了用户 B")
	}
	// 新建服务实例重新从 store 读取,验证不依赖进程/用户级内存状态。
	loaded, _ := NewService(store).Get(ctx, userA)
	if loaded != saved {
		t.Fatal("未持久化")
	}
	reset, err := svc.Update(ctx, userA, domain.Selection{}, 1)
	if err != nil || reset.Revision != 2 || reset.Selection != (domain.Selection{}) {
		t.Fatal(reset, err)
	}
}
func TestConflictAndLostResponseRetry(t *testing.T) {
	ctx := context.Background()
	svc := NewService(newMemoryStore())
	a := domain.Selection{BubbleThemeID: "tea-time"}
	b := domain.Selection{BubbleThemeID: "velvet-night"}
	first, err := svc.Update(ctx, userA, a, 0)
	if err != nil {
		t.Fatal(err)
	}
	duplicate, err := svc.Update(ctx, userA, a, 0)
	if err != nil || duplicate != first {
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
	svc := NewService(newMemoryStore())
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
	svc := NewService(store)
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
	svc := NewService(newMemoryStore())
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
