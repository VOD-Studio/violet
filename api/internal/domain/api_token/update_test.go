package apitoken

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPATUpdate_PreservesCredentialsAndOmittedExpiry(t *testing.T) {
	now := time.Date(2026, 10, 19, 12, 0, 0, 0, time.UTC)
	expiry := now.Add(-time.Hour).Add(123456789 * time.Nanosecond)
	created := now.Add(-48 * time.Hour)
	used := now.Add(-2 * time.Hour)
	p := Reconstruct("token-id", "owner", "旧名", "immutable-hash", []string{ScopePostsRead}, expiry, used, created, true)
	name := "  新名称  "
	changes, err := p.Update(UpdateInput{Name: &name}, now)
	require.NoError(t, err)
	assert.Equal(t, []PATChange{{Field: "name", From: "旧名", To: "新名称"}}, changes)
	assert.Equal(t, "token-id", p.ID())
	assert.Equal(t, "owner", p.UserID())
	assert.Equal(t, "immutable-hash", p.TokenHash())
	assert.Equal(t, expiry, p.ExpiresAt())
	assert.Equal(t, used, p.LastUsedAt())
	assert.Equal(t, created, p.CreatedAt())
	assert.True(t, p.IsExpired(now))
	assert.True(t, p.Interactive())
}

func TestPATUpdate_AllFieldsAndNoop(t *testing.T) {
	now := time.Date(2026, 10, 19, 12, 0, 0, 0, time.UTC)
	p := Reconstruct("id", "owner", "旧名", "hash", []string{ScopePostsRead}, now.Add(time.Hour), time.Time{}, now, true)
	name, interactive, never := "新名", false, time.Time{}
	scopes := []string{ScopeNotesRead, ScopeNotesWrite}
	input := UpdateInput{Name: &name, Scopes: &scopes, ExpiresAt: &never, Interactive: &interactive}
	changes, err := p.Update(input, now)
	require.NoError(t, err)
	require.Len(t, changes, 4)
	assert.Equal(t, PATChange{Field: "expires_at", From: now.Add(time.Hour).Format(time.RFC3339Nano), To: nil}, changes[2])
	assert.Equal(t, PATChange{Field: "interactive", From: true, To: false}, changes[3])
	assert.False(t, p.HasScope(ScopePostsRead))
	assert.True(t, p.HasScope(ScopeNotesWrite))
	assert.False(t, p.Interactive())
	assert.False(t, p.IsExpired(now.AddDate(100, 0, 0)))
	scopes[0] = ScopePostsPublish
	assert.False(t, p.HasScope(ScopePostsPublish), "调用方后续修改输入不能改变令牌")
	scopes = []string{ScopeNotesRead, ScopeNotesWrite}
	changes, err = p.Update(input, now)
	require.NoError(t, err)
	assert.Empty(t, changes, "相同值不产生审计变更")
}

func TestPATUpdate_InvalidInputDoesNotMutate(t *testing.T) {
	now := time.Date(2026, 10, 19, 12, 0, 0, 0, time.UTC)
	name := "新名"
	blank, long := " \t ", strings.Repeat("令", 101)
	empty, invalid := []string{}, []string{ScopePostsRead, "unknown:scope"}
	past := now.Add(-time.Second)
	for label, input := range map[string]UpdateInput{
		"空名称":  {Name: &blank},
		"过长名称": {Name: &long},
		"空权限":  {Name: &name, Scopes: &empty},
		"非法权限": {Name: &name, Scopes: &invalid},
		"过去日期": {Name: &name, ExpiresAt: &past},
	} {
		t.Run(label, func(t *testing.T) {
			p := Reconstruct("id", "owner", "原名", "hash", []string{ScopePostsRead}, time.Time{}, time.Time{}, now, true)
			before := *p
			changes, err := p.Update(input, now)
			require.Error(t, err)
			assert.Nil(t, changes)
			assert.Equal(t, before, *p)
		})
	}
}

func TestPATUpdate_NameLimitCountsCharactersAfterTrim(t *testing.T) {
	now := time.Date(2026, 10, 19, 12, 0, 0, 0, time.UTC)
	p := Reconstruct("id", "owner", "原名", "hash", []string{ScopePostsRead}, time.Time{}, time.Time{}, now, true)
	name := "  " + strings.Repeat("令", 100) + "  "
	_, err := p.Update(UpdateInput{Name: &name}, now)
	require.NoError(t, err)
	assert.Equal(t, strings.TrimSpace(name), p.Name())
}
