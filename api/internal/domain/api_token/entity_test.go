package apitoken

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestNewPAT_SetsDefaults(t *testing.T) {
	now := time.Date(2026, 7, 27, 12, 0, 0, 0, time.UTC)
	expires := now.Add(90 * 24 * time.Hour)
	p, hash, err := NewPAT("u-1", "我的令牌", []string{ScopePostsRead, ScopePostsWrite}, expires, now)
	assert.NoError(t, err)
	assert.Equal(t, "u-1", p.UserID())
	assert.Equal(t, "我的令牌", p.Name())
	assert.Equal(t, []string{ScopePostsRead, ScopePostsWrite}, p.Scopes())
	assert.NotEmpty(t, hash, "应返回 token 哈希")
	assert.True(t, p.ExpiresAt().Equal(expires), "过期时间应等于传入的 expiresAt")
	assert.True(t, p.CreatedAt().Equal(now))
}

func TestNewPAT_NeverExpires(t *testing.T) {
	now := time.Now()
	p, _, err := NewPAT("u-1", "永久", []string{ScopePostsRead}, time.Time{}, now)
	assert.NoError(t, err)
	assert.True(t, p.ExpiresAt().IsZero(), "零值 expiresAt = 永不过期")
}

func TestNewPAT_RejectsInvalidScope(t *testing.T) {
	_, _, err := NewPAT("u-1", "x", []string{"posts:read", "bogus:scope"}, time.Time{}, time.Now())
	assert.Error(t, err, "未知 scope 必须拒绝")
}

func TestNewPAT_RejectsEmptyScopes(t *testing.T) {
	_, _, err := NewPAT("u-1", "x", nil, time.Time{}, time.Now())
	assert.Error(t, err, "至少要有一个 scope")
}

func TestPAT_HasScope(t *testing.T) {
	p, _, _ := NewPAT("u-1", "x", []string{ScopePostsRead, ScopePostsPublish}, time.Time{}, time.Time{})
	assert.True(t, p.HasScope(ScopePostsRead))
	assert.True(t, p.HasScope(ScopePostsPublish))
	assert.False(t, p.HasScope(ScopePostsWrite), "未授予的 scope 应为 false")
}

func TestPAT_IsExpired(t *testing.T) {
	now := time.Date(2026, 7, 27, 12, 0, 0, 0, time.UTC)

	t.Run("never_expires", func(t *testing.T) {
		p, _, _ := NewPAT("u-1", "x", []string{ScopePostsRead}, time.Time{}, now)
		assert.False(t, p.IsExpired(now.Add(10 * 365 * 24 * time.Hour)))
	})

	t.Run("not_yet_expired", func(t *testing.T) {
		expires := now.Add(90 * 24 * time.Hour)
		p, _, _ := NewPAT("u-1", "x", []string{ScopePostsRead}, expires, now)
		assert.False(t, p.IsExpired(now.Add(89 * 24 * time.Hour)))
	})

	t.Run("expired", func(t *testing.T) {
		expires := now.Add(90 * 24 * time.Hour)
		p, _, _ := NewPAT("u-1", "x", []string{ScopePostsRead}, expires, now)
		assert.True(t, p.IsExpired(now.Add(91 * 24 * time.Hour)))
	})
}

func TestReconstruct_PreservesAllFields(t *testing.T) {
	created := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	expires := created.Add(365 * 24 * time.Hour)
	lastUsed := created.Add(24 * time.Hour)
	p := Reconstruct("tok-id", "u-1", "名字", "thehash",
		[]string{ScopePostsWrite}, expires, lastUsed, created)
	assert.Equal(t, "tok-id", p.ID())
	assert.Equal(t, "u-1", p.UserID())
	assert.Equal(t, "名字", p.Name())
	assert.Equal(t, "thehash", p.TokenHash())
	assert.Equal(t, []string{ScopePostsWrite}, p.Scopes())
	assert.True(t, p.ExpiresAt().Equal(expires))
	assert.True(t, p.LastUsedAt().Equal(lastUsed))
	assert.True(t, p.CreatedAt().Equal(created))
}
