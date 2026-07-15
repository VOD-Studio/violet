// Package cache 的测试。
package cache_test

import (
	"context"
	"testing"
	"time"

	"github.com/VOD-Studio/mimo-music/internal/cache"
	musicredis "github.com/VOD-Studio/mimo-music/internal/cache/redis"
	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

// TestNoop 永远未命中，不做存储。
func TestNoop(t *testing.T) {
	ctx := context.Background()
	n := cache.Noop{}

	if _, ok, err := n.Get(ctx, "k"); ok || err != nil {
		t.Fatalf("Noop.Get 应未命中无错，得到 ok=%v err=%v", ok, err)
	}
	if err := n.Set(ctx, "k", []byte("v"), time.Minute); err != nil {
		t.Fatalf("Noop.Set 应无错: %v", err)
	}
	if err := n.Delete(ctx, "k"); err != nil {
		t.Fatalf("Noop.Delete 应无错: %v", err)
	}
}

// newRedisCache 启动 miniredis 并返回 Cache 句柄。
func newRedisCache(t *testing.T) cache.Cache {
	t.Helper()
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("启动 miniredis 失败: %v", err)
	}
	t.Cleanup(mr.Close)

	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	return musicredis.New(rdb)
}

// TestRedisCache_SetGet 验证写入后能读取到值。
func TestRedisCache_SetGet(t *testing.T) {
	ctx := context.Background()
	c := newRedisCache(t)

	if err := c.Set(ctx, "k", []byte("v"), time.Minute); err != nil {
		t.Fatalf("Set 失败: %v", err)
	}
	got, ok, err := c.Get(ctx, "k")
	if err != nil || !ok || string(got) != "v" {
		t.Fatalf("Get 想要 v/true/nil，得到 %s/%v/%v", got, ok, err)
	}
}

// TestRedisCache_Miss 未命中返回 nil/false/nil。
func TestRedisCache_Miss(t *testing.T) {
	ctx := context.Background()
	c := newRedisCache(t)

	got, ok, err := c.Get(ctx, "missing")
	if err != nil || ok || got != nil {
		t.Fatalf("未命中想要 nil/false/nil，得到 %s/%v/%v", got, ok, err)
	}
}

// TestRedisCache_Delete 删除后未命中。
func TestRedisCache_Delete(t *testing.T) {
	ctx := context.Background()
	c := newRedisCache(t)

	_ = c.Set(ctx, "k", []byte("v"), time.Minute)
	if err := c.Delete(ctx, "k"); err != nil {
		t.Fatalf("Delete 失败: %v", err)
	}
	if _, ok, _ := c.Get(ctx, "k"); ok {
		t.Fatal("删除后应未命中")
	}
}
