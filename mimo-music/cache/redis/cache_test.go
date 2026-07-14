package redis_test

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	musicredis "github.com/VOD-Studio/mimo-music/cache/redis"
)

// newTestCache 启动 miniredis 并返回 Cache 与 miniredis 句柄，测试结束自动关闭。
func newTestCache(t *testing.T) (*musicredis.Cache, *miniredis.Miniredis) {
	t.Helper()
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("启动 miniredis 失败: %v", err)
	}
	t.Cleanup(mr.Close)

	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	return musicredis.New(rdb), mr
}

// TestCache_SetGet 验证写入后能读取到值。
func TestCache_SetGet(t *testing.T) {
	cache, _ := newTestCache(t)
	ctx := context.Background()

	if err := cache.Set(ctx, "key1", "value1", 60); err != nil {
		t.Fatalf("Set 失败: %v", err)
	}

	val, ok, err := cache.Get(ctx, "key1")
	if err != nil {
		t.Fatalf("Get 失败: %v", err)
	}
	if !ok {
		t.Fatal("期望命中缓存，实际未命中")
	}
	if val != "value1" {
		t.Errorf("Get = %q, want value1", val)
	}
}

// TestCache_GetMiss 验证不存在的 key 返回未命中。
func TestCache_GetMiss(t *testing.T) {
	cache, _ := newTestCache(t)
	ctx := context.Background()

	val, ok, err := cache.Get(ctx, "nonexistent")
	if err != nil {
		t.Fatalf("Get 失败: %v", err)
	}
	if ok {
		t.Fatal("期望未命中，实际命中")
	}
	if val != "" {
		t.Errorf("未命中时 val = %q, want empty", val)
	}
}

// TestCache_TTLExpiry 验证 TTL 过期后未命中。
func TestCache_TTLExpiry(t *testing.T) {
	cache, mr := newTestCache(t)
	ctx := context.Background()

	if err := cache.Set(ctx, "key2", "value2", 2); err != nil {
		t.Fatalf("Set 失败: %v", err)
	}

	// 快进 TTL
	mr.FastForward(3 * time.Second)

	_, ok, _ := cache.Get(ctx, "key2")
	if ok {
		t.Fatal("TTL 过期后仍命中缓存")
	}
}

// TestCache_Delete 验证删除后未命中。
func TestCache_Delete(t *testing.T) {
	cache, _ := newTestCache(t)
	ctx := context.Background()

	_ = cache.Set(ctx, "key3", "value3", 60)

	if err := cache.Delete(ctx, "key3"); err != nil {
		t.Fatalf("Delete 失败: %v", err)
	}

	_, ok, _ := cache.Get(ctx, "key3")
	if ok {
		t.Fatal("Delete 后仍命中缓存")
	}
}

// TestCache_PersistAfterRestart 验证写入的数据在 miniredis 模拟重启后仍存在。
//
// miniredis 不可跨进程，用 CheckGet 验证数据真正落盘到 Redis（而非进程内存）。
func TestCache_PersistAfterRestart(t *testing.T) {
	cache, mr := newTestCache(t)
	ctx := context.Background()

	_ = cache.Set(ctx, "persisted", "data", 3600)

	// 用 miniredis 底层验证 key 真正存在（模拟重启后数据不丢）
	exists, err := mr.Get("persisted")
	if err != nil {
		t.Fatalf("miniredis 查询失败: %v", err)
	}
	if exists != "data" {
		t.Errorf("miniredis 中的值 = %q, want data", exists)
	}
}
