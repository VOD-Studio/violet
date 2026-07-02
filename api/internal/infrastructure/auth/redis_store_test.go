package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appshared "blog-api/internal/application/shared"
)

func newTestRedis(t *testing.T) *redis.Client {
	t.Helper()
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	return redis.NewClient(&redis.Options{Addr: mr.Addr()})
}

func sha256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

func TestVerify_AtomicUnderConcurrency(t *testing.T) {
	client := newTestRedis(t)
	store := NewRedisCodeStore(client)

	correct := sha256Hex("123456")
	require.NoError(t, store.Store(context.Background(), "verify", "a@b.c", correct))

	// 并发 20 次错误验证，尝试次数应被严格计数（原子），不应全部看到 attempts<max
	wg := sync.WaitGroup{}
	results := make([]bool, 20)
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			ok, _ := store.Verify(context.Background(), "verify", "a@b.c", sha256Hex("wrong"))
			results[i] = ok
		}(i)
	}
	wg.Wait()

	for _, ok := range results {
		assert.False(t, ok, "错误码不应匹配")
	}

	// 超过 maxAttempt(5) 后 key 应被删除，正确码也不再可验证
	ok, err := store.Verify(context.Background(), "verify", "a@b.c", correct)
	require.NoError(t, err)
	assert.False(t, ok, "超限后正确码也不应通过")
}

func TestVerify_AcceptsCorrectCodeBeforeLimit(t *testing.T) {
	client := newTestRedis(t)
	store := NewRedisCodeStore(client)
	correct := sha256Hex("654321")
	require.NoError(t, store.Store(context.Background(), "verify", "x@y.z", correct))

	ok, err := store.Verify(context.Background(), "verify", "x@y.z", correct)
	require.NoError(t, err)
	assert.True(t, ok)

	// 一次性：验证后 key 应删除
	ok2, _ := store.Verify(context.Background(), "verify", "x@y.z", correct)
	assert.False(t, ok2, "验证码应一次性消费")
}

func TestVerify_AllowsFewWrongThenRejects(t *testing.T) {
	client := newTestRedis(t)
	store := NewRedisCodeStore(client)
	correct := sha256Hex("right")
	require.NoError(t, store.Store(context.Background(), "reset", "u@v.w", correct))

	// 前 maxAttempt 次错误验证返回 false
	for i := 0; i < store.MaxAttempt(); i++ {
		ok, err := store.Verify(context.Background(), "reset", "u@v.w", sha256Hex("wrong"))
		require.NoError(t, err)
		assert.False(t, ok)
	}
	// 超限后正确码也失败
	ok, err := store.Verify(context.Background(), "reset", "u@v.w", correct)
	require.NoError(t, err)
	assert.False(t, ok)
}

// ============================================================
// RedisTokenStore.Rotate 测试（原子轮换 + 重用吊销家族）
// ============================================================

// newTestTokenStore 构造测试用 refresh token 存储（TTL 1h）
func newTestTokenStore(t *testing.T) (*RedisTokenStore, *redis.Client) {
	t.Helper()
	client := newTestRedis(t)
	return NewRedisTokenStore(client, time.Hour), client
}

// TestRotate_Success 旧 token 匹配时原子写入新 token
func TestRotate_Success(t *testing.T) {
	store, client := newTestTokenStore(t)
	ctx := context.Background()

	require.NoError(t, store.Save(ctx, "user-1", "old-token"))

	res, err := store.Rotate(ctx, "user-1", "old-token", "new-token")
	require.NoError(t, err)
	assert.Equal(t, appshared.RotateSuccess, res)

	// Redis 中应已更新为新 token
	val, err := client.Get(ctx, "refresh:user-1").Result()
	require.NoError(t, err)
	assert.Equal(t, "new-token", val)
}

// TestRotate_ReuseDetectedRevokesFamily 重用已废弃的旧 token → 吊销整个家族
// 见 ADR-0001 不变量 2：旧 token 再次出现几乎必然意味着被窃取，必须删除当前家族。
func TestRotate_ReuseDetectedRevokesFamily(t *testing.T) {
	store, client := newTestTokenStore(t)
	ctx := context.Background()

	// 当前有效的是 "current"，但攻击者持有被轮换掉的 "stale"
	require.NoError(t, store.Save(ctx, "user-1", "current"))

	res, err := store.Rotate(ctx, "user-1", "stale", "attacker-new")
	require.NoError(t, err)
	assert.Equal(t, appshared.RotateReused, res, "重用旧 token 应返回 RotateReused")

	// 整个家族应被吊销：key 被删除，连合法用户也必须重新登录
	exists, err := client.Exists(ctx, "refresh:user-1").Result()
	require.NoError(t, err)
	assert.Equal(t, int64(0), exists, "重用检测后应 DEL 整个家族")
}

// TestRotate_NoExistingToken 无 token（已登出）→ 返回 Invalid
func TestRotate_NoExistingToken(t *testing.T) {
	store, _ := newTestTokenStore(t)
	ctx := context.Background()

	res, err := store.Rotate(ctx, "user-2", "anything", "new")
	require.NoError(t, err)
	assert.Equal(t, appshared.RotateInvalid, res)
}

// TestRotate_AtomicUnderConcurrency 并发用同一旧 token 轮换，仅一个成功
// 见 ADR-0001 不变量 1：Verify+Save 必须原子，否则竞态可铸出多对 token。
//
// 注意：miniredis 单 goroutine 执行命令，无法复现真实 Redis 的并发竞态，
// 此测试验证的是「单次 Rotate 的逻辑正确性」——序列化执行下：
// 第一个成功（key 变为 new-0），第二个起旧 token 不匹配 → Reused 并 DEL 家族，
// 之后 key 不存在 → Invalid。真正的原子性保证来自 Lua 脚本在真实 Redis 单线程语义。
// 核心断言：不会有两个 token 同时有效（不变量的可观测投影）。
func TestRotate_AtomicUnderConcurrency(t *testing.T) {
	store, client := newTestTokenStore(t)
	ctx := context.Background()

	require.NoError(t, store.Save(ctx, "user-3", "original"))

	// 20 goroutine 用同一个 "original" 并发轮换，各自写入不同的新 token
	const n = 20
	results := make([]appshared.RotateResult, n)
	newTokens := make([]string, n)
	wg := sync.WaitGroup{}
	for i := 0; i < n; i++ {
		newTokens[i] = fmt.Sprintf("new-%d", i)
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			res, _ := store.Rotate(ctx, "user-3", "original", newTokens[i])
			results[i] = res
		}(i)
	}
	wg.Wait()

	// 统计结果分布
	successes := 0
	reused := 0
	invalid := 0
	for _, r := range results {
		switch r {
		case appshared.RotateSuccess:
			successes++
		case appshared.RotateReused:
			reused++
		case appshared.RotateInvalid:
			invalid++
		}
	}

	// 不变量投影：至多一个 Success（轮换是排他的）
	assert.LessOrEqual(t, successes, 1, "并发轮换至多一个成功（原子性投影）")
	// 其余要么是 Reused（撞上被轮换后的新值）要么是 Invalid（家族已被吊销，key 删除）
	assert.Equal(t, n-successes, reused+invalid, "非成功者应归入 Reused 或 Invalid")

	// 核心安全断言：最终 Redis 中至多一个 token，不可能是 original，也不可能有多个并存
	val, err := client.Get(ctx, "refresh:user-3").Result()
	if err == nil {
		assert.NotEqual(t, "original", val, "最终残留值不可能是被轮换掉的 original")
		assert.Contains(t, newTokens, val, "残留值应是某个新 token")
	}
	// err == redis.Nil 时 key 已被家族吊销 DEL，同样符合不变量
}
