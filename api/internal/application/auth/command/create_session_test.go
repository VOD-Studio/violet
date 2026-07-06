package command

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/application/mocks"
	domainuser "blog-api/internal/domain/user"
	"github.com/stretchr/testify/mock"
)

// TestCreateSession_PersistsAndReturnsID 验证 CreateSession 持久化 session 并返回非空 id 与 csrf。
func TestCreateSession_PersistsAndReturnsID(t *testing.T) {
	repo := new(mocks.MockUserRepository)
	store := new(mocks.MockSessionStore)
	h := NewCreateSessionHandler(repo, store)

	repo.On("FindByID", mock.Anything, mock.Anything).Return(testUser(), nil)
	store.On("Create", mock.Anything, mock.Anything, mock.Anything).Return(nil)

	out, err := h.Handle(context.Background(), CreateSessionInput{
		UserID:  testUserID,
		IdleTTL: 7 * 24 * time.Hour,
		MaxTTL:  0,
	})
	require.NoError(t, err)
	assert.NotEmpty(t, out.SessionID, "session id 非空")
	assert.NotEmpty(t, out.CSRFToken, "csrf token 非空")
	store.AssertExpectations(t)
}

// TestCreateSession_UserNotFoundReturns401 用户不存在映射为 ErrInvalidCredentials（401）。
func TestCreateSession_UserNotFoundReturns401(t *testing.T) {
	repo := new(mocks.MockUserRepository)
	store := new(mocks.MockSessionStore)
	h := NewCreateSessionHandler(repo, store)

	repo.On("FindByID", mock.Anything, mock.Anything).Return((*domainuser.User)(nil), domainuser.ErrNotFound)

	_, err := h.Handle(context.Background(), CreateSessionInput{
		UserID:  testUserID,
		IdleTTL: time.Hour,
		MaxTTL:  0,
	})
	require.Error(t, err)
	assert.ErrorIs(t, err, domainuser.ErrInvalidCredentials, "用户不存在应映射为 401")
	store.AssertNotCalled(t, "Create", "用户不存在时不应创建 session")
}
