package settings

import (
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestNormalizeFooterGitHubURL(t *testing.T) {
	for raw, want := range map[string]string{
		"":                                "",
		"  https://GitHub.com/octocat/  ": "https://github.com/octocat",
		"https://user:secret@github.com//VOD-Studio/violet/?token=secret#readme": "https://github.com/VOD-Studio/violet",
	} {
		got, err := NormalizeFooterGitHubURL(raw)
		require.NoError(t, err)
		assert.Equal(t, want, got)
	}
	for _, raw := range []string{"javascript:alert(1)", "http://github.com/octocat", "https://github.com.evil.example/octocat", "https://github.com@evil.example/octocat", "https://github.com/", "https://github.com/owner/repo/issues", "https://github.com/owner/..", "https://github.com/owner/%2e%2e", "https://github.com/owner/repo%5cname"} {
		_, err := NormalizeFooterGitHubURL(raw)
		require.Error(t, err, raw)
	}
}
