// Package command 的测试。
//
// 本文件聚焦 RefreshTokenHandler：验证原子轮换的三种结果（成功/重用/无效）
// 如何映射为返回值，尤其是「重用已废弃 token → 吊销家族 → 401 强制重登」
// 这一核心安全契约（ADR-0001 不变量 2）。
package command

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/application/mocks"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"

	"github.com/stretchr/testify/mock"
)

// testUserID 测试用固定 UUID（ParseID 要求合法 UUID 格式）
const testUserID = "00000000-0000-0000-0000-000000000001"

// testUser 构造一个最小可用的 *User，供 FindByID mock 返回。
func testUser() *domainuser.User {
	email, _ := domainuser.ParseEmail("u@example.com")
	username, _ := domainuser.ParseUsername("alice")
	pwd := domainuser.NewPasswordHash("hashed")
	uid, _ := domainshared.ParseID(testUserID)
	return domainuser.ReconstructUser(
		uid, email, username, pwd, "", "", domainuser.RoleUser,
		nil, nil, false, true, true, time.Time{}, time.Time{},
	)
}

// ============================================================
// RefreshTokenHandler
// ============================================================

// TestRefresh_Success 正常轮换：旧 token 匹配 → 返回新 token pair
func TestRefresh_Success(t *testing.T) {
	repo := new(mocks.MockUserRepository)
	jwt := new(mocks.MockTokenService)
	store := new(mocks.MockTokenStore)
	h := NewRefreshTokenHandler(repo, jwt, store)

	ctx := context.Background()
	oldToken := "old-refresh-jwt"
	claims := &appshared.Claims{UserID: testUserID}
	pair := &appshared.TokenPair{AccessToken: "new-a", RefreshToken: "new-r"}

	jwt.On("ParseToken", oldToken).Return(claims, nil)
	repo.On("FindByID", mock.Anything, mock.Anything).Return(testUser(), nil)
	jwt.On("GenerateTokenPair", mock.Anything).Return(pair, nil)
	store.On("Rotate", mock.Anything, testUserID, oldToken, "new-r").Return(appshared.RotateSuccess, nil)

	got, err := h.Handle(ctx, RefreshTokenInput{RefreshToken: oldToken})
	require.NoError(t, err)
	assert.Equal(t, pair, got)
	store.AssertExpectations(t)
}

// TestRefresh_ReuseRevokesFamily 重用已废弃 token → 家族吊销 → 401
// 这是本次修复的核心安全契约（ADR-0001 不变量 2）。
func TestRefresh_ReuseRevokesFamily(t *testing.T) {
	repo := new(mocks.MockUserRepository)
	jwt := new(mocks.MockTokenService)
	store := new(mocks.MockTokenStore)
	h := NewRefreshTokenHandler(repo, jwt, store)

	ctx := context.Background()
	staleToken := "stale-refresh-jwt" // 攻击者持有的被轮换掉的旧 token
	claims := &appshared.Claims{UserID: testUserID}
	pair := &appshared.TokenPair{AccessToken: "new-a", RefreshToken: "new-r"}

	jwt.On("ParseToken", staleToken).Return(claims, nil)
	repo.On("FindByID", mock.Anything, mock.Anything).Return(testUser(), nil)
	jwt.On("GenerateTokenPair", mock.Anything).Return(pair, nil)
	// Rotate 检测到重用 → 返回 RotateReused（Lua 已 DEL 整个家族）
	store.On("Rotate", mock.Anything, testUserID, staleToken, "new-r").Return(appshared.RotateReused, nil)

	got, err := h.Handle(ctx, RefreshTokenInput{RefreshToken: staleToken})
	require.Error(t, err)
	assert.Nil(t, got)
	assert.True(t, errors.Is(err, domainuser.ErrInvalidCredentials), "重用应映射为 401 强制重登")
}

// TestRefresh_InvalidToken 无存储 token（已登出）→ 401
func TestRefresh_InvalidToken(t *testing.T) {
	repo := new(mocks.MockUserRepository)
	jwt := new(mocks.MockTokenService)
	store := new(mocks.MockTokenStore)
	h := NewRefreshTokenHandler(repo, jwt, store)

	ctx := context.Background()
	token := "some-refresh-jwt"
	claims := &appshared.Claims{UserID: testUserID}
	pair := &appshared.TokenPair{AccessToken: "new-a", RefreshToken: "new-r"}

	jwt.On("ParseToken", token).Return(claims, nil)
	repo.On("FindByID", mock.Anything, mock.Anything).Return(testUser(), nil)
	jwt.On("GenerateTokenPair", mock.Anything).Return(pair, nil)
	store.On("Rotate", mock.Anything, testUserID, token, "new-r").Return(appshared.RotateInvalid, nil)

	got, err := h.Handle(ctx, RefreshTokenInput{RefreshToken: token})
	require.Error(t, err)
	assert.Nil(t, got)
	assert.True(t, errors.Is(err, domainuser.ErrInvalidCredentials))
}

// TestRefresh_RotateRedisError Redis 故障 → Internal 500（不应映射为 401）
func TestRefresh_RotateRedisError(t *testing.T) {
	repo := new(mocks.MockUserRepository)
	jwt := new(mocks.MockTokenService)
	store := new(mocks.MockTokenStore)
	h := NewRefreshTokenHandler(repo, jwt, store)

	ctx := context.Background()
	token := "refresh-jwt"
	claims := &appshared.Claims{UserID: testUserID}
	pair := &appshared.TokenPair{AccessToken: "new-a", RefreshToken: "new-r"}

	jwt.On("ParseToken", token).Return(claims, nil)
	repo.On("FindByID", mock.Anything, mock.Anything).Return(testUser(), nil)
	jwt.On("GenerateTokenPair", mock.Anything).Return(pair, nil)
	store.On("Rotate", mock.Anything, testUserID, token, "new-r").
		Return(appshared.RotateInvalid, errors.New("redis down"))

	_, err := h.Handle(ctx, RefreshTokenInput{RefreshToken: token})
	require.Error(t, err)
	// Redis 故障不应映射为认证错误（会泄露状态），而是 500
	assert.False(t, errors.Is(err, domainuser.ErrInvalidCredentials))
}
