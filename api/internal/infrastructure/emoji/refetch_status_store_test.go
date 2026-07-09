package emoji

import (
	"context"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainemoji "blog-api/internal/domain/emoji"
)

func newTestStore(t *testing.T) (*RedisRefetchStatusStore, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	return NewRefetchStatusStore(rdb), mr
}

func TestGet_IdleWhenEmpty(t *testing.T) {
	store, _ := newTestStore(t)
	status, err := store.Get(context.Background())
	require.NoError(t, err)
	assert.Equal(t, domainemoji.RefetchStateIdle, status.State)
}

func TestAcquire_ThenConflict(t *testing.T) {
	store, _ := newTestStore(t)
	require.NoError(t, store.Acquire(context.Background()))
	status, _ := store.Get(context.Background())
	assert.Equal(t, domainemoji.RefetchStateRunning, status.State)
	assert.NotNil(t, status.StartedAt)

	err := store.Acquire(context.Background())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "已有重新拉取任务在运行")
}

func TestSetProgress(t *testing.T) {
	store, _ := newTestStore(t)
	require.NoError(t, store.Acquire(context.Background()))

	require.NoError(t, store.SetProgress(context.Background(), domainemoji.RefetchProgress{GroupsDone: 3, GroupsTotal: 10}))
	status, _ := store.Get(context.Background())
	assert.Equal(t, 3, status.GroupsDone)
	assert.Equal(t, 10, status.GroupsTotal)
}

func TestSetDone_ReleasesLock(t *testing.T) {
	store, _ := newTestStore(t)
	require.NoError(t, store.Acquire(context.Background()))

	require.NoError(t, store.SetDone(context.Background()))
	status, _ := store.Get(context.Background())
	assert.Equal(t, domainemoji.RefetchStateDone, status.State)
	assert.NotNil(t, status.FinishedAt)

	require.NoError(t, store.Acquire(context.Background()))
}

func TestSetFailed_ReleasesLock(t *testing.T) {
	store, _ := newTestStore(t)
	require.NoError(t, store.Acquire(context.Background()))

	require.NoError(t, store.SetFailed(context.Background(), "boom"))
	status, _ := store.Get(context.Background())
	assert.Equal(t, domainemoji.RefetchStateFailed, status.State)
	assert.Equal(t, "boom", status.Error)

	require.NoError(t, store.Acquire(context.Background()))
}

func TestAcquire_LockExpires(t *testing.T) {
	store, mr := newTestStore(t)
	require.NoError(t, store.Acquire(context.Background()))

	mr.FastForward(refetchLockTTL + 1)

	require.NoError(t, store.Acquire(context.Background()))
}
