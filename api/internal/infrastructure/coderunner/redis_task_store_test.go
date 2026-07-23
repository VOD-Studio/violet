package coderunner

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domaincoderunner "blog-api/internal/domain/coderunner"
	domainshared "blog-api/internal/domain/shared"
)

// newTestTaskStore 启动 miniredis 并返回 store 句柄。
func newTestTaskStore(t *testing.T) (*RedisTaskStore, *miniredis.Miniredis) {
	t.Helper()
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	return NewRedisTaskStore(rdb, 5*time.Minute), mr
}

func TestRedisTaskStore_SaveAndGet_RoundTrip(t *testing.T) {
	t.Parallel()
	store, _ := newTestTaskStore(t)
	ctx := context.Background()
	uid := domainshared.NewID()

	task := domaincoderunner.NewExecutionTask("python", "print('hi')", uid)
	require.NoError(t, store.Save(ctx, task))

	got, err := store.Get(ctx, task.ID())
	require.NoError(t, err)
	assert.Equal(t, task.Language(), got.Language())
	assert.Equal(t, task.Source(), got.Source())
	assert.Equal(t, task.UserID(), got.UserID())
	assert.Equal(t, domaincoderunner.StatusQueued, got.Status())
}

func TestRedisTaskStore_Get_NotFound(t *testing.T) {
	t.Parallel()
	store, _ := newTestTaskStore(t)

	_, err := store.Get(context.Background(), domainshared.NewID())
	assert.ErrorIs(t, err, domaincoderunner.ErrTaskNotFound)
}

func TestRedisTaskStore_Save_UpdatesState(t *testing.T) {
	t.Parallel()
	store, _ := newTestTaskStore(t)
	ctx := context.Background()

	task := domaincoderunner.NewExecutionTask("node", "console.log(1)", domainshared.NewID())
	require.NoError(t, store.Save(ctx, task))

	// 状态迁移后重新保存
	exitZero := 0
	task.MarkRunning()
	task.MarkSuccess("done", "", &exitZero, 42)
	require.NoError(t, store.Save(ctx, task))

	got, err := store.Get(ctx, task.ID())
	require.NoError(t, err)
	assert.Equal(t, domaincoderunner.StatusSuccess, got.Status())
	assert.Equal(t, "done", got.Stdout())
	assert.Equal(t, uint64(42), got.DurationMs())
}

func TestRedisTaskStore_Save_TTLExpires(t *testing.T) {
	t.Parallel()
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	store := NewRedisTaskStore(rdb, 100*time.Millisecond) // 短 TTL
	ctx := context.Background()

	task := domaincoderunner.NewExecutionTask("go", "x", domainshared.NewID())
	require.NoError(t, store.Save(ctx, task))

	// 快进 TTL
	mr.FastForward(200 * time.Millisecond)

	_, err = store.Get(ctx, task.ID())
	assert.ErrorIs(t, err, domaincoderunner.ErrTaskNotFound)
}

func TestRedisTaskStore_DeleteExpired(t *testing.T) {
	t.Parallel()
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	store := NewRedisTaskStore(rdb, 100*time.Millisecond)
	ctx := context.Background()

	task := domaincoderunner.NewExecutionTask("rust", "x", domainshared.NewID())
	require.NoError(t, store.Save(ctx, task))

	// 未过期前能查到
	_, err = store.Get(ctx, task.ID())
	require.NoError(t, err)

	// 快进 TTL，miniredis 自动过期
	mr.FastForward(200 * time.Millisecond)

	// DeleteExpired 在 miniredis 下是 no-op（TTL 自动过期），但不应报错
	require.NoError(t, store.DeleteExpired(ctx))

	// 过期后查不到
	_, err = store.Get(ctx, task.ID())
	assert.ErrorIs(t, err, domaincoderunner.ErrTaskNotFound)
}
