package command

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"blog-api/internal/application/mocks"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
)

// TestChangePassword_RevokesAllSessions 验证改密成功后吊销该用户全部 session。
// 对应 Issue-0003：ChangePassword 持有 sessionStore，密码更新成功调 DeleteByUser。
func TestChangePassword_RevokesAllSessions(t *testing.T) {
	repo := new(mocks.MockUserRepository)
	store := new(mocks.MockSessionStore)
	hasher := NewBcryptHasher()
	h := NewChangePasswordHandler(repo, hasher, store)

	uid, _ := domainshared.ParseID(testUserID)
	// 预先用真实 bcrypt 哈希旧密码，使 Compare 通过
	oldHash, err := hasher.Hash("old-pass-123")
	require.NoError(t, err)
	u := domainuser.ReconstructUser(uid, mustEmail("u@example.com"), mustUsername("alice"), domainuser.DisplayName{}, oldHash, "", "", domainuser.RoleUser, nil, nil, false, true, true, zeroTime, zeroTime,)

	repo.On("FindByID", mock.Anything, uid).Return(u, nil)
	repo.On("Save", mock.Anything, mock.Anything).Return(nil)
	// 核心断言：DeleteByUser 以该用户 ID 被调用一次
	store.On("DeleteByUser", mock.Anything, testUserID).Return(nil)

	err = h.Handle(context.Background(), ChangePasswordInput{
		UserID:      testUserID,
		OldPassword: "old-pass-123",
		NewPassword: "new-pass-456",
	})
	require.NoError(t, err)
	store.AssertNumberOfCalls(t, "DeleteByUser", 1)
}

// TestChangePassword_WrongOldPasswordSkipsRevoke 验证旧密码错误时不改密也不吊销。
func TestChangePassword_WrongOldPasswordSkipsRevoke(t *testing.T) {
	repo := new(mocks.MockUserRepository)
	store := new(mocks.MockSessionStore)
	hasher := NewBcryptHasher()
	h := NewChangePasswordHandler(repo, hasher, store)

	uid, _ := domainshared.ParseID(testUserID)
	oldHash, err := hasher.Hash("correct-old")
	require.NoError(t, err)
	u := domainuser.ReconstructUser(uid, mustEmail("u@example.com"), mustUsername("alice"), domainuser.DisplayName{}, oldHash, "", "", domainuser.RoleUser, nil, nil, false, true, true, zeroTime, zeroTime,)
	repo.On("FindByID", mock.Anything, uid).Return(u, nil)

	err = h.Handle(context.Background(), ChangePasswordInput{
		UserID:      testUserID,
		OldPassword: "wrong-old",
		NewPassword: "new-pass-456",
	})
	require.ErrorIs(t, err, domainuser.ErrInvalidCredentials)
	store.AssertNotCalled(t, "DeleteByUser", "旧密码错误时不应吊销 session")
}

// TestResetPassword_RevokesAllSessions 验证重置密码成功后吊销该用户全部 session。
// 对应 Issue-0003：ResetPassword 持有 sessionStore，密码更新成功调 DeleteByUser。
func TestResetPassword_RevokesAllSessions(t *testing.T) {
	repo := new(mocks.MockUserRepository)
	codeStore := new(mocks.MockCommentCodeStore)
	store := new(mocks.MockSessionStore)
	hasher := NewBcryptHasher()
	h := NewResetPasswordHandler(repo, codeStore, hasher, store)

	uid, _ := domainshared.ParseID(testUserID)
	oldHash, err := hasher.Hash("irrelevant")
	require.NoError(t, err)
	u := domainuser.ReconstructUser(uid, mustEmail("u@example.com"), mustUsername("alice"), domainuser.DisplayName{}, oldHash, "", "", domainuser.RoleUser, nil, nil, false, true, true, zeroTime, zeroTime,)

	// 重置码校验通过
	codeStore.On("Verify", mock.Anything, "reset", "u@example.com", mock.Anything).Return(true, nil)
	repo.On("FindByEmail", mock.Anything, mock.Anything).Return(u, nil)
	repo.On("Save", mock.Anything, mock.Anything).Return(nil)
	// 核心断言：DeleteByUser 以该用户 ID 被调用一次
	store.On("DeleteByUser", mock.Anything, testUserID).Return(nil)

	err = h.Handle(context.Background(), ResetPasswordInput{
		Email:       "u@example.com",
		Code:        "123456",
		NewPassword: "new-pass-456",
	})
	require.NoError(t, err)
	store.AssertNumberOfCalls(t, "DeleteByUser", 1)
}
