package command

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"blog-api/internal/application/mocks"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
	infraeventbus "blog-api/internal/infrastructure/eventbus"
)

// fakeLinkTokenStore LinkTokenStore 的内存 fake，模拟 Redis 语义
// （payload TTL 由 deleted 标记近似，attempts 独立计数）。
type fakeLinkTokenStore struct {
	payload  map[string]*LinkTokenPayload
	attempts map[string]int
	consumed []string
}

func newFakeLinkTokenStore() *fakeLinkTokenStore {
	return &fakeLinkTokenStore{payload: map[string]*LinkTokenPayload{}, attempts: map[string]int{}}
}

func (f *fakeLinkTokenStore) Issue(_ context.Context, p *LinkTokenPayload, _ time.Duration) (string, error) {
	token := "tok-" + p.ProviderUID
	f.payload[token] = p
	return token, nil
}

func (f *fakeLinkTokenStore) Get(_ context.Context, token string) (*LinkTokenPayload, error) {
	if p, ok := f.payload[token]; ok {
		return p, nil
	}
	return nil, errNotFoundSentinel
}

func (f *fakeLinkTokenStore) Consume(_ context.Context, token string) error {
	delete(f.payload, token)
	delete(f.attempts, token)
	f.consumed = append(f.consumed, token)
	return nil
}

func (f *fakeLinkTokenStore) IncrAttempts(_ context.Context, token string) (int, error) {
	f.attempts[token]++
	return f.attempts[token], nil
}

// errNotFoundSentinel 模拟 redis.Nil 的非 nil 错误。
var errNotFoundSentinel = domainshared.NotFound("link token")

// linkedAccount 构造带密码、已激活、绑定 github 的测试账号。
func linkedAccount(t *testing.T, email, password string) *domainuser.User {
	t.Helper()
	e, _ := domainuser.ParseEmail(email)
	un, _ := domainuser.ParseUsername("linker")
	hasher := NewBcryptHasher()
	hash, err := hasher.Hash(password)
	require.NoError(t, err)
	u := domainuser.NewUser(domainshared.NewID(), e, un, hash)
	u.VerifyEmail()
	u.Activate()
	return u
}

func TestConfirmLink(t *testing.T) {
	githubPayload := func(email string) *LinkTokenPayload {
		return &LinkTokenPayload{Provider: "github", ProviderUID: "42", Email: email, GithubLogin: "octocat"}
	}

	t.Run("密码正确绑定成功并消费 token", func(t *testing.T) {
		u := linkedAccount(t, "u@example.com", "s3cret!")
		repo := new(mocks.MockUserRepository)
		repo.On("FindByEmail", mockAnyCtx(), mustEmail("u@example.com")).Return(u, nil).Once()
		repo.On("FindByGithubID", mockAnyCtx(), "42").Return(nil, domainuser.ErrNotFound).Once()
		repo.On("Save", mockAnyCtx(), u).Return(nil).Once()
		store := newFakeLinkTokenStore()
		token, err := store.Issue(context.Background(), githubPayload("u@example.com"), linkTokenTTL)
		require.NoError(t, err)

		h := NewConfirmLinkHandler(repo, store, NewBcryptHasher(), infraeventbus.NewInMemory())
		out, err := h.Handle(context.Background(), ConfirmLinkInput{LinkToken: token, Password: "s3cret!"})

		require.NoError(t, err)
		assert.Equal(t, u.GetID().String(), out.UserID)
		assert.Equal(t, "42", *u.GithubID())
		assert.Equal(t, "octocat", *u.GithubLogin())
		assert.Contains(t, store.consumed, token, "绑定成功后 token 应被一次性消费")
	})

	t.Run("密码错误不消费 token，五次后作废", func(t *testing.T) {
		u := linkedAccount(t, "u@example.com", "s3cret!")
		store := newFakeLinkTokenStore()
		token, err := store.Issue(context.Background(), githubPayload("u@example.com"), linkTokenTTL)
		require.NoError(t, err)
		h := NewConfirmLinkHandler(newFindEmailRepo(u), store, NewBcryptHasher(), infraeventbus.NewInMemory())

		for i := 1; i <= maxLinkPasswordAttempts; i++ {
			_, err := h.Handle(context.Background(), ConfirmLinkInput{LinkToken: token, Password: "wrong"})
			require.Error(t, err, "第 %d 次错误密码应失败", i)
			if i < maxLinkPasswordAttempts {
				_, gerr := store.Get(context.Background(), token)
				require.NoError(t, gerr, "未超限前 token 不应被消费")
			}
		}
		_, gerr := store.Get(context.Background(), token)
		require.Error(t, gerr, "达上限后 token 应被作废")
	})

	t.Run("token 无效返回过期错误", func(t *testing.T) {
		h := NewConfirmLinkHandler(new(mocks.MockUserRepository), newFakeLinkTokenStore(), NewBcryptHasher(), infraeventbus.NewInMemory())
		_, err := h.Handle(context.Background(), ConfirmLinkInput{LinkToken: "nope", Password: "x"})
		assert.ErrorIs(t, err, ErrLinkTokenInvalid)
	})

	t.Run("无密码账号引导走忘记密码", func(t *testing.T) {
		e, _ := domainuser.ParseEmail("oauth@example.com")
		un, _ := domainuser.ParseUsername("oauthonly")
		u := domainuser.NewUser(domainshared.NewID(), e, un, domainuser.NewPasswordHash(""))
		u.Activate()
		store := newFakeLinkTokenStore()
		token, _ := store.Issue(context.Background(), githubPayload("oauth@example.com"), linkTokenTTL)
		h := NewConfirmLinkHandler(newFindEmailRepo(u), store, NewBcryptHasher(), infraeventbus.NewInMemory())

		_, err := h.Handle(context.Background(), ConfirmLinkInput{LinkToken: token, Password: "whatever"})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "未设置密码")
	})

	t.Run("provider 身份已被其他账号绑定返回冲突", func(t *testing.T) {
		u := linkedAccount(t, "u@example.com", "s3cret!")
		other := linkedAccount(t, "other@example.com", "s3cret!")
		other.SetGithubID("42")
		repo := new(mocks.MockUserRepository)
		repo.On("FindByEmail", mockAnyCtx(), mustEmail("u@example.com")).Return(u, nil).Once()
		repo.On("FindByGithubID", mockAnyCtx(), "42").Return(other, nil).Once()
		store := newFakeLinkTokenStore()
		token, _ := store.Issue(context.Background(), githubPayload("u@example.com"), linkTokenTTL)
		h := NewConfirmLinkHandler(repo, store, NewBcryptHasher(), infraeventbus.NewInMemory())

		_, err := h.Handle(context.Background(), ConfirmLinkInput{LinkToken: token, Password: "s3cret!"})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "已绑定其他账号")
	})

	t.Run("禁用账号拒绝登录", func(t *testing.T) {
		u := linkedAccount(t, "u@example.com", "s3cret!")
		u.Deactivate()
		store := newFakeLinkTokenStore()
		token, _ := store.Issue(context.Background(), githubPayload("u@example.com"), linkTokenTTL)
		h := NewConfirmLinkHandler(newFindEmailRepo(u), store, NewBcryptHasher(), infraeventbus.NewInMemory())

		_, err := h.Handle(context.Background(), ConfirmLinkInput{LinkToken: token, Password: "s3cret!"})
		assert.ErrorIs(t, err, domainuser.ErrAccountDisabled)
	})
}

// newFindEmailRepo 固定按 email 返回 u、provider id 未绑定的最简 mock。
func newFindEmailRepo(u *domainuser.User) *mocks.MockUserRepository {
	repo := new(mocks.MockUserRepository)
	repo.On("FindByEmail", mockAnyCtx(), mockAnything()).Return(u, nil)
	repo.On("FindByGoogleID", mockAnyCtx(), mockAnything()).Return(nil, domainuser.ErrNotFound)
	repo.On("FindByGithubID", mockAnyCtx(), mockAnything()).Return(nil, domainuser.ErrNotFound)
	repo.On("Save", mockAnyCtx(), mockAnything()).Return(nil)
	return repo
}

func TestMaskEmail(t *testing.T) {
	assert.Equal(t, "a***@x.com", maskEmail("alice@x.com"))
	assert.Equal(t, "***", maskEmail("no-at-sign"))
	assert.Equal(t, "b***@sub.domain.com", maskEmail("bob@sub.domain.com"))
}

// mockAnyCtx/mockAnything 收敛 testify matcher 构造。
func mockAnyCtx() any { return mock.Anything }
func mockAnything() any { return mock.Anything }

