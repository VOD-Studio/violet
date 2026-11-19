package friendlink

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	domain "blog-api/internal/domain/friendlink"
)

type activityRepoFixture struct {
	links  []*domain.FriendLink
	mu     sync.Mutex
	saved  map[string]domain.Activity
	failID string
}

func (r *activityRepoFixture) ClaimRefreshBatch(_ context.Context, _ time.Time, limit int) ([]*domain.FriendLink, error) {
	return r.links[:min(limit, len(r.links))], nil
}
func (r *activityRepoFixture) SaveActivity(_ context.Context, link *domain.FriendLink, activity domain.Activity) error {
	if link.ID().String() == r.failID {
		return errors.New("single write failure")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.saved[link.ID().String()] = activity
	return nil
}

type activityFetcherFunc func(context.Context, string, string) domain.Activity

func (f activityFetcherFunc) Fetch(ctx context.Context, site, rss string) domain.Activity {
	return f(ctx, site, rss)
}

func TestRefreshWorkerIsolatesFailuresAndNeverFetchesUnapproved(t *testing.T) {
	approved := mustEntity(t, domain.StatusApproved)
	failedSave := mustEntity(t, domain.StatusApproved)
	pending := mustEntity(t, domain.StatusPending)
	repo := &activityRepoFixture{links: []*domain.FriendLink{approved, pending, failedSave}, saved: make(map[string]domain.Activity), failID: failedSave.ID().String()}
	var calls atomic.Int32
	worker := NewRefreshWorker(repo, activityFetcherFunc(func(context.Context, string, string) domain.Activity {
		calls.Add(1)
		return domain.Activity{FeedStatus: domain.FeedError, SiteStatus: domain.SiteUp}
	}))
	require.NoError(t, worker.Refresh(t.Context()))
	require.EqualValues(t, 2, calls.Load())
	require.Len(t, repo.saved, 1)
	require.Equal(t, domain.FeedError, repo.saved[approved.ID().String()].FeedStatus)
}

func TestRefreshWorkerBoundsConcurrencyAndCancels(t *testing.T) {
	links := make([]*domain.FriendLink, 30)
	for i := range links {
		links[i] = mustEntity(t, domain.StatusApproved)
	}
	repo := &activityRepoFixture{links: links, saved: make(map[string]domain.Activity)}
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	var active, maximum atomic.Int32
	started := make(chan struct{}, 4)
	worker := NewRefreshWorker(repo, activityFetcherFunc(func(ctx context.Context, _, _ string) domain.Activity {
		n := active.Add(1)
		for previous := maximum.Load(); n > previous && !maximum.CompareAndSwap(previous, n); previous = maximum.Load() {
		}
		started <- struct{}{}
		<-ctx.Done()
		active.Add(-1)
		return domain.Activity{FeedStatus: domain.FeedError}
	}))
	done := make(chan error, 1)
	go func() { done <- worker.Refresh(ctx) }()
	for range 4 {
		select {
		case <-started:
		case <-time.After(time.Second):
			t.Fatal("worker did not start")
		}
	}
	cancel()
	select {
	case err := <-done:
		require.ErrorIs(t, err, context.Canceled)
	case <-time.After(time.Second):
		t.Fatal("worker did not cancel")
	}
	require.LessOrEqual(t, maximum.Load(), int32(4))
	require.Zero(t, active.Load())
}
