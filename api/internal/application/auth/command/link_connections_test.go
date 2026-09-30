package command

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"blog-api/internal/application/mocks"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
	infraeventbus "blog-api/internal/infrastructure/eventbus"
)

// T5(#453)：解绑前置校验——解绑后必须仍有登录方式。
func TestUnbindProvider(t *testing.T) {
	newRepo := func(u *domainuser.User) *mocks.MockUserRepository {
		repo := new(mocks.MockUserRepository)
		repo.On("FindByID", mock.Anything, mock.Anything).Return(u, nil)
		repo.On("Save", mock.Anything, mock.Anything).Return(nil)
		return repo
	}

	t.Run("有密码解绑成功", func(t *testing.T) {
		u := linkedAccount(t, "u@example.com", "s3cret!")
		u.SetGithubID("42")
		h := NewUnbindProviderHandler(newRepo(u), infraeventbus.NewInMemory())

		dto, err := h.Handle(context.Background(), UnbindInput{UserID: u.GetID().String(), Provider: "github"})
		require.NoError(t, err)
		assert.Nil(t, u.GithubID())
		assert.Nil(t, u.GithubLogin(), "解绑需同时清 login 快照")
		assert.True(t, dto.HasPassword)
		assert.False(t, dto.GithubBound)
	})

	t.Run("无密码且无其他 OAuth 解绑被拒", func(t *testing.T) {
		e, _ := domainuser.ParseEmail("oauth@example.com")
		un, _ := domainuser.ParseUsername("oauthonly")
		u := domainuser.NewUser(domainshared.NewID(), e, un, domainuser.NewPasswordHash(""))
		u.Activate()
		u.SetGithubID("42")
		repo := new(mocks.MockUserRepository)
		repo.On("FindByID", mock.Anything, mock.Anything).Return(u, nil)
		h := NewUnbindProviderHandler(repo, infraeventbus.NewInMemory())

		_, err := h.Handle(context.Background(), UnbindInput{UserID: u.GetID().String(), Provider: "github"})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "没有任何登录方式")
		assert.NotNil(t, u.GithubID(), "被拒时不得解绑")
	})

	t.Run("未绑定的 provider 返回 400", func(t *testing.T) {
		u := linkedAccount(t, "u@example.com", "s3cret!")
		h := NewUnbindProviderHandler(newRepo(u), infraeventbus.NewInMemory())

		_, err := h.Handle(context.Background(), UnbindInput{UserID: u.GetID().String(), Provider: "github"})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "未绑定")
	})

	t.Run("未知 provider 返回 400", func(t *testing.T) {
		u := linkedAccount(t, "u@example.com", "s3cret!")
		h := NewUnbindProviderHandler(newRepo(u), infraeventbus.NewInMemory())

		_, err := h.Handle(context.Background(), UnbindInput{UserID: u.GetID().String(), Provider: "wechat"})
		require.Error(t, err)
	})
}
