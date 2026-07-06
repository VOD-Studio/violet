package auth

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainshared "blog-api/internal/domain/shared"
	domainsession "blog-api/internal/domain/session"
)

// newTestStore 启动 miniredis 并返回 store 与 miniredis 句柄，测试结束自动关闭。
func newTestStore(t *testing.T) (*RedisSessionStore, *miniredis.Miniredis) {
	t.Helper()
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	return NewRedisSessionStore(rdb), mr
}

// testSnap 构造测试用 UserSnapshot。
func testSnap(uid string) domainsession.UserSnapshot {
	id, _ := domainshared.ParseID(uid)
	return domainsession.UserSnapshot{UserID: id, Email: "u@example.com", Role: "user"}
}

// TestCreateAndGet_RoundTrip 验证 Create 写入后 Get 能读回等价的 session。
func TestCreateAndGet_RoundTrip(t *testing.T) {
	store, mr := newTestStore(t)
	defer mr.Close()

	s, _ := domainsession.NewSession(testSnap("00000000-0000-0000-0000-000000000001"), time.Now(), 0)
	require.NoError(t, store.Create(context.Background(), s, time.Hour))

	got, err := store.Get(context.Background(), s.ID())
	require.NoError(t, err)
	assert.Equal(t, s.UserID(), got.UserID())
	assert.Equal(t, s.CSRF(), got.CSRF())
}

// TestGet_MissingReturnsNotFound 验证不存在的 id 返回 ErrSessionNotFound（映射 401）。
func TestGet_MissingReturnsNotFound(t *testing.T) {
	store, mr := newTestStore(t)
	defer mr.Close()

	_, err := store.Get(context.Background(), "nonexistent")
	assert.ErrorIs(t, err, domainsession.ErrSessionNotFound)
}

// TestTouch_ExtendsTTL 验证 Touch 重置 TTL，使 session 在原过期点之后仍可读。
func TestTouch_ExtendsTTL(t *testing.T) {
	store, mr := newTestStore(t)
	defer mr.Close()
	ctx := context.Background()

	s, _ := domainsession.NewSession(testSnap("00000000-0000-0000-0000-000000000001"), time.Now(), 0)
	require.NoError(t, store.Create(ctx, s, time.Second))

	// 续期：把 TTL 重置为 1s
	require.NoError(t, store.Touch(ctx, s, time.Second))
	// 推进 500ms：Touch 后 TTL 还剩 500ms，session 仍有效
	mr.FastForward(500 * time.Millisecond)
	_, err := store.Get(ctx, s.ID())
	require.NoError(t, err, "Touch 续期后 session 仍有效")

	// 再推进 600ms：累计 1100ms > 1s，超过 Touch 后的 TTL → 失效
	mr.FastForward(600 * time.Millisecond)
	_, err = store.Get(ctx, s.ID())
	assert.ErrorIs(t, err, domainsession.ErrSessionNotFound, "超过续期后 TTL 失效")
}

// TestDeleteForUser_RemovesSingleSession 验证登出只删当前 session，不影响同用户其他设备。
func TestDeleteForUser_RemovesSingleSession(t *testing.T) {
	store, mr := newTestStore(t)
	defer mr.Close()
	ctx := context.Background()
	uid := "00000000-0000-0000-0000-000000000001"

	s1, _ := domainsession.NewSession(testSnap(uid), time.Now(), 0)
	s2, _ := domainsession.NewSession(testSnap(uid), time.Now(), 0)
	require.NoError(t, store.Create(ctx, s1, time.Hour))
	require.NoError(t, store.Create(ctx, s2, time.Hour))

	require.NoError(t, store.DeleteForUser(ctx, uid, s1.ID()))
	_, err := store.Get(ctx, s1.ID())
	assert.ErrorIs(t, err, domainsession.ErrSessionNotFound, "当前 session 已删")
	_, err = store.Get(ctx, s2.ID())
	require.NoError(t, err, "同用户其他设备 session 不受影响")
}

// TestDeleteByUser_RemovesAllSessions 验证改密/重置密码吊销该用户全部 session。
func TestDeleteByUser_RemovesAllSessions(t *testing.T) {
	store, mr := newTestStore(t)
	defer mr.Close()
	ctx := context.Background()
	uid := "00000000-0000-0000-0000-000000000001"

	s1, _ := domainsession.NewSession(testSnap(uid), time.Now(), 0)
	s2, _ := domainsession.NewSession(testSnap(uid), time.Now(), 0)
	require.NoError(t, store.Create(ctx, s1, time.Hour))
	require.NoError(t, store.Create(ctx, s2, time.Hour))

	require.NoError(t, store.DeleteByUser(ctx, uid))
	_, err1 := store.Get(ctx, s1.ID())
	_, err2 := store.Get(ctx, s2.ID())
	assert.ErrorIs(t, err1, domainsession.ErrSessionNotFound)
	assert.ErrorIs(t, err2, domainsession.ErrSessionNotFound)
}
