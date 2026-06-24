package openapi

import (
	"encoding/json"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
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

func TestAuthPaths(t *testing.T) {
	spec, _ := Spec()
	for _, p := range []string{
		"/auth/csrf-token", "/auth/register", "/auth/verify-email", "/auth/login",
		"/auth/refresh", "/auth/forgot-password", "/auth/reset-password",
		"/auth/logout", "/auth/me", "/auth/profile", "/auth/password",
	} {
		require.NotNil(t, spec.Paths.Find(p), "missing auth path %s", p)
	}
	for _, s := range []string{"UserDTO", "LoginToken", "ProfileResponse", "CSRFToken"} {
		require.Contains(t, spec.Components.Schemas, s, "missing schema %s", s)
	}
	// 写操作需带 CSRF 头
	login := spec.Paths.Find("/auth/login").Post
	require.NotNil(t, login)
	require.True(t, hasParam(login.Parameters, "X-CSRF-Token"))
	// logout/me 需鉴权
	require.NotEmpty(t, spec.Paths.Find("/auth/logout").Post.Security)
	require.NotEmpty(t, spec.Paths.Find("/auth/me").Get.Security)
}

// hasParam 检查参数列表是否包含指定名称
func hasParam(params openapi3.Parameters, name string) bool {
	for _, p := range params {
		if p.Value.Name == name {
			return true
		}
	}
	return false
}

func TestPostPaths(t *testing.T) {
	spec, _ := Spec()
	for _, p := range []string{
		"/posts", "/posts/{slug}", "/posts/{id}/view",
		"/admin/posts", "/admin/posts/{id}", "/admin/posts/{id}/status",
	} {
		require.NotNil(t, spec.Paths.Find(p), "missing post path %s", p)
	}
	require.Contains(t, spec.Components.Schemas, "PostDTO")

	// 验证同路径多方法合并：/admin/posts/{id} 应同时有 GET/PUT/DELETE
	item := spec.Paths.Find("/admin/posts/{id}")
	require.NotNil(t, item)
	require.NotNil(t, item.Get, "missing GET /admin/posts/{id}")
	require.NotNil(t, item.Put, "missing PUT /admin/posts/{id}")
	require.NotNil(t, item.Delete, "missing DELETE /admin/posts/{id}")

	// IncrementView 返回 204
	view := spec.Paths.Find("/posts/{id}/view").Post
	desc := view.Responses.Status(204).Value.Description
	require.NotNil(t, desc)
	require.Contains(t, *desc, "浏览")

	// 后台接口需鉴权
	require.NotEmpty(t, spec.Paths.Find("/admin/posts").Get.Security)
}
