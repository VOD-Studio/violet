package gorm

import (
	"context"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	authcmd "blog-api/internal/application/auth/command"
	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/user"
	infraauth "blog-api/internal/infrastructure/auth"
)

func TestRegistrationIntegration_CorrectPendingEmail(t *testing.T) {
	ctx := t.Context()
	repo := NewUserRepository(setupIntegrationDB(t))
	redisClient := redis.NewClient(&redis.Options{Addr: miniredis.RunT(t).Addr()})
	t.Cleanup(func() { require.NoError(t, redisClient.Close()) })
	codes := infraauth.NewRedisCodeStore(redisClient)
	mail := make(registrationMailbox)
	hasher, bus := authcmd.NewBcryptHasher(), appshared.NoopEventBus{}
	register := authcmd.NewRegisterUserHandler(repo, codes, mail, hasher, bus)
	verify := authcmd.NewVerifyEmailHandler(repo, codes, bus)

	in := authcmd.RegisterUserInput{Email: "typo@example.com", Username: "reader", Password: "test-password-123"}
	out, err := register.Handle(ctx, in)
	require.NoError(t, err)
	require.NotEmpty(t, out.RegistrationToken)
	oldEmail, err := user.ParseEmail(in.Email)
	require.NoError(t, err)
	original, err := repo.FindByEmail(ctx, oldEmail)
	require.NoError(t, err)
	require.False(t, original.IsActive())

	// 同地址可重发，但不取得原注册会话的改址能力。
	resend, err := register.Handle(ctx, in)
	require.NoError(t, err)
	assert.Empty(t, resend.RegistrationToken)
	oldCode := mail[in.Email]
	require.NotEmpty(t, oldCode)
	corrected := in
	corrected.Email = "reader@example.com"
	_, err = register.Handle(ctx, corrected)
	require.ErrorIs(t, err, user.ErrUsernameExists)

	occupied := authcmd.RegisterUserInput{Email: "taken@example.com", Username: "another", Password: in.Password}
	_, err = register.Handle(ctx, occupied)
	require.NoError(t, err)
	require.NoError(t, verify.Handle(ctx, authcmd.VerifyEmailInput{Email: occupied.Email, Code: mail[occupied.Email]}))
	corrected.RegistrationToken = out.RegistrationToken
	conflict := corrected
	conflict.Email = occupied.Email
	_, err = register.Handle(ctx, conflict)
	require.ErrorIs(t, err, user.ErrEmailExists)

	// 旧邮箱验码已通过 Redis 后才发生改址，数据库仍不能激活旧版本。
	staleVerify := authcmd.NewVerifyEmailHandler(repo, afterCodeMatched{CodeStore: codes, run: func() {
		_, err := register.Handle(ctx, corrected)
		require.NoError(t, err)
	}}, bus)
	err = staleVerify.Handle(ctx, authcmd.VerifyEmailInput{Email: in.Email, Code: oldCode})
	require.ErrorContains(t, err, "注册状态已变化")
	_, err = repo.FindByEmail(ctx, oldEmail)
	require.ErrorIs(t, err, user.ErrNotFound)

	newEmail, err := user.ParseEmail(corrected.Email)
	require.NoError(t, err)
	pending, err := repo.FindByEmail(ctx, newEmail)
	require.NoError(t, err)
	assert.Equal(t, original.GetID(), pending.GetID())
	assert.Equal(t, in.Username, pending.Username().String())
	assert.False(t, pending.EmailVerified())
	require.NoError(t, verify.Handle(ctx, authcmd.VerifyEmailInput{Email: corrected.Email, Code: mail[corrected.Email]}))
	login := authcmd.NewLoginHandler(repo, hasher, bus)
	loggedIn, err := login.Handle(ctx, authcmd.LoginInput{Identifier: corrected.Email, Password: in.Password})
	require.NoError(t, err)
	assert.Equal(t, original.GetID().String(), loggedIn.UserID)
	corrected.Email = in.Email
	_, err = register.Handle(ctx, corrected)
	assert.ErrorContains(t, err, "待验证注册已失效")
}

type registrationMailbox map[string]string

func (m registrationMailbox) SendVerificationCode(_ context.Context, email, code string) error {
	m[email] = code
	return nil
}

func (registrationMailbox) SendPasswordResetCode(context.Context, string, string) error { return nil }

type afterCodeMatched struct {
	appshared.CodeStore
	run func()
}

func (s afterCodeMatched) Verify(ctx context.Context, prefix, key, hash string) (bool, error) {
	matched, err := s.CodeStore.Verify(ctx, prefix, key, hash)
	if matched && err == nil {
		s.run()
	}
	return matched, err
}
