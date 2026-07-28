package subscription

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainsubscription "blog-api/internal/domain/subscription"
	"blog-api/internal/domain/shared"
)

// fakeRepo 内存版订阅仓储，记录被调参数。seam #2：不依赖 DB。
type fakeRepo struct {
	subs      map[string]*domainsubscription.Subscription // key = id
	saveCalls int
	findCalls int
	listCalls int
	delCalls  int
	saveErr   error
	findErr   error
	listErr   error
	delErr    error
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{subs: map[string]*domainsubscription.Subscription{}}
}

func (r *fakeRepo) Save(ctx context.Context, s *domainsubscription.Subscription) error {
	r.saveCalls++
	if r.saveErr != nil {
		return r.saveErr
	}
	// 复制一份存入，避免外部改动影响
	cp := *s
	r.subs[s.ID().String()] = &cp
	return nil
}

func (r *fakeRepo) FindByID(ctx context.Context, id, userID shared.ID) (*domainsubscription.Subscription, error) {
	r.findCalls++
	if r.findErr != nil {
		return nil, r.findErr
	}
	s, ok := r.subs[id.String()]
	if !ok || s.UserID() != userID {
		return nil, domainsubscription.ErrNotFound
	}
	cp := *s
	return &cp, nil
}

// FindByIDForSchedule 镜像 FindByID 但不校验 userID（调度器用）。
func (r *fakeRepo) FindByIDForSchedule(ctx context.Context, id shared.ID) (*domainsubscription.Subscription, error) {
	if r.findErr != nil {
		return nil, r.findErr
	}
	s, ok := r.subs[id.String()]
	if !ok {
		return nil, domainsubscription.ErrNotFound
	}
	cp := *s
	return &cp, nil
}

// FindDue 镜像领域 IsDue 逻辑（fake 版供 service 测试用，job 测试用真 GORM）。
func (r *fakeRepo) FindDue(ctx context.Context, now time.Time, limit int) ([]*domainsubscription.Subscription, error) {
	var result []*domainsubscription.Subscription
	for _, s := range r.subs {
		if s.IsDue(now) && len(result) < limit {
			cp := *s
			result = append(result, &cp)
		}
	}
	return result, nil
}

func (r *fakeRepo) FindByUser(ctx context.Context, userID shared.ID, status string, page, limit int) ([]*domainsubscription.Subscription, int64, error) {
	r.listCalls++
	if r.listErr != nil {
		return nil, 0, r.listErr
	}
	var result []*domainsubscription.Subscription
	for _, s := range r.subs {
		if s.UserID() != userID {
			continue
		}
		if status != "" && s.Status() != status {
			continue
		}
		cp := *s
		result = append(result, &cp)
	}
	total := int64(len(result))
	// 简单分页
	start := (page - 1) * limit
	if start > len(result) {
		return nil, total, nil
	}
	end := start + limit
	if end > len(result) {
		end = len(result)
	}
	return result[start:end], total, nil
}

// FindAll 镜像 FindByUser 但不按 userID 过滤（admin 全站视角）。
func (r *fakeRepo) FindAll(ctx context.Context, status string, page, limit int) ([]*domainsubscription.Subscription, int64, error) {
	if r.listErr != nil {
		return nil, 0, r.listErr
	}
	var result []*domainsubscription.Subscription
	for _, s := range r.subs {
		if status != "" && s.Status() != status {
			continue
		}
		cp := *s
		result = append(result, &cp)
	}
	total := int64(len(result))
	start := (page - 1) * limit
	if start > len(result) {
		return nil, total, nil
	}
	end := start + limit
	if end > len(result) {
		end = len(result)
	}
	return result[start:end], total, nil
}

func (r *fakeRepo) Delete(ctx context.Context, id, userID shared.ID) error {
	r.delCalls++
	if r.delErr != nil {
		return r.delErr
	}
	s, ok := r.subs[id.String()]
	if !ok || s.UserID() != userID {
		return domainsubscription.ErrNotFound
	}
	delete(r.subs, id.String())
	return nil
}

// 固定时钟便于断言 nextFetchAt。
func fixedClock(t *testing.T) (func() time.Time, time.Time) {
	t.Helper()
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	return func() time.Time { return now }, now
}

// --- Create ---

func TestService_Create_BuildsActiveSubscription(t *testing.T) {
	repo := newFakeRepo()
	clock, now := fixedClock(t)
	svc := NewService(repo, clock)

	dto, err := svc.Create(context.Background(), CreateInput{
		UserID:            shared.NewID().String(),
		FeedURL:           "https://example.com/feed.xml",
		Title:             "源",
		Interval:          domainsubscription.IntervalHourly,
		AutoPublish:       true,
		CanonicalOverride: "https://override/c",
		Tags:              []string{"转载"},
	})
	require.NoError(t, err)
	assert.Equal(t, domainsubscription.StatusActive, dto.Status)
	assert.Equal(t, domainsubscription.IntervalHourly, dto.Interval)
	assert.True(t, dto.AutoPublish)
	assert.Equal(t, "https://override/c", dto.CanonicalOverride)
	assert.Equal(t, []string{"转载"}, dto.Tags)
	assert.Equal(t, now.Add(time.Hour).Format(time.RFC3339), dto.NextFetchAt)
	assert.Equal(t, 1, repo.saveCalls, "应调 Save")
}

func TestService_Create_RejectsInvalidFeedURL(t *testing.T) {
	svc := NewService(newFakeRepo(), nil)
	_, err := svc.Create(context.Background(), CreateInput{
		UserID:   shared.NewID().String(),
		FeedURL:  "not-a-url",
		Interval: domainsubscription.IntervalDaily,
	})
	assert.Error(t, err)
}

func TestService_Create_DefaultsIntervalToDaily(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo, nil)
	dto, err := svc.Create(context.Background(), CreateInput{
		UserID:   shared.NewID().String(),
		FeedURL:  "https://example.com/feed",
		Interval: "", // 空应回退 daily
	})
	require.NoError(t, err)
	assert.Equal(t, domainsubscription.IntervalDaily, dto.Interval)
}

// --- GetByID ---

func TestService_GetByID_OwnerCheck(t *testing.T) {
	repo := newFakeRepo()
	clock, _ := fixedClock(t)
	uid := shared.NewID()
	sub, _ := domainsubscription.NewSubscription(uid, "https://x/feed", "t", domainsubscription.IntervalDaily, clock())
	repo.subs[sub.ID().String()] = sub
	svc := NewService(repo, nil)

	// 主人能查
	_, err := svc.GetByID(context.Background(), sub.ID().String(), uid.String())
	require.NoError(t, err)

	// 他人查不到（fakeRepo 按 userID 过滤）
	_, err = svc.GetByID(context.Background(), sub.ID().String(), shared.NewID().String())
	assert.ErrorIs(t, err, domainsubscription.ErrNotFound)
}

// --- Update ---

func TestService_Update_UpdatesConfig(t *testing.T) {
	repo := newFakeRepo()
	clock, _ := fixedClock(t)
	uid := shared.NewID()
	sub, _ := domainsubscription.NewSubscription(uid, "https://x/feed", "原", domainsubscription.IntervalDaily, clock())
	repo.subs[sub.ID().String()] = sub
	svc := NewService(repo, nil)

	err := svc.Update(context.Background(), UpdateInput{
		ID: sub.ID().String(), UserID: uid.String(),
		Title: "新", Interval: domainsubscription.IntervalWeekly,
		AutoPublish: true, Tags: []string{"x"},
	})
	require.NoError(t, err)

	got := repo.subs[sub.ID().String()]
	assert.Equal(t, "新", got.Title())
	assert.Equal(t, domainsubscription.IntervalWeekly, got.Interval())
	assert.True(t, got.AutoPublish())
}

// --- Pause / Resume ---

func TestService_PauseAndResume(t *testing.T) {
	repo := newFakeRepo()
	clock, _ := fixedClock(t)
	uid := shared.NewID()
	sub, _ := domainsubscription.NewSubscription(uid, "https://x/feed", "t", domainsubscription.IntervalDaily, clock())
	repo.subs[sub.ID().String()] = sub
	svc := NewService(repo, nil)

	// 制造失败计数，验证 Resume 清零
	sub.RecordFailure(clock(), "err")
	require.Equal(t, 1, sub.ConsecutiveFailures())
	repo.subs[sub.ID().String()] = sub

	require.NoError(t, svc.Pause(context.Background(), sub.ID().String(), uid.String()))
	assert.Equal(t, domainsubscription.StatusPaused, repo.subs[sub.ID().String()].Status())
	assert.Equal(t, 1, repo.subs[sub.ID().String()].ConsecutiveFailures(), "Pause 不清零")

	require.NoError(t, svc.Resume(context.Background(), sub.ID().String(), uid.String()))
	got := repo.subs[sub.ID().String()]
	assert.Equal(t, domainsubscription.StatusActive, got.Status())
	assert.Equal(t, 0, got.ConsecutiveFailures(), "Resume 应清零失败计数")
}

// --- Delete ---

func TestService_Delete(t *testing.T) {
	repo := newFakeRepo()
	clock, _ := fixedClock(t)
	uid := shared.NewID()
	sub, _ := domainsubscription.NewSubscription(uid, "https://x/feed", "t", domainsubscription.IntervalDaily, clock())
	repo.subs[sub.ID().String()] = sub
	svc := NewService(repo, nil)

	require.NoError(t, svc.Delete(context.Background(), sub.ID().String(), uid.String()))
	assert.NotContains(t, repo.subs, sub.ID().String())
	assert.Equal(t, 1, repo.delCalls)
}

func TestService_Delete_OtherUserReturnsNotFound(t *testing.T) {
	repo := newFakeRepo()
	clock, _ := fixedClock(t)
	uid := shared.NewID()
	sub, _ := domainsubscription.NewSubscription(uid, "https://x/feed", "t", domainsubscription.IntervalDaily, clock())
	repo.subs[sub.ID().String()] = sub
	svc := NewService(repo, nil)

	err := svc.Delete(context.Background(), sub.ID().String(), shared.NewID().String())
	assert.ErrorIs(t, err, domainsubscription.ErrNotFound)
	assert.Contains(t, repo.subs, sub.ID().String(), "他人删除不应生效")
}

// --- ListByUser ---

func TestService_ListByUser_PaginationAndStatusFilter(t *testing.T) {
	repo := newFakeRepo()
	clock, _ := fixedClock(t)
	uid := shared.NewID()
	// 建 3 个订阅，其中 1 个 paused
	for i := 0; i < 3; i++ {
		sub, _ := domainsubscription.NewSubscription(uid, "https://x/feed", "t", domainsubscription.IntervalDaily, clock())
		repo.subs[sub.ID().String()] = sub
	}
	for _, s := range repo.subs {
		s.Pause()
		break // 只 pause 第一个（map 迭代顺序不确定，但只 pause 一个就行）
	}
	svc := NewService(repo, nil)

	// 全部
	all, total, err := svc.ListByUser(context.Background(), uid.String(), "", 1, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(3), total)
	assert.Len(t, all, 3)

	// 只 active
	active, total, err := svc.ListByUser(context.Background(), uid.String(), domainsubscription.StatusActive, 1, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	assert.Len(t, active, 2)
	for _, dto := range active {
		assert.Equal(t, domainsubscription.StatusActive, dto.Status)
	}
}
