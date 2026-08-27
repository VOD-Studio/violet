package mcp
import (
	"context"
	"testing"
	"time"

	"github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainapitoken "blog-api/internal/domain/api_token"
)

// fakeLookup 内存版 TokenLookup，按 hash 注入 PAT。
type fakeLookup struct {
	pat  *domainapitoken.PAT
	err  error
	lastTouchedID string
}

func (f *fakeLookup) FindByHash(_ context.Context, _ string) (*domainapitoken.PAT, error) {
	return f.pat, f.err
}

func (f *fakeLookup) TouchLastUsed(_ context.Context, id string, _ time.Time) error {
	f.lastTouchedID = id
	return nil
}

// TestPATVerifier_NeverExpiring_ReturnsNonZeroExpiration 验证修复：
// 永不过期（ExpiresAt 零值）的 PAT 必须投影为非零远期时间，
// 否则 SDK auth.RequireBearerToken 会以 "token missing expiration" 回 401。
func TestPATVerifier_NeverExpiring_ReturnsNonZeroExpiration(t *testing.T) {
	t.Parallel()
	now := time.Now()
	p := domainapitoken.Reconstruct(
		"tok-1", "u-1", "agent",
		"hash-1", []string{domainapitoken.ScopePostsRead},
		time.Time{}, // 零值 = 永不过期
		time.Time{}, now,
		true)
	v := NewPATVerifier(&fakeLookup{pat: p})

	info, err := v.Verify(context.Background(), "raw-token", nil)
	require.NoError(t, err)
	require.NotNil(t, info)
	assert.False(t, info.Expiration.IsZero(),
		"永不过期 PAT 必须返回非零 Expiration，否则 SDK 中间件回 401")
	assert.True(t, info.Expiration.After(now), "投影的过期时间应在未来")
	assert.Equal(t, "u-1", info.UserID)
	assert.Equal(t, []string{domainapitoken.ScopePostsRead}, info.Scopes)
}

// TestPATVerifier_WithExplicitExpiry_PassesThrough 真实过期时间的 PAT
// 必须原样透传，不被改写。
func TestPATVerifier_WithExplicitExpiry_PassesThrough(t *testing.T) {
	t.Parallel()
	exp := time.Now().Add(90 * 24 * time.Hour) // 90 天后
	p := domainapitoken.Reconstruct(
		"tok-2", "u-2", "ci",
		"hash-2", []string{domainapitoken.ScopePostsWrite},
		exp, time.Time{}, time.Now(),
		true)
	v := NewPATVerifier(&fakeLookup{pat: p})

	info, err := v.Verify(context.Background(), "raw", nil)
	require.NoError(t, err)
	require.NotNil(t, info)
	assert.True(t, info.Expiration.Equal(exp), "显式过期时间应原样透传")
}

// TestPATVerifier_NotFound_ReturnsInvalidToken 查不到 token
// 返回 auth.ErrInvalidToken（SDK 据此回 401）。
func TestPATVerifier_NotFound_ReturnsInvalidToken(t *testing.T) {
	t.Parallel()
	v := NewPATVerifier(&fakeLookup{err: domainapitoken.ErrNotFound})

	_, err := v.Verify(context.Background(), "raw", nil)
	require.Error(t, err)
	assert.ErrorIs(t, err, auth.ErrInvalidToken)
}

// TestPATVerifier_Expired_ReturnsInvalidToken 已过期 PAT（ExpiresAt 在过去）
// 返回 auth.ErrInvalidToken。
func TestPATVerifier_Expired_ReturnsInvalidToken(t *testing.T) {
	t.Parallel()
	past := time.Now().Add(-time.Hour)
	p := domainapitoken.Reconstruct(
		"tok-3", "u-3", "old",
		"hash-3", []string{domainapitoken.ScopePostsRead},
		past, time.Time{}, time.Now().Add(-2*time.Hour),
		true)
	v := NewPATVerifier(&fakeLookup{pat: p})

	_, err := v.Verify(context.Background(), "raw", nil)
	require.Error(t, err)
	assert.ErrorIs(t, err, auth.ErrInvalidToken)
}

// TestPATVerifier_TouchesLastUsedAsync 成功校验后异步刷新 last_used_at。
// 不阻塞响应：调用返回时 TouchLastUsed 可能尚未执行，用轮询断言。
func TestPATVerifier_TouchesLastUsedAsync(t *testing.T) {
	t.Parallel()
	p := domainapitoken.Reconstruct(
		"tok-touch", "u-1", "agent",
		"hash-touch", []string{domainapitoken.ScopePostsRead},
		time.Now().Add(time.Hour), time.Time{}, time.Now(),
		true)
	fl := &fakeLookup{pat: p}
	v := NewPATVerifier(fl)

	_, err := v.Verify(context.Background(), "raw", nil)
	require.NoError(t, err)

	// 异步刷新：最多等 200ms
	deadline := time.Now().Add(200 * time.Millisecond)
	for time.Now().Before(deadline) && fl.lastTouchedID == "" {
		time.Sleep(5 * time.Millisecond)
	}
	assert.Equal(t, "tok-touch", fl.lastTouchedID, "应异步刷新 last_used_at")
}
