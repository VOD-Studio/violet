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
	require.Equal(t, "Violet API", spec.Info.Title)
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
		"/auth/session", "/auth/forgot-password", "/auth/reset-password",
		"/auth/logout", "/auth/me", "/auth/profile", "/auth/password",
	} {
		require.NotNil(t, spec.Paths.Find(p), "missing auth path %s", p)
	}
	for _, s := range []string{"UserDTO", "LoginResponse", "SessionResponse", "ProfileResponse", "CSRFToken"} {
		require.Contains(t, spec.Components.Schemas, s, "missing schema %s", s)
	}
	// 写操作需带 CSRF 头
	login := spec.Paths.Find("/auth/login").Post
	require.NotNil(t, login)
	require.True(t, hasParam(login.Parameters, "X-CSRF-Token"))
	// logout/me/session 需鉴权
	require.NotEmpty(t, spec.Paths.Find("/auth/logout").Post.Security)
	require.NotEmpty(t, spec.Paths.Find("/auth/me").Get.Security)
	require.NotEmpty(t, spec.Paths.Find("/auth/session").Get.Security)
}

func TestChatPaths(t *testing.T) {
	spec, _ := Spec()
	for _, path := range []string{
		"/chat/conversations",
		"/chat/conversations/{conversationId}",
		"/chat/conversations/{conversationId}/members",
		"/chat/conversations/{conversationId}/messages",
		"/chat/conversations/{conversationId}/read",
		"/chat/conversations/{conversationId}/typing",
		"/chat/events",
		"/chat/unread-count",
		"/chat/push/subscription",
	} {
		require.NotNil(t, spec.Paths.Find(path), "missing chat path %s", path)
	}
	require.Contains(t, spec.Components.Schemas, "ChatEventDTO")
	require.Contains(t, spec.Components.Schemas, "ChatMessageDTO")
	require.Contains(t, spec.Components.Schemas, "ChatMessageReferenceDTO")
	require.Contains(t, spec.Components.Schemas, "ChatSharedTweetDTO")
	require.Contains(t, spec.Components.Schemas["ChatMessageDTO"].Value.Properties, "reply_to")
	require.Contains(t, spec.Components.Schemas["ChatMessageDTO"].Value.Properties, "shared_tweet")
	require.Contains(t, spec.Components.Schemas["ChatSendMessageRequest"].Value.Properties, "reply_to_id")
	require.Contains(t, spec.Components.Schemas["ChatSendMessageRequest"].Value.Properties, "shared_tweet_id")
	send := spec.Paths.Find("/chat/conversations/{conversationId}/messages").Post
	require.NotNil(t, send)
	require.True(t, hasParam(send.Parameters, "Idempotency-Key"))
}
func TestCustomEmojiPaths(t *testing.T) {
	spec, _ := Spec()
	for _, path := range []string{
		"/custom-emojis",
		"/custom-emojis/mine",
		"/custom-emojis/{id}",
		"/custom-emojis/{id}/favorite",
	} {
		require.NotNil(t, spec.Paths.Find(path), "missing custom emoji path %s", path)
	}
	for _, schema := range []string{"CustomEmojiDTO", "CustomEmojiMineDTO", "CustomEmojiCreateRequest", "CustomEmojiRefMap"} {
		require.Contains(t, spec.Components.Schemas, schema, "missing schema %s", schema)
	}
	require.NotNil(t, spec.Paths.Find("/custom-emojis").Post)
	require.True(t, hasParam(spec.Paths.Find("/custom-emojis").Post.Parameters, "X-CSRF-Token"))
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

func TestTagPaths(t *testing.T) {
	spec, _ := Spec()
	require.NotNil(t, spec.Paths.Find("/tags"))
	require.NotNil(t, spec.Paths.Find("/tags/{id}"))
	require.Contains(t, spec.Components.Schemas, "TagDTO")
}

func TestCommentPaths(t *testing.T) {
	spec, _ := Spec()
	for _, p := range []string{
		"/posts/{postId}/comments", "/comments/{comment_id}/reactions",
		"/comments/{comment_id}/reactions/{emoji_id}", "/comments/reactions/batch",
		"/comments/{id}/approve", "/comments/{id}/spam", "/comments/{id}",
		"/admin/comments/pending", "/admin/comments/pending/count",
		"/admin/comments", "/admin/comments/{id}", "/admin/comments/batch-status",
	} {
		require.NotNil(t, spec.Paths.Find(p), "missing comment path %s", p)
	}
	for _, s := range []string{"CommentDTO", "AdminCommentDTO", "AggregatedReaction"} {
		require.Contains(t, spec.Components.Schemas, s, "missing schema %s", s)
	}
	// 删除反应需登录（非管理员）
	require.NotEmpty(t, spec.Paths.Find("/comments/{comment_id}/reactions/{emoji_id}").Delete.Security)
	// 审核接口需管理员
	require.NotEmpty(t, spec.Paths.Find("/comments/{id}/approve").Patch.Security)
}

func TestMediaPaths(t *testing.T) {
	spec, _ := Spec()
	for _, p := range []string{
		"/media/{id}", "/media", "/media/batch-delete",
		"/uploads", "/uploads/{uploadId}/chunks/{index}", "/uploads/{uploadId}/complete",
		"/uploads/{uploadId}", "/uploads/thumbnail", "/uploads/emoji", "/uploads/instant",
	} {
		require.NotNil(t, spec.Paths.Find(p), "missing media path %s", p)
	}
	for _, s := range []string{"FileDTO", "InitSessionResult", "MergeResult", "EmojiUploadResult"} {
		require.Contains(t, spec.Components.Schemas, s, "missing schema %s", s)
	}
	// /media/{id} 公开（无 security）
	require.Empty(t, spec.Paths.Find("/media/{id}").Get.Security)
	// /media 列表需登录
	require.NotEmpty(t, spec.Paths.Find("/media").Get.Security)
	// 分片上传需登录
	require.NotEmpty(t, spec.Paths.Find("/uploads").Post.Security)
}

func TestMusicPaths(t *testing.T) {
	spec, _ := Spec()
	for _, p := range []string{
		"/music/embed", "/music/playlist", "/music/song", "/music/search",
		"/music/lyrics", "/music/meta", "/music/playlists/active", "/music/settings",
	} {
		require.NotNil(t, spec.Paths.Find(p), "missing music path %s", p)
	}
	for _, s := range []string{"Song", "PlaylistDTO", "MusicEmbedInfo", "MusicSongMeta", "MusicPlaylistMeta"} {
		require.Contains(t, spec.Components.Schemas, s, "missing schema %s", s)
	}
	// 音乐接口全部公开
	require.Empty(t, spec.Paths.Find("/music/search").Get.Security)
	// EmbedInfo 用 PascalCase 字段（验证无 json tag 的 struct）
	emb := spec.Components.Schemas["MusicEmbedInfo"].Value.Properties
	require.Contains(t, emb, "Platform")
	require.Contains(t, emb, "EmbedURL")
}

func TestAdminUserPaths(t *testing.T) {
	spec, _ := Spec()
	for _, p := range []string{
		"/admin/users", "/admin/users/{id}", "/admin/users/{id}/role",
		"/admin/users/{id}/status", "/admin/users/batch-status", "/admin/users/batch-role",
	} {
		require.NotNil(t, spec.Paths.Find(p), "missing admin user path %s", p)
	}
	require.Contains(t, spec.Components.Schemas, "AdminUserDTO")
	// 全部需管理员
	require.NotEmpty(t, spec.Paths.Find("/admin/users").Get.Security)
}

func TestAdminRBACPaths(t *testing.T) {
	spec, _ := Spec()
	for _, p := range []string{
		"/admin/permissions", "/admin/permissions/{id}",
		"/admin/roles", "/admin/roles/{id}", "/admin/roles/{id}/permissions",
	} {
		require.NotNil(t, spec.Paths.Find(p), "missing rbac path %s", p)
	}
	for _, s := range []string{"RoleDTO", "PermissionDTO", "RoleWithPermissionsDTO"} {
		require.Contains(t, spec.Components.Schemas, s, "missing schema %s", s)
	}
}

func TestAdminStatsAndSettingsPaths(t *testing.T) {
	spec, _ := Spec()
	// 站点设置按菜单子页拆成 7 组，每组 GET/PUT 两个路径
	for _, p := range []string{
		"/admin/settings/general", "/admin/settings/auth", "/admin/settings/github",
		"/admin/settings/profile", "/admin/settings/about", "/admin/settings/llm",
		"/admin/settings/code-runner",
		"/admin/logs", "/admin/logs/user/{id}",
	} {
		require.NotNil(t, spec.Paths.Find(p), "missing path %s", p)
	}
	for _, s := range []string{
		"DashboardStats", "ViewTrends",
		"GeneralSettings", "AuthSettings", "GithubSettings", "ProfileSettings",
		"AboutSettings", "LlmSettings", "CodeRunnerSettings",
		"AuditEvent",
	} {
		require.Contains(t, spec.Components.Schemas, s, "missing schema %s", s)
	}
	// AuditEvent 结构化读模型（snake_case 字段）
	ev := spec.Components.Schemas["AuditEvent"].Value.Properties
	require.Contains(t, ev, "Action")
	require.Contains(t, ev, "OccurredAt")
	require.Contains(t, ev, "Changes")
}

func TestAdminAnnouncementPaths(t *testing.T) {
	spec, _ := Spec()
	for _, p := range []string{
		"/admin/announcements", "/admin/announcements/{id}",
	} {
		require.NotNil(t, spec.Paths.Find(p), "missing path %s", p)
	}
	// /admin/announcements/{id} 同时有 GET/PATCH/DELETE
	item := spec.Paths.Find("/admin/announcements/{id}")
	require.NotNil(t, item.Get)
	require.NotNil(t, item.Patch)
	require.NotNil(t, item.Delete)
}

func TestAdminMusicPaths(t *testing.T) {
	spec, _ := Spec()
	for _, p := range []string{
		"/admin/music/playlists", "/admin/music/playlists/custom",
		"/admin/music/playlists/{id}", "/admin/music/playlists/{id}/active",
		"/admin/music/playlists/{id}/refresh", "/admin/music/playlists/{id}/songs",
		"/admin/music/playlists/{id}/songs/{index}", "/admin/music/settings",
	} {
		require.NotNil(t, spec.Paths.Find(p), "missing path %s", p)
	}
	// /admin/music/playlists/{id}/songs/{index} 同时有 DELETE/PATCH
	item := spec.Paths.Find("/admin/music/playlists/{id}/songs/{index}")
	require.NotNil(t, item.Delete)
	require.NotNil(t, item.Patch)
}

func TestAdminEmojiPaths(t *testing.T) {
	spec, _ := Spec()
	for _, p := range []string{
		"/admin/emojis/groups", "/admin/emojis/groups/{id}",
		"/admin/emojis/groups/{id}/emojis", "/admin/emojis/groups/batch-status",
		"/admin/emojis/{id}",
	} {
		require.NotNil(t, spec.Paths.Find(p), "missing path %s", p)
	}
	// 表情上传已迁移到 /uploads/emoji（multipart），admin 侧不再有 upload 端点
	require.Nil(t, spec.Paths.Find("/admin/emojis/upload"))
	require.Nil(t, spec.Paths.Find("/admin/emojis/emojis/{id}"))
	// /admin/files/* 全部移除：instant 迁至 /uploads/instant，列表/删除收敛到 /admin/media
	require.Nil(t, spec.Paths.Find("/admin/files"))
	require.Nil(t, spec.Paths.Find("/admin/files/instant"))
	require.Nil(t, spec.Paths.Find("/admin/files/{id}"))
}

func TestAllOperationsCount(t *testing.T) {
	spec, _ := Spec()
	count := 0
	for _, item := range spec.Paths.Map() {
		if item.Get != nil {
			count++
		}
		if item.Post != nil {
			count++
		}
		if item.Put != nil {
			count++
		}
		if item.Patch != nil {
			count++
		}
		if item.Delete != nil {
			count++
		}
	}
	t.Logf("registered %d operations across %d paths", count, spec.Paths.Len())
	require.GreaterOrEqual(t, count, 90, "expected at least 90 operations, got %d", count)
}

func TestPostPaths(t *testing.T) {
	spec, _ := Spec()
	for _, p := range []string{
		"/posts", "/posts/{slug}", "/posts/{id}/view",
		"/admin/posts", "/admin/posts/{id}", "/admin/posts/{id}/status",
		"/admin/posts/import-url", "/admin/posts/slugify",
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
