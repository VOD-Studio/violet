package service

import (
	"context"
	"testing"

	merrors "github.com/VOD-Studio/mimo-music/errors"
)

// mockRotatorStore 是 SessionRotator 测试用的 mock SessionStore。
type mockRotatorStore struct {
	sessions map[string]string
}

func (m *mockRotatorStore) Get(_ context.Context, userID string) (string, error) {
	return m.sessions[userID], nil
}
func (m *mockRotatorStore) Save(_ context.Context, _, _ string) error  { return nil }
func (m *mockRotatorStore) Delete(_ context.Context, _ string) error   { return nil }
func (m *mockRotatorStore) ListAll(context.Context) ([]string, error)  {
	ids := make([]string, 0, len(m.sessions))
	for k := range m.sessions {
		ids = append(ids, k)
	}
	return ids, nil
}

// mockAvailStore 是 AvailabilityStore 的内存 mock。
type mockAvailStore struct {
	unavail map[string]bool
}

func (m *mockAvailStore) IsAvailable(_ context.Context, userID string) (bool, error) {
	return !m.unavail[userID], nil
}
func (m *mockAvailStore) SetAvailable(_ context.Context, userID string) error {
	delete(m.unavail, userID)
	return nil
}
func (m *mockAvailStore) SetUnavailable(_ context.Context, userID string) error {
	m.unavail[userID] = true
	return nil
}

// TestRotator_NextCookie_RoundRobin 验证多次调用按 round-robin 轮换。
func TestRotator_NextCookie_RoundRobin(t *testing.T) {
	store := &mockRotatorStore{sessions: map[string]string{
		"user1": "cookie1",
		"user2": "cookie2",
		"user3": "cookie3",
	}}
	avail := &mockAvailStore{unavail: map[string]bool{}}
	r := NewSessionRotator(store, avail)

	ctx := context.Background()
	seen := make(map[string]int)
	for i := 0; i < 6; i++ {
		uid, _, err := r.NextCookie(ctx)
		if err != nil {
			t.Fatalf("第 %d 次: %v", i, err)
		}
		seen[uid]++
	}

	// 3 个 session 各轮到 2 次
	if len(seen) != 3 {
		t.Errorf("轮换应覆盖所有 3 个 session，实际 %d 个", len(seen))
	}
	for uid, count := range seen {
		if count != 2 {
			t.Errorf("session %s 轮到 %d 次, want 2", uid, count)
		}
	}
}

// TestRotator_SkipsUnavailable 验证不可用 session 被跳过。
func TestRotator_SkipsUnavailable(t *testing.T) {
	store := &mockRotatorStore{sessions: map[string]string{
		"user1": "cookie1",
		"user2": "cookie2",
	}}
	avail := &mockAvailStore{unavail: map[string]bool{"user1": true}}
	r := NewSessionRotator(store, avail)

	ctx := context.Background()
	for i := 0; i < 5; i++ {
		uid, _, err := r.NextCookie(ctx)
		if err != nil {
			t.Fatalf("第 %d 次: %v", i, err)
		}
		if uid == "user1" {
			t.Errorf("不可用的 user1 不应被选中")
		}
	}
}

// TestRotator_AllUnavailable 验证所有 session 不可用时返回明确错误。
func TestRotator_AllUnavailable(t *testing.T) {
	store := &mockRotatorStore{sessions: map[string]string{
		"user1": "cookie1",
	}}
	avail := &mockAvailStore{unavail: map[string]bool{"user1": true}}
	r := NewSessionRotator(store, avail)

	_, _, err := r.NextCookie(context.Background())
	if err == nil {
		t.Fatal("期望返回错误，实际 nil")
	}
	if err != ErrNoAvailableSession {
		t.Errorf("错误 = %v, want ErrNoAvailableSession", err)
	}
}

// TestRotator_EmptyStore 验证空 store 返回 ErrUnauthorized。
func TestRotator_EmptyStore(t *testing.T) {
	store := &mockRotatorStore{sessions: map[string]string{}}
	avail := &mockAvailStore{unavail: map[string]bool{}}
	r := NewSessionRotator(store, avail)

	_, _, err := r.NextCookie(context.Background())
	if err == nil {
		t.Fatal("期望返回错误")
	}
	if err != merrors.ErrUnauthorized {
		t.Errorf("空 store 应返回 ErrUnauthorized，实际 %v", err)
	}
}

// TestRotator_MarkUnavailableThenRecover 验证标记不可用后恢复。
func TestRotator_MarkUnavailableThenRecover(t *testing.T) {
	store := &mockRotatorStore{sessions: map[string]string{
		"user1": "cookie1",
		"user2": "cookie2",
	}}
	avail := &mockAvailStore{unavail: map[string]bool{}}
	r := NewSessionRotator(store, avail)
	ctx := context.Background()

	// 标记 user1 不可用
	_ = r.MarkUnavailable(ctx, "user1")

	// user1 被跳过
	for i := 0; i < 3; i++ {
		uid, _, _ := r.NextCookie(ctx)
		if uid == "user1" {
			t.Error("标记后不应选中 user1")
		}
	}

	// 恢复 user1
	_ = r.MarkAvailable(ctx, "user1")

	// user1 应重新纳入（可能需要多次轮到）
	seen1 := false
	for i := 0; i < 10; i++ {
		uid, _, _ := r.NextCookie(ctx)
		if uid == "user1" {
			seen1 = true
			break
		}
	}
	if !seen1 {
		t.Error("恢复后 user1 应被重新纳入轮换")
	}
}
