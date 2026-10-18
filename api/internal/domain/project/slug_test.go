package project

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/shared"
)

func TestGenerateSlug(t *testing.T) {
	id := shared.MustParseID("550e8400-e29b-41d4-a716-446655440000")
	for _, tc := range []struct{ title, want string }{
		{" Violet / Go 2026! ", "violet-go-2026"},
		{"React 项目", "react"},
		{"我的项目", "project-" + id.String()},
		{"✨!!!", "project-" + id.String()},
		{strings.Repeat("a", 60) + "-more", strings.Repeat("a", 60)},
		{strings.Repeat("a", 59) + "-more", strings.Repeat("a", 59)},
	} {
		t.Run(tc.title, func(t *testing.T) {
			got := GenerateSlug(tc.title, id)
			assert.Equal(t, tc.want, got)
			assert.True(t, IsValidSlug(got))
			assert.Equal(t, got, GenerateSlug(tc.title, id))
		})
	}
}

func TestProject_SetSlugPreservesValueOnInvalidInput(t *testing.T) {
	p, err := NewProject(shared.NewID(), "Violet", "")
	require.NoError(t, err)
	for _, slug := range []string{"", "UPPER", "has space", "-leading", "trailing-", "double--dash", "中文", strings.Repeat("a", 256)} {
		assert.Error(t, p.SetSlug(slug), "slug=%q", slug)
		assert.Equal(t, "violet", p.Slug())
	}
	require.NoError(t, p.SetSlug("violet-2"))
	assert.Equal(t, "violet-2", p.Slug())
}
