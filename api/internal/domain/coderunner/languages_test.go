package coderunner

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeLang(t *testing.T) {
	t.Parallel()
	cases := []struct {
		input string
		want  string
	}{
		{"python", "python"},
		{"node", "node"},
		{"go", "go"},
		{"rust", "rust"},
		{"bun", "bun"},
		{"js", "node"},
		{"javascript", "node"},
		{"rs", "rust"},
		{"ts", "bun"},
		{"typescript", "bun"},
		{"JavaScript", "node"},
		{"  JS  ", "node"},
		{"\tRS\t", "rust"},
		{"ruby", "ruby"},
		{"", ""},
	}
	for _, tc := range cases {
		t.Run(tc.input, func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, tc.want, NormalizeLang(tc.input))
		})
	}
}

func TestNormalizeLanguagesPreservesWhitelist(t *testing.T) {
	languages, err := NormalizeLanguages([]string{" JS ", "javascript", "node", "TS", "typescript", "rs", "RUST", "", "python"})
	require.NoError(t, err)
	assert.Equal(t, []string{"node", "bun", "rust", "python"}, languages)

	languages, err = NormalizeLanguages([]string{})
	require.NoError(t, err)
	assert.Equal(t, []string{}, languages)

	languages, err = NormalizeLanguages([]string{"js", "ruby"})
	require.Error(t, err)
	assert.Nil(t, languages)
	assert.Contains(t, err.Error(), "ruby")
}
