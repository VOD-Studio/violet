package auth

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/opsgrant"
)

func newGrantStore(t *testing.T) (*RedisOpsGrantStore, *miniredis.Miniredis) {
	t.Helper()
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	return NewRedisOpsGrantStore(rdb), mr
}

func TestOpsGrantStore_IssueExistsRevoke(t *testing.T) {
	store, _ := newGrantStore(t)
	ctx := context.Background()

	grant, ok := opsgrant.NewGrant("user-1", "sess-1", opsgrant.CategorySecurity, time.Now().Add(time.Minute))
	require.True(t, ok)
	require.NoError(t, store.Issue(ctx, grant))

	exists, err := store.Exists(ctx, "user-1", "sess-1", opsgrant.CategorySecurity)
	require.NoError(t, err)
	assert.True(t, exists, "签发后授权有效")

	// 会话绑定不匹配时不可用
	other, err := store.Exists(ctx, "user-1", "sess-2", opsgrant.CategorySecurity)
	require.NoError(t, err)
	assert.False(t, other, "授权绑定单一会话")

	// 按会话吊销
	require.NoError(t, store.RevokeSession(ctx, "user-1", "sess-1"))
	exists, err = store.Exists(ctx, "user-1", "sess-1", opsgrant.CategorySecurity)
	require.NoError(t, err)
	assert.False(t, exists)

	// 重新签发后按用户吊销
	require.NoError(t, store.Issue(ctx, grant))
	require.NoError(t, store.RevokeUser(ctx, "user-1"))
	exists, err = store.Exists(ctx, "user-1", "sess-1", opsgrant.CategorySecurity)
	require.NoError(t, err)
	assert.False(t, exists)
}

func TestOpsGrantStore_ExpiresByTTL(t *testing.T) {
	store, mr := newGrantStore(t)
	ctx := context.Background()

	grant, ok := opsgrant.NewGrant("user-1", "sess-1", opsgrant.CategorySecurity, time.Now().Add(100*time.Millisecond))
	require.True(t, ok)
	require.NoError(t, store.Issue(ctx, grant))
	mr.FastForward(200 * time.Millisecond)

	exists, err := store.Exists(ctx, "user-1", "sess-1", opsgrant.CategorySecurity)
	require.NoError(t, err)
	assert.False(t, exists, "超时授权经 TTL 自动失效")
}

func TestOpsGrant_CoversChecksBinding(t *testing.T) {
	now := time.Now()
	grant, ok := opsgrant.NewGrant("u1", "s1", opsgrant.CategorySecurity, now.Add(time.Minute))
	require.True(t, ok)

	assert.True(t, grant.Covers("u1", "s1", opsgrant.CategorySecurity, now))
	assert.False(t, grant.Covers("u2", "s1", opsgrant.CategorySecurity, now), "用户不匹配")
	assert.False(t, grant.Covers("u1", "s2", opsgrant.CategorySecurity, now), "会话不匹配")
	assert.False(t, grant.Covers("u1", "s1", opsgrant.Category("sql"), now), "类别不可跨用")
	assert.False(t, grant.Covers("u1", "s1", opsgrant.CategorySecurity, now.Add(2*time.Minute)), "过期后不可用")

	_, ok = opsgrant.NewGrant("u1", "s1", opsgrant.Category("unknown"), now)
	assert.False(t, ok, "未注册类别拒绝构造")
}
