package redis_test

import (
	"context"
	"testing"

	"github.com/alicebob/miniredis/v2"
	goredis "github.com/redis/go-redis/v9"

	storeredis "github.com/VOD-Studio/mimo-music/store/redis"
)

// newTestStore 启动 miniredis 并返回 SessionStore 与 miniredis 句柄。
func newTestStore(t *testing.T) (*storeredis.SessionStore, *miniredis.Miniredis) {
	t.Helper()
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("启动 miniredis 失败: %v", err)
	}
	t.Cleanup(mr.Close)

	rdb := goredis.NewClient(&goredis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	return storeredis.NewSessionStore(rdb), mr
}

// TestSessionStore_SaveGet 验证保存后能读取到 Cookie。
func TestSessionStore_SaveGet(t *testing.T) {
	store, _ := newTestStore(t)
	ctx := context.Background()

	if err := store.Save(ctx, "user1", "MUSIC_U=abc; __csrf=def"); err != nil {
		t.Fatalf("Save 失败: %v", err)
	}

	cookie, err := store.Get(ctx, "user1")
	if err != nil {
		t.Fatalf("Get 失败: %v", err)
	}
	if cookie != "MUSIC_U=abc; __csrf=def" {
		t.Errorf("Get = %q, want MUSIC_U=abc; __csrf=def", cookie)
	}
}

// TestSessionStore_GetMissing 验证不存在的 userID 返回空。
func TestSessionStore_GetMissing(t *testing.T) {
	store, _ := newTestStore(t)
	ctx := context.Background()

	cookie, err := store.Get(ctx, "nobody")
	if err != nil {
		t.Fatalf("Get 失败: %v", err)
	}
	if cookie != "" {
		t.Errorf("不存在的 session Get = %q, want empty", cookie)
	}
}

// TestSessionStore_Delete 验证删除后 Get 返回空。
func TestSessionStore_Delete(t *testing.T) {
	store, _ := newTestStore(t)
	ctx := context.Background()

	_ = store.Save(ctx, "user2", "cookie123")
	_ = store.Delete(ctx, "user2")

	cookie, _ := store.Get(ctx, "user2")
	if cookie != "" {
		t.Errorf("Delete 后 Get = %q, want empty", cookie)
	}
}

// TestSessionStore_ListAll 验证列出所有 session。
func TestSessionStore_ListAll(t *testing.T) {
	store, _ := newTestStore(t)
	ctx := context.Background()

	_ = store.Save(ctx, "user3", "cookie3")
	_ = store.Save(ctx, "user4", "cookie4")

	ids, err := store.ListAll(ctx)
	if err != nil {
		t.Fatalf("ListAll 失败: %v", err)
	}
	if len(ids) != 2 {
		t.Fatalf("ListAll 返回 %d 个 session, want 2", len(ids))
	}
}
