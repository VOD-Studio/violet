// Package redis 的 SessionStore 测试。
package redis_test

import (
	"context"
	"testing"
	"time"

	musicredis "github.com/VOD-Studio/mimo-music/internal/store/redis"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

// newSessionStore 启动 miniredis 并返回 SessionStore 句柄。
func newSessionStore(t *testing.T) *musicredis.SessionStore {
	t.Helper()
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("启动 miniredis 失败: %v", err)
	}
	t.Cleanup(mr.Close)

	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	return musicredis.NewSessionStore(rdb)
}

// TestSessionStore_Empty 空池返回 ErrNoAvailableSession。
func TestSessionStore_Empty(t *testing.T) {
	ctx := context.Background()
	s := newSessionStore(t)

	_, err := s.GetAvailable(ctx, session.AuthAnonymous)
	if err == nil {
		t.Fatal("空池应返回错误")
	}
}

// TestSessionStore_RoundRobin 多次选取应轮换不同 session。
func TestSessionStore_RoundRobin(t *testing.T) {
	ctx := context.Background()
	s := newSessionStore(t)

	_ = s.Save(ctx, &session.Session{UserID: "user1", Cookie: "c1"})
	_ = s.Save(ctx, &session.Session{UserID: "user2", Cookie: "c2"})

	// 两次选取应拿到不同 session（round-robin）。
	sess1, err := s.GetAvailable(ctx, session.AuthLoggedIn)
	if err != nil {
		t.Fatalf("第一次选取失败: %v", err)
	}
	sess2, err := s.GetAvailable(ctx, session.AuthLoggedIn)
	if err != nil {
		t.Fatalf("第二次选取失败: %v", err)
	}
	if sess1.UserID == sess2.UserID {
		t.Fatalf("round-robin 应轮换，但两次都拿到 %s", sess1.UserID)
	}
}

// TestSessionStore_ReportFailure 标记不可用后应被跳过。
func TestSessionStore_ReportFailure(t *testing.T) {
	ctx := context.Background()
	s := newSessionStore(t)

	_ = s.Save(ctx, &session.Session{UserID: "user1", Cookie: "c1"})
	_ = s.Save(ctx, &session.Session{UserID: "user2", Cookie: "c2"})

	// 标记 user1 不可用。
	s.ReportFailure("user1", nil)

	// 选取多次，user1 应被跳过（只可能拿到 user2）。
	for i := 0; i < 5; i++ {
		sess, err := s.GetAvailable(ctx, session.AuthLoggedIn)
		if err != nil {
			t.Fatalf("第 %d 次选取失败: %v", i, err)
		}
		if sess.UserID == "user1" {
			t.Fatalf("user1 已标记不可用，不应被选取")
		}
	}
}

// TestSessionStore_AllUnavailable 全部不可用返回 ErrNoAvailableSession。
func TestSessionStore_AllUnavailable(t *testing.T) {
	ctx := context.Background()
	s := newSessionStore(t)

	_ = s.Save(ctx, &session.Session{UserID: "user1", Cookie: "c1"})
	s.ReportFailure("user1", nil)

	// 等待不可用标记写入（ReportFailure 是异步写 Redis）。
	time.Sleep(50 * time.Millisecond)

	_, err := s.GetAvailable(ctx, session.AuthLoggedIn)
	if err != session.ErrNoAvailableSession {
		t.Fatalf("全部不可用应返回 ErrNoAvailableSession，得到 %v", err)
	}
}

// TestSessionStore_ReportSuccess 恢复可用性。
func TestSessionStore_ReportSuccess(t *testing.T) {
	ctx := context.Background()
	s := newSessionStore(t)

	_ = s.Save(ctx, &session.Session{UserID: "user1", Cookie: "c1"})
	s.ReportFailure("user1", nil)
	time.Sleep(50 * time.Millisecond)

	s.ReportSuccess("user1")
	time.Sleep(50 * time.Millisecond)

	_, err := s.GetAvailable(ctx, session.AuthLoggedIn)
	if err != nil {
		t.Fatalf("恢复后应能选取，得到 %v", err)
	}
}

// TestNoopStore 空实现永远返回 ErrNoAvailableSession。
func TestNoopStore(t *testing.T) {
	n := session.NoopStore{}
	_, err := n.GetAvailable(context.Background(), session.AuthAnonymous)
	if err != session.ErrNoAvailableSession {
		t.Fatalf("Noop 应返回 ErrNoAvailableSession，得到 %v", err)
	}
}
