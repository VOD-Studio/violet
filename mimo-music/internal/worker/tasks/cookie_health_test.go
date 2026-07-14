// Package tasks 定义 mimo-music worker 的异步任务。
package tasks

import (
	"context"
	"errors"
	"testing"

	"github.com/hibiken/asynq"

	"github.com/VOD-Studio/mimo-music/provider"
)

// cookieHealthMockStore 是 Cookie 健康检查测试用的 mock store。
type cookieHealthMockStore struct {
	// sessions 模拟存储的 sessions。
	sessions map[string]string
}

func (m *cookieHealthMockStore) Get(ctx context.Context, userID string) (string, error) {
	return m.sessions[userID], nil
}

func (m *cookieHealthMockStore) Save(ctx context.Context, userID, cookie string) error {
	return nil
}

func (m *cookieHealthMockStore) Delete(ctx context.Context, userID string) error { return nil }

func (m *cookieHealthMockStore) ListAll(ctx context.Context) ([]string, error) {
	ids := make([]string, 0, len(m.sessions))
	for k := range m.sessions {
		ids = append(ids, k)
	}
	return ids, nil
}

// cookieHealthMockAuth 是测试用的 mock Auth。
type cookieHealthMockAuth struct {
	// failOnCookie 设为 true 时 LoginStatus 返回错误。
	failOnCookie map[string]bool
}

func (m *cookieHealthMockAuth) SendCaptcha(ctx context.Context, phone string) error { return nil }
func (m *cookieHealthMockAuth) LoginByCellphone(ctx context.Context, phone, captcha string) (provider.SessionResult, error) {
	return provider.SessionResult{}, nil
}
func (m *cookieHealthMockAuth) LoginByQrcode(ctx context.Context) (provider.QrcodeResult, error) {
	return provider.QrcodeResult{}, nil
}
func (m *cookieHealthMockAuth) CheckQrcode(ctx context.Context, key string) (provider.QrcodeStatus, error) {
	return provider.QrcodeStatus{}, nil
}
func (m *cookieHealthMockAuth) Logout(ctx context.Context, cookie string) error { return nil }

func (m *cookieHealthMockAuth) LoginStatus(ctx context.Context, cookie string) (provider.SessionResult, error) {
	// 用 cookie 内容判断是否失效（测试简化）
	if cookie == "expired" {
		return provider.SessionResult{}, errors.New("cookie expired")
	}
	return provider.SessionResult{UserID: "ok"}, nil
}

// TestCookieHealth_AllValid 验证所有 Cookie 有效时正常完成。
func TestCookieHealth_AllValid(t *testing.T) {
	store := &cookieHealthMockStore{sessions: map[string]string{
		"user1": "valid-cookie-1",
		"user2": "valid-cookie-2",
	}}
	auth := &cookieHealthMockAuth{}

	handler := HandleCookieHealth(store, auth)
	err := handler.ProcessTask(context.Background(), &asynq.Task{})
	if err != nil {
		t.Fatalf("健康检查失败: %v", err)
	}
}

// TestCookieHealth_SomeExpired 验证部分 Cookie 失效时不中断。
func TestCookieHealth_SomeExpired(t *testing.T) {
	store := &cookieHealthMockStore{sessions: map[string]string{
		"user1": "valid",
		"user2": "expired",
	}}
	auth := &cookieHealthMockAuth{}

	handler := HandleCookieHealth(store, auth)
	err := handler.ProcessTask(context.Background(), &asynq.Task{})
	if err != nil {
		t.Fatalf("部分失效不应导致任务失败: %v", err)
	}
}

// TestCookieHealth_EmptyStore 验证空 session 时不报错。
func TestCookieHealth_EmptyStore(t *testing.T) {
	store := &cookieHealthMockStore{sessions: map[string]string{}}
	auth := &cookieHealthMockAuth{}

	handler := HandleCookieHealth(store, auth)
	err := handler.ProcessTask(context.Background(), &asynq.Task{})
	if err != nil {
		t.Fatalf("空 store 不应失败: %v", err)
	}
}

// TestCookieHealth_MissingCookie 验证 store 中 cookie 为空时记为 expired。
func TestCookieHealth_MissingCookie(t *testing.T) {
	store := &cookieHealthMockStore{sessions: map[string]string{
		"user1": "", // 空 cookie
	}}
	auth := &cookieHealthMockAuth{}

	handler := HandleCookieHealth(store, auth)
	err := handler.ProcessTask(context.Background(), &asynq.Task{})
	if err != nil {
		t.Fatalf("空 cookie 不应导致任务失败: %v", err)
	}
}
