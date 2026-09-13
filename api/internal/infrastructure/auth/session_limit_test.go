package auth

import (
	"context"
	"testing"
	"time"

	domainsession "blog-api/internal/domain/session"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestCreateBounded_EvictsOldestWhenLimitReached 验证并发上限：第 N+1 个会话
// 创建时按创建时间淘汰最旧会话，且新会话可用。
func TestCreateBounded_EvictsOldestWhenLimitReached(t *testing.T) {
	store, _ := newTestStore(t)
	ctx := context.Background()
	uid := "00000000-0000-0000-0000-000000000001"

	first, _ := domainsession.NewSession(testSnap(uid), time.Now(), 0, domainsession.ClientContext{})
	_, err0 := store.CreateBounded(ctx, first, time.Hour, 2)
	require.NoError(t, err0)

	time.Sleep(2 * time.Millisecond) // 保证 ZSET score 严格递增
	second, _ := domainsession.NewSession(testSnap(uid), time.Now(), 0, domainsession.ClientContext{})
	_, err1 := store.CreateBounded(ctx, second, time.Hour, 2)
	require.NoError(t, err1)

	time.Sleep(2 * time.Millisecond)
	third, _ := domainsession.NewSession(testSnap(uid), time.Now(), 0, domainsession.ClientContext{})
	evicted, err := store.CreateBounded(ctx, third, time.Hour, 2)
	require.NoError(t, err)
	assert.Equal(t, []string{string(first.ID())}, evicted, "应淘汰最旧的第一个会话")

	_, err = store.Get(ctx, first.ID())
	assert.ErrorIs(t, err, domainsession.ErrSessionNotFound, "被淘汰会话立即失效")
	_, err = store.Get(ctx, second.ID())
	assert.NoError(t, err)
	_, err = store.Get(ctx, third.ID())
	assert.NoError(t, err)
}

// TestCreateBounded_CleansExpiredIndexMembers 验证过期索引不占并发名额：
// payload 已到期的成员在创建时被清理。
func TestCreateBounded_CleansExpiredIndexMembers(t *testing.T) {
	store, mr := newTestStore(t)
	ctx := context.Background()
	uid := "00000000-0000-0000-0000-000000000002"

	expired, _ := domainsession.NewSession(testSnap(uid), time.Now(), 0, domainsession.ClientContext{})
	_, err2 := store.CreateBounded(ctx, expired, time.Second, 1)
	require.NoError(t, err2)
	mr.FastForward(1100 * time.Millisecond) // payload TTL 到期

	fresh, _ := domainsession.NewSession(testSnap(uid), time.Now(), 0, domainsession.ClientContext{})
	evicted, err := store.CreateBounded(ctx, fresh, time.Hour, 1)
	require.NoError(t, err)
	assert.Empty(t, evicted, "过期成员被清理，不应触发淘汰")
	_, err = store.Get(ctx, fresh.ID())
	assert.NoError(t, err)
}

// TestTouch_DoesNotReviveRevokedSession 验证并发吊销后迟到的 Touch 不会复活
// 凭据（无条件 SET 复活漏洞的回归锚点）。
func TestTouch_DoesNotReviveRevokedSession(t *testing.T) {
	store, _ := newTestStore(t)
	ctx := context.Background()
	uid := "00000000-0000-0000-0000-000000000003"

	s, _ := domainsession.NewSession(testSnap(uid), time.Now(), 0, domainsession.ClientContext{})
	require.NoError(t, store.Create(ctx, s, time.Hour))
	require.NoError(t, store.DeleteForUser(ctx, uid, s.ID()))

	err := store.Touch(ctx, s, time.Hour, domainsession.ClientContext{})
	assert.ErrorIs(t, err, domainsession.ErrSessionNotFound, "吊销后的 Touch 应失败")
	_, err = store.Get(ctx, s.ID())
	assert.ErrorIs(t, err, domainsession.ErrSessionNotFound, "会话不得被复活")
}

// TestListByUser_ReturnsAliveSessionsInCreationOrder 验证设备列表按创建时间
// 升序返回存活会话，且附带客户端信息。
func TestListByUser_ReturnsAliveSessionsInCreationOrder(t *testing.T) {
	store, _ := newTestStore(t)
	ctx := context.Background()
	uid := "00000000-0000-0000-0000-000000000004"

	first, _ := domainsession.NewSession(testSnap(uid), time.Now(), 0, domainsession.ClientContext{IP: "1.1.1.1", UserAgent: "UA-A"})
	require.NoError(t, store.Create(ctx, first, time.Hour))
	time.Sleep(2 * time.Millisecond)
	second, _ := domainsession.NewSession(testSnap(uid), time.Now(), 0, domainsession.ClientContext{IP: "2.2.2.2", UserAgent: "UA-B"})
	require.NoError(t, store.Create(ctx, second, time.Hour))

	sessions, err := store.ListByUser(ctx, uid)
	require.NoError(t, err)
	require.Len(t, sessions, 2)
	assert.Equal(t, string(first.ID()), string(sessions[0].ID()))
	assert.Equal(t, "1.1.1.1", sessions[0].Client().IP)
	assert.Equal(t, "UA-A", sessions[0].Client().UserAgent)
	assert.Equal(t, string(second.ID()), string(sessions[1].ID()))

	// Touch 刷新客户端信息后列表反映最新观察值。
	require.NoError(t, store.Touch(ctx, first, time.Hour, domainsession.ClientContext{IP: "3.3.3.3", UserAgent: "UA-A2"}))
	sessions, err = store.ListByUser(ctx, uid)
	require.NoError(t, err)
	assert.Equal(t, "3.3.3.3", sessions[0].Client().IP)
}

// TestMigrateLegacyIndexes_ConvertsSetToZSET 验证旧版 SET 索引在迁移后仍可
// 参与上限淘汰（升级路径回归锚点）。
func TestMigrateLegacyIndexes_ConvertsSetToZSET(t *testing.T) {
	store, _ := newTestStore(t)
	ctx := context.Background()
	uid := "00000000-0000-0000-0000-000000000005"

	legacy, _ := domainsession.NewSession(testSnap(uid), time.Now(), 0, domainsession.ClientContext{})
	require.NoError(t, store.Create(ctx, legacy, time.Hour))
	// 手工把 ZSET 索引退化成 SET，模拟升级前部署的旧结构。
	idx := "user:" + uid + ":sessions"
	members, err := store.rdb.ZRange(ctx, idx, 0, -1).Result()
	require.NoError(t, err)
	require.Len(t, members, 1)
	require.NoError(t, store.rdb.Del(ctx, idx).Err())
	require.NoError(t, store.rdb.SAdd(ctx, idx, members[0]).Err())

	require.NoError(t, store.MigrateLegacyIndexes(ctx, time.Hour))

	fresh, _ := domainsession.NewSession(testSnap(uid), time.Now(), 0, domainsession.ClientContext{})
	evicted, err := store.CreateBounded(ctx, fresh, time.Hour, 1)
	require.NoError(t, err)
	assert.Equal(t, []string{string(legacy.ID())}, evicted, "迁移后的旧会话参与淘汰")
}
