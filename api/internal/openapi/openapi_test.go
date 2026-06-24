package openapi

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSpec_BuildsWithoutError(t *testing.T) {
	spec, err := Spec()
	require.NoError(t, err)
	require.NotNil(t, spec)
	require.Equal(t, "3.0.3", spec.OpenAPI)
	require.Equal(t, "Mimo Blog API", spec.Info.Title)
	require.Equal(t, "2.0.0", spec.Info.Version)
	require.Equal(t, "/api/v1", spec.Servers[0].URL)
}

func TestSpec_JSONSerializable(t *testing.T) {
	b, err := JSON()
	require.NoError(t, err)
	require.NotEmpty(t, b)

	var m map[string]any
	require.NoError(t, json.Unmarshal(b, &m))
	require.Equal(t, "3.0.3", m["openapi"])
}

func TestCommonSchemas(t *testing.T) {
	spec, _ := Spec()
	require.Contains(t, spec.Components.Schemas, "MessageResponse")
	require.Contains(t, spec.Components.Schemas, "Pagination")
	require.Contains(t, spec.Components.Schemas, "ErrorResponse")
	require.Contains(t, spec.Components.SecuritySchemes, "cookieAuth")
}

func TestPublicPaths(t *testing.T) {
	spec, _ := Spec()
	for _, p := range []string{
		"/settings", "/github/contributions", "/github/repos",
		"/projects", "/projects/{id}", "/announcements",
		"/emojis", "/emojis/groups/{name}",
	} {
		require.NotNil(t, spec.Paths.Find(p), "missing public path %s", p)
	}
	for _, s := range []string{"PublicSettings", "ProjectDTO", "AnnouncementDTO", "EmojiDTO", "EmojiGroupDTO"} {
		require.Contains(t, spec.Components.Schemas, s, "missing schema %s", s)
	}
}
