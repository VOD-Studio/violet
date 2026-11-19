package repositoryactivity

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRepositoryKey(t *testing.T) {
	for _, raw := range []string{"https://github.com/VOD-Studio/Violet", "HTTPS://GitHub.Com/VOD-Studio/Violet/"} {
		key, ok := RepositoryKey(raw)
		assert.True(t, ok, raw)
		assert.Equal(t, "vod-studio/violet", key, raw)
	}
	for _, raw := range []string{
		"http://github.com/owner/repo",
		"https://github.com:443/owner/repo",
		"https://github.com@wrong.invalid/owner/repo",
		"https://github.com.wrong.invalid/owner/repo",
		"https://github.com/owner/repo/tree/main",
		"https://github.com/owner/repo?query=a",
		"https://github.com/owner/repo#readme",
		"https://github.com/owner/repo//",
		"https://github.com/owner/..",
		"https://github.com/owner/%2e%2e",
		"https://github.com/owner/Kelvin",
	} {
		key, ok := RepositoryKey(raw)
		assert.False(t, ok, raw)
		assert.Empty(t, key, raw)
	}
}
