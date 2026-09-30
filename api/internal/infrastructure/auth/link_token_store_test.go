package auth

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	authcmd "blog-api/internal/application/auth/command"
	domainshared "blog-api/internal/domain/shared"
)

func TestLinkTokenStore(t *testing.T) {
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	store := NewRedisLinkTokenStore(client)
	payload := &authcmd.LinkTokenPayload{
		Provider: "github", ProviderUID: "42", Email: "u@example.com", GithubLogin: "octocat",
	}
	ctx := context.Background()
	token, err := store.Issue(ctx, payload, 5*time.Minute)
	require.NoError(t, err)
	assert.Len(t, token, 64, "256-bit hex 编码应为 64 字符")

	got, err := store.Get(ctx, token)
	require.NoError(t, err)
	assert.Equal(t, payload, got)

	// 密码错误重试：Get 不消费
	_, err = store.Get(ctx, token)
	require.NoError(t, err)

	n, err := store.IncrAttempts(ctx, token)
	require.NoError(t, err)
	assert.Equal(t, 1, n)
	n, err = store.IncrAttempts(ctx, token)
	require.NoError(t, err)
	assert.Equal(t, 2, n)

	// Consume 一次性删除 payload 与计数
	require.NoError(t, store.Consume(ctx, token))
	_, err = store.Get(ctx, token)
	var notFound *domainshared.DomainError
	require.ErrorAs(t, err, &notFound, "消费后 Get 应为 NotFound 而非存储故障")
	assert.True(t, domainshared.IsDomainError(err, domainshared.CodeNotFound))
	n, err = store.IncrAttempts(ctx, token)
	require.NoError(t, err)
	assert.Equal(t, 1, n, "消费后计数应重置（新 key）")

	// 无效 token
	_, err = store.Get(ctx, "bogus")
	require.ErrorAs(t, err, &notFound, "无效 token 应为 NotFound")
	assert.True(t, domainshared.IsDomainError(err, domainshared.CodeNotFound))

	// TTL：payload 到期即不可读（miniredis 快进）
	token2, err := store.Issue(ctx, payload, 50*time.Millisecond)
	require.NoError(t, err)
	mr.FastForward(100 * time.Millisecond)
	_, err = store.Get(ctx, token2)
	require.ErrorAs(t, err, &notFound, "过期 payload 应为 NotFound")
	assert.True(t, domainshared.IsDomainError(err, domainshared.CodeNotFound))
}
