// Package service 提供 mimo-music 的业务编排层。
package service

import (
	"context"
	"errors"
	"testing"

	"github.com/VOD-Studio/mimo-music/provider"
)

// mockAuth 是 provider.Auth 的测试 mock。
type mockAuth struct {
	// loginResult 是登录返回值。
	loginResult provider.SessionResult
	// loginErr 是登录返回错误。
	loginErr error
	// savedCookie 记录最后一次 Save 的 cookie（验证用）。
	savedUserID   string
	savedCookie   string
	deletedUserID string
}

func (m *mockAuth) SendCaptcha(ctx context.Context, phone string) error { return nil }

func (m *mockAuth) LoginByCellphone(ctx context.Context, phone, captcha string) (provider.SessionResult, error) {
	return m.loginResult, m.loginErr
}

func (m *mockAuth) LoginByQrcode(ctx context.Context) (provider.QrcodeResult, error) {
	return provider.QrcodeResult{Key: "test-key"}, nil
}

func (m *mockAuth) CheckQrcode(ctx context.Context, key string) (provider.QrcodeStatus, error) {
	return provider.QrcodeStatus{Code: 801, Message: "waiting"}, nil
}

func (m *mockAuth) LoginStatus(ctx context.Context, cookie string) (provider.SessionResult, error) {
	return provider.SessionResult{}, nil
}

func (m *mockAuth) Logout(ctx context.Context, cookie string) error { return nil }

// mockStore 是 provider.SessionStore 的测试 mock。
type mockStore struct {
	savedUserID   string
	savedCookie   string
	deletedUserID string
}

func (m *mockStore) Get(ctx context.Context, userID string) (string, error) { return "", nil }

func (m *mockStore) Save(ctx context.Context, userID, cookie string) error {
	m.savedUserID = userID
	m.savedCookie = cookie
	return nil
}

func (m *mockStore) Delete(ctx context.Context, userID string) error {
	m.deletedUserID = userID
	return nil
}

func (m *mockStore) ListAll(ctx context.Context) ([]string, error) { return nil, nil }

// TestLoginByCellphone_SavesCookie 验证登录成功后 Cookie 存入 store。
func TestLoginByCellphone_SavesCookie(t *testing.T) {
	auth := &mockAuth{
		loginResult: provider.SessionResult{
			UserID:   "12345",
			Cookie:   "MUSIC_U=test123",
			Nickname: "tester",
		},
	}
	store := &mockStore{}

	svc := NewAuthService(auth, store, provider.NoopLogger{})
	result, err := svc.LoginByCellphone(context.Background(), "13800138000", "1234")
	if err != nil {
		t.Fatalf("登录失败: %v", err)
	}

	if result.UserID != "12345" {
		t.Errorf("UserID = %q, want 12345", result.UserID)
	}
	if store.savedUserID != "12345" {
		t.Errorf("store 未保存正确的 userID，got %q", store.savedUserID)
	}
	if store.savedCookie != "MUSIC_U=test123" {
		t.Errorf("store 未保存正确的 cookie")
	}
}

// TestLoginByCellphone_ProviderError 验证 provider 出错时透传错误。
func TestLoginByCellphone_ProviderError(t *testing.T) {
	authErr := errors.New("验证码错误")
	auth := &mockAuth{
		loginErr: authErr,
	}
	store := &mockStore{}

	svc := NewAuthService(auth, store, provider.NoopLogger{})
	_, err := svc.LoginByCellphone(context.Background(), "13800138000", "wrong")
	if !errors.Is(err, authErr) {
		t.Errorf("期望透传 provider 错误，got %v", err)
	}

	// 出错时不应保存 session
	if store.savedUserID != "" {
		t.Error("provider 出错时不应保存 session")
	}
}

// TestLogout_DeletesSession 验证登出后 session 被删除。
func TestLogout_DeletesSession(t *testing.T) {
	auth := &mockAuth{}
	store := &mockStore{}

	svc := NewAuthService(auth, store, provider.NoopLogger{})
	err := svc.Logout(context.Background(), "12345", "MUSIC_U=test")
	if err != nil {
		t.Fatalf("登出失败: %v", err)
	}

	if store.deletedUserID != "12345" {
		t.Errorf("登出后未删除 session，got deletedUserID=%q", store.deletedUserID)
	}
}

// TestLoginByCellphone_EmptyCookieNoSave 验证 Cookie 为空时不保存。
func TestLoginByCellphone_EmptyCookieNoSave(t *testing.T) {
	auth := &mockAuth{
		loginResult: provider.SessionResult{UserID: "12345", Cookie: ""},
	}
	store := &mockStore{}

	svc := NewAuthService(auth, store, provider.NoopLogger{})
	_, _ = svc.LoginByCellphone(context.Background(), "13800138000", "1234")

	if store.savedUserID != "" {
		t.Error("Cookie 为空时不应保存 session")
	}
}
