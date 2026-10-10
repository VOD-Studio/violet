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
	u := domainuser.ReconstructUser(uid, mustEmail("u@example.com"), mustUsername("alice"), domainuser.DisplayName{}, oldHash, "", "", "", domainuser.RoleUser, nil, nil, nil, false, true, true, zeroTime, zeroTime, zeroTime)

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
	u := domainuser.ReconstructUser(uid, mustEmail("u@example.com"), mustUsername("alice"), domainuser.DisplayName{}, oldHash, "", "", "", domainuser.RoleUser, nil, nil, nil, false, true, true, zeroTime, zeroTime, zeroTime)
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
	u := domainuser.ReconstructUser(uid, mustEmail("u@example.com"), mustUsername("alice"), domainuser.DisplayName{}, oldHash, "", "", "", domainuser.RoleUser, nil, nil, nil, false, true, true, zeroTime, zeroTime, zeroTime)

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

func TestUpdateProfile_CoverPartialUpdate(t *testing.T) {
	const originalCover = "https://example.com/original.gif?crop=1,2,300,100"
	const croppedCover = "https://example.com/cover.gif?crop=12,24,640,240"
	for _, tc := range []struct {
		name  string
		cover *string
		want  string
	}{
		{name: "省略保留封面", want: originalCover},
		{name: "空串移除封面", cover: new(""), want: ""},
		{name: "保留 GIF 裁剪坐标", cover: new(croppedCover), want: croppedCover},
	} {
		t.Run(tc.name, func(t *testing.T) {
			u := testUser()
			u.UpdateProfile("https://example.com/avatar.png", "原简介")
			u.UpdateCoverURL(originalCover)
			repo := new(mocks.MockUserRepository)
			repo.On("FindByID", mock.Anything, u.GetID()).Return(u, nil)
			repo.On("Save", mock.Anything, mock.MatchedBy(func(saved *domainuser.User) bool {
				return saved.CoverURL() == tc.want &&
					saved.AvatarURL() == "https://example.com/avatar.png" &&
					saved.Bio() == "原简介"
			})).Return(nil).Once()
			_, err := NewUpdateProfileHandler(repo).Handle(context.Background(), UpdateProfileInput{
				UserID: testUserID, CoverURL: tc.cover,
			})
			require.NoError(t, err)
			repo.AssertExpectations(t)
		})
	}
}

func TestUpdateProfile_CoverSaveFailure(t *testing.T) {
	u := testUser()
	repo := new(mocks.MockUserRepository)
	repo.On("FindByID", mock.Anything, u.GetID()).Return(u, nil)
	saveErr := domainshared.Internal("保存用户失败", nil)
	repo.On("Save", mock.Anything, u).Return(saveErr).Once()
	updated, err := NewUpdateProfileHandler(repo).Handle(context.Background(), UpdateProfileInput{
		UserID: testUserID, CoverURL: new("https://example.com/cover.gif?crop=12,24,640,240"),
	})
	require.ErrorIs(t, err, saveErr)
	require.Nil(t, updated)
	repo.AssertExpectations(t)
}
