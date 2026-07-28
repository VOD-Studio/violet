package job

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appsub "blog-api/internal/application/subscription"
	domainsubscription "blog-api/internal/domain/subscription"
	"blog-api/internal/domain/shared"
)

// --- fakes ---

// fakeSubRepo 实现 domainsubscription.SubscriptionRepository（job 用 FindDue + Save）。
type fakeSubRepo struct {
	mu      sync.Mutex
	due     []*domainsubscription.Subscription
	saved   []*domainsubscription.Subscription
	findErr error
}

func (r *fakeSubRepo) Save(ctx context.Context, s *domainsubscription.Subscription) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := *s
	r.saved = append(r.saved, &cp)
	return nil
}
func (r *fakeSubRepo) FindByID(ctx context.Context, id, userID shared.ID) (*domainsubscription.Subscription, error) {
	return nil, nil
}
func (r *fakeSubRepo) FindByIDForSchedule(ctx context.Context, id shared.ID) (*domainsubscription.Subscription, error) {
	return nil, nil
}
func (r *fakeSubRepo) FindByUser(ctx context.Context, userID shared.ID, status string, page, limit int) ([]*domainsubscription.Subscription, int64, error) {
	return nil, 0, nil
}
func (r *fakeSubRepo) Delete(ctx context.Context, id, userID shared.ID) error { return nil }
func (r *fakeSubRepo) FindAll(ctx context.Context, status string, page, limit int) ([]*domainsubscription.Subscription, int64, error) {
	return nil, 0, nil // job 测试不用 FindAll
}
func (r *fakeSubRepo) FindDue(ctx context.Context, now time.Time, limit int) ([]*domainsubscription.Subscription, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.findErr != nil {
		return nil, r.findErr
	}
	return r.due, nil
}

// fakeFetcher 实现 SubscriptionFetcher，按订阅 ID 返回预设 FetchReport。
type fakeFetcher struct {
	reports   map[string]appsub.FetchReport // key = subscriptionID
	panicIDs  map[string]bool               // 命中即 panic（测隔离）
	onStart   func()                        // 并发探测钩子
	onEnd     func()
	callCount int32
}

func (f *fakeFetcher) FetchOne(ctx context.Context, subscriptionID string) appsub.FetchReport {
	atomic.AddInt32(&f.callCount, 1)
	if f.onStart != nil {
		f.onStart()
	}
	defer func() {
		if f.onEnd != nil {
			f.onEnd()
		}
	}()
	if f.panicIDs[subscriptionID] {
		panic("模拟抓取 panic")
	}
	if r, ok := f.reports[subscriptionID]; ok {
		return r
	}
	return appsub.FetchReport{SubscriptionID: subscriptionID} // 默认成功
}

// mustDueSub 构造一个 active 且 due 的订阅（next_fetch_at 设为过去）。
func mustDueSub(t *testing.T) *domainsubscription.Subscription {
	t.Helper()
	past := time.Now().Add(-time.Hour)
	s, err := domainsubscription.NewSubscription(shared.NewID(), "https://x/feed", "t", domainsubscription.IntervalDaily, time.Now())
	require.NoError(t, err)
	return domainsubscription.Reconstruct(
		s.ID(), s.UserID(), domainsubscription.SourceTypeRSS, "https://x/feed", "t",
		domainsubscription.IntervalDaily, false, "", nil,
		domainsubscription.StatusActive, 0, "", nil, &past, nil, time.Now(), time.Now(),
	)
}

// --- applyFeedError 错误分类状态机（核心） ---

func TestApplyFeedError_RateLimited_SetsRetryAfterNoCount(t *testing.T) {
	j := &SubscriptionJob{now: time.Now}
	sub := mustDueSub(t)
	retry := time.Now().Add(30 * time.Minute)
	fe := &appsub.FeedError{Kind: appsub.FeedErrRateLimited, RetryAfter: &retry, StatusCode: 429}

	j.applyFeedError(sub, fe, time.Now(), "429")

	assert.Equal(t, 0, sub.ConsecutiveFailures(), "429 不增计数")
	require.NotNil(t, sub.RetryAfterUntil())
	assert.True(t, sub.RetryAfterUntil().Equal(retry))
	assert.Equal(t, domainsubscription.StatusActive, sub.Status(), "429 不 paused")
}

func TestApplyFeedError_Permanent_PausesImmediately(t *testing.T) {
	j := &SubscriptionJob{now: time.Now}
	sub := mustDueSub(t)
	fe := &appsub.FeedError{Kind: appsub.FeedErrPermanent, StatusCode: 404}

	j.applyFeedError(sub, fe, time.Now(), "404 not found")

	assert.Equal(t, domainsubscription.StatusPaused, sub.Status(), "永久错误立即 paused")
	assert.Equal(t, 0, sub.ConsecutiveFailures(), "永久错误直接 paused 不计数")
}

func TestApplyFeedError_Transient_IncrementsCount(t *testing.T) {
	j := &SubscriptionJob{now: time.Now}
	sub := mustDueSub(t)
	fe := &appsub.FeedError{Kind: appsub.FeedErrTransient, StatusCode: 500}

	j.applyFeedError(sub, fe, time.Now(), "500")

	assert.Equal(t, 1, sub.ConsecutiveFailures())
	assert.Equal(t, domainsubscription.StatusActive, sub.Status(), "首次瞬时不应 paused")
}

func TestApplyFeedError_Transient_AutoPausesAtThreshold(t *testing.T) {
	j := &SubscriptionJob{now: time.Now}
	sub := mustDueSub(t)
	for i := 0; i < domainsubscription.MaxConsecutiveFailures-1; i++ {
		sub.RecordFailure(time.Now(), "err")
	}
	fe := &appsub.FeedError{Kind: appsub.FeedErrTransient, StatusCode: 500}

	j.applyFeedError(sub, fe, time.Now(), "500")

	assert.Equal(t, domainsubscription.StatusPaused, sub.Status(), "达阈值自动 paused")
	assert.Equal(t, domainsubscription.MaxConsecutiveFailures, sub.ConsecutiveFailures())
}

func TestApplyFeedError_NilFeedError_TreatedAsTransient(t *testing.T) {
	j := &SubscriptionJob{now: time.Now}
	sub := mustDueSub(t)
	// feedErr=nil（非 *FeedError，如 FindByID 失败）应按瞬时处理
	j.applyFeedError(sub, nil, time.Now(), "网络断开")

	assert.Equal(t, 1, sub.ConsecutiveFailures())
	assert.Equal(t, domainsubscription.StatusActive, sub.Status())
}

// --- fetchAndUpdate 成功路径 ---

func TestFetchAndUpdate_SuccessClearsCount(t *testing.T) {
	sub := mustDueSub(t)
	sub.RecordFailure(time.Now(), "old err") // 预置计数
	require.Equal(t, 1, sub.ConsecutiveFailures())

	repo := &fakeSubRepo{}
	j := &SubscriptionJob{
		svc:  &fakeFetcher{}, // 默认返回成功 report
		repo: repo,
		now:  time.Now,
	}
	j.fetchAndUpdate(context.Background(), sub)

	assert.Equal(t, 0, sub.ConsecutiveFailures(), "成功应清零计数")
	assert.Len(t, repo.saved, 1, "应 Save 状态")
}

func TestFetchAndUpdate_FailureSavesPausedState(t *testing.T) {
	sub := mustDueSub(t)
	repo := &fakeSubRepo{}
	j := &SubscriptionJob{
		svc: &fakeFetcher{reports: map[string]appsub.FetchReport{
			sub.ID().String(): {
				SubscriptionID: sub.ID().String(),
				SubscriptionError: "404",
				FeedErr: &appsub.FeedError{Kind: appsub.FeedErrPermanent, StatusCode: 404},
			},
		}},
		repo: repo,
		now:  time.Now,
	}
	j.fetchAndUpdate(context.Background(), sub)

	require.Len(t, repo.saved, 1)
	assert.Equal(t, domainsubscription.StatusPaused, repo.saved[0].Status())
}

// --- runOnce 并发与隔离 ---

func TestRunOnce_WorkerPoolParallel(t *testing.T) {
	var inflight, maxInflight int32
	subs := make([]*domainsubscription.Subscription, 10)
	for i := range subs {
		subs[i] = mustDueSub(t)
	}
	repo := &fakeSubRepo{due: subs}

	j := &SubscriptionJob{
		svc: &fakeFetcher{
			onStart: func() {
				n := atomic.AddInt32(&inflight, 1)
				for {
					m := atomic.LoadInt32(&maxInflight)
					if n <= m || atomic.CompareAndSwapInt32(&maxInflight, m, n) {
						break
					}
				}
				// 模拟抓取耗时，让多个 worker 真正并发
				time.Sleep(10 * time.Millisecond)
			},
			onEnd: func() { atomic.AddInt32(&inflight, -1) },
		},
		repo:   repo,
		now:    time.Now,
		worker: 3,
		tick:   time.Hour,
	}

	j.runOnce(context.Background())

	assert.GreaterOrEqual(t, atomic.LoadInt32(&maxInflight), int32(2), "应有并发（≥2）")
	assert.LessOrEqual(t, atomic.LoadInt32(&maxInflight), int32(3), "最大并发不应超 worker 数")
	assert.Len(t, repo.saved, 10, "所有订阅都应被处理")
}

func TestRunOnce_SinglePanicDoesNotAffectOthers(t *testing.T) {
	subs := []*domainsubscription.Subscription{mustDueSub(t), mustDueSub(t), mustDueSub(t)}
	repo := &fakeSubRepo{due: subs}

	j := &SubscriptionJob{
		svc: &fakeFetcher{panicIDs: map[string]bool{subs[1].ID().String(): true}},
		repo:   repo,
		now:    time.Now,
		worker: 5,
		tick:   time.Hour,
	}

	require.NotPanics(t, func() {
		j.runOnce(context.Background())
	})

	// panic 的订阅：fetchAndUpdate 中断（svc.FetchOne panic 被 recover），不 Save
	// 另两个正常 Save
	assert.Equal(t, 2, len(repo.saved), "panic 订阅不 Save，另两个应 Save")
}

func TestRunOnce_NoDueSubs_Noop(t *testing.T) {
	repo := &fakeSubRepo{due: nil}
	j := &SubscriptionJob{svc: &fakeFetcher{}, repo: repo, now: time.Now, worker: 5, tick: time.Hour}
	require.NotPanics(t, func() {
		j.runOnce(context.Background())
	})
	assert.Empty(t, repo.saved)
}

func TestRunOnce_FindDueError_Noop(t *testing.T) {
	repo := &fakeSubRepo{findErr: errors.New("DB 挂")}
	j := &SubscriptionJob{svc: &fakeFetcher{}, repo: repo, now: time.Now, worker: 5, tick: time.Hour}
	require.NotPanics(t, func() {
		j.runOnce(context.Background())
	})
	assert.Empty(t, repo.saved, "FindDue 失败不应处理任何订阅")
}
