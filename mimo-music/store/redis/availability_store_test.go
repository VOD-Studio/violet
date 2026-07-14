package redis_test

import (
	"context"
	"testing"

	"github.com/alicebob/miniredis/v2"
	goredis "github.com/redis/go-redis/v9"

	storeredis "github.com/VOD-Studio/mimo-music/store/redis"
)

// TestAvailabilityStore_DefaultAvailable 验证未标记时默认可用。
func TestAvailabilityStore_DefaultAvailable(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("启动 miniredis 失败: %v", err)
	}
	t.Cleanup(mr.Close)

	rdb := goredis.NewClient(&goredis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	store := storeredis.NewAvailabilityStore(rdb)
	ctx := context.Background()

	avail, err := store.IsAvailable(ctx, "user1")
	if err != nil {
		t.Fatalf("IsAvailable 失败: %v", err)
	}
	if !avail {
		t.Error("未标记的 session 应默认可用")
	}
}

// TestAvailabilityStore_MarkUnavailableThenCheck 验证标记不可用后检查。
func TestAvailabilityStore_MarkUnavailableThenCheck(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("启动 miniredis 失败: %v", err)
	}
	t.Cleanup(mr.Close)

	rdb := goredis.NewClient(&goredis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	store := storeredis.NewAvailabilityStore(rdb)
	ctx := context.Background()

	if err := store.SetUnavailable(ctx, "user2"); err != nil {
		t.Fatalf("SetUnavailable 失败: %v", err)
	}

	avail, _ := store.IsAvailable(ctx, "user2")
	if avail {
		t.Error("标记不可用后应返回不可用")
	}
}

// TestAvailabilityStore_RecoverAvailable 验证恢复可用。
func TestAvailabilityStore_RecoverAvailable(t *testing.T) {
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("启动 miniredis 失败: %v", err)
	}
	t.Cleanup(mr.Close)

	rdb := goredis.NewClient(&goredis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	store := storeredis.NewAvailabilityStore(rdb)
	ctx := context.Background()

	_ = store.SetUnavailable(ctx, "user3")
	_ = store.SetAvailable(ctx, "user3")

	avail, _ := store.IsAvailable(ctx, "user3")
	if !avail {
		t.Error("恢复后应可用")
	}
}
