// Package routing admin_router 提供管理后台独立 sub-router（chi 官方 adminRouter 模式）。
// 统一套 SessionAuth + AdminRequired 基线，内部按模块/权限码细分。
package routing

import (
	"github.com/go-chi/chi/v5"

	"blog-api/internal/middleware"
)

// NewAdminRouter 构建管理后台独立 sub-router。
// 基线中间件：SessionAuth + AdminRequired。
// 由 RegisterRoutes 经 v1.Mount("/admin", ...) 挂载。
func NewAdminRouter(d *Deps) chi.Router {
	perm := d.PermissionChecker

	r := chi.NewRouter()
	r.Use(d.SessionAuth)
	r.Use(middleware.AdminRequired(perm))

	roleH := d.Role
	settingsH := d.Settings
	userAdminH := d.UserAdmin
	commentH := d.Comment
	postH := d.Post
	mediaH := d.Media
	contentH := d.Content

	// 仪表盘统计
	r.Get("/stats", d.Stats.GetDashboardStats)
	r.Get("/stats/views", d.Stats.GetViewTrends)

	// 站点设置（按菜单子页拆成 7 组，每组独立 GET/PUT）
	r.Route("/settings", func(sub chi.Router) {
		sub.Group(func(sub chi.Router) {
			sub.Use(middleware.RequirePermission(perm, "settings:view"))
			sub.Get("/general", settingsH.GetGeneral)
			sub.Get("/auth", settingsH.GetAuth)
			sub.Get("/github", settingsH.GetGithub)
			sub.Get("/profile", settingsH.GetProfile)
			sub.Get("/about", settingsH.GetAbout)
			sub.Get("/llm", settingsH.GetLlm)
			sub.Get("/code-runner", settingsH.GetCodeRunner)
		})
		sub.Group(func(sub chi.Router) {
			sub.Use(middleware.RequirePermission(perm, "settings:update"))
			sub.Put("/general", settingsH.UpdateGeneral)
			sub.Put("/auth", settingsH.UpdateAuth)
			sub.Put("/github", settingsH.UpdateGithub)
			sub.Put("/profile", settingsH.UpdateProfile)
			sub.Put("/about", settingsH.UpdateAbout)
			sub.Put("/llm", settingsH.UpdateLlm)
			sub.Put("/code-runner", settingsH.UpdateCodeRunner)
		})
	})

	// 用户管理（读 user:view；创建/改角色 user:update-role；删除/禁用 user:ban）
	r.Route("/users", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(perm, "user:view"))
			r.Get("/", userAdminH.ListUsers)
			r.Get("/{id}", userAdminH.GetUserDetail)
		})
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(perm, "user:update-role"))
			r.Post("/", userAdminH.CreateUser)
			r.Put("/{id}", userAdminH.UpdateUser)
			r.Patch("/{id}/role", userAdminH.UpdateUserRole)
			r.Post("/batch-role", userAdminH.BatchUpdateRole)
		})
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(perm, "user:ban"))
			r.Delete("/{id}", userAdminH.DeleteUser)
			r.Patch("/{id}/status", userAdminH.UpdateUserStatus)
			r.Post("/batch-status", userAdminH.BatchUpdateStatus)
		})
	})

	// 权限管理
	r.Get("/permissions", roleH.ListPermissions)

	// 权限 CRUD（仅限超级管理员）
	r.Group(func(r chi.Router) {
		r.Use(middleware.SuperAdminRequired)
		r.Post("/permissions", roleH.CreatePermission)
		r.Patch("/permissions/{id}", roleH.UpdatePermission)
		r.Delete("/permissions/{id}", roleH.DeletePermission)
	})

	// 角色管理（读 role:view；写 role:manage）
	r.Route("/roles", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(perm, "role:view"))
			r.Get("/", roleH.ListRoles)
			r.Get("/{id}", roleH.GetRole)
		})
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(perm, "role:manage"))
			r.Post("/", roleH.CreateRole)
			r.Patch("/{id}", roleH.UpdateRole)
			r.Delete("/{id}", roleH.DeleteRole)
			r.Patch("/{id}/permissions", roleH.UpdateRolePermissions)
		})
	})

// 操作日志路由由 issue #57 重建（适配新 AuditEvent 读模型）

	// 公告管理（读 announcement:view；写 announcement:manage）
	r.Route("/announcements", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(perm, "announcement:view"))
			r.Get("/", contentH.ListAnnouncements)
			r.Get("/{id}", contentH.GetAnnouncement)
		})
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(perm, "announcement:manage"))
			r.Post("/", contentH.CreateAnnouncement)
			r.Patch("/{id}", contentH.UpdateAnnouncement)
			r.Delete("/{id}", contentH.DeleteAnnouncement)
		})
	})

	// MCP 访问令牌管理（PAT；需 mcp:manage-tokens）
	r.Route("/api-tokens", func(r chi.Router) {
		r.Use(middleware.RequirePermission(perm, "mcp:manage-tokens"))
		r.Get("/", d.APIToken.List)
		r.Post("/", d.APIToken.Create)
		r.Delete("/{id}", d.APIToken.Delete)
	})

	// RSS 订阅管理（需 subscription:manage）
	r.Route("/subscriptions", func(r chi.Router) {
		r.Use(middleware.RequirePermission(perm, "subscription:manage"))
		r.Get("/", d.Subscription.List)
		r.Get("/{id}", d.Subscription.Get)
		r.Post("/", d.Subscription.Create)
		r.Put("/{id}", d.Subscription.Update)
		r.Post("/{id}/pause", d.Subscription.Pause)
		r.Post("/{id}/resume", d.Subscription.Resume)
		r.Delete("/{id}", d.Subscription.Delete)
	})

	// 评论审核（读 comment:view；批量状态 comment:approve）
	r.Route("/comments", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(perm, "comment:view"))
			r.Get("/pending", commentH.ListPending)
			r.Get("/pending/count", commentH.CountPending)
			r.Get("/", commentH.ListAll)
			r.Get("/{id}", commentH.GetDetail)
		})
		r.With(middleware.RequirePermission(perm, "comment:approve")).
			Patch("/batch-status", commentH.BatchUpdateStatus)
	})

	// 文章管理（读：post:view；写：权限下放应用层，所有权 + 权限码判定）
	r.With(middleware.RequirePermission(perm, "post:view")).Get("/posts", postH.ListAll)
	r.With(middleware.RequirePermission(perm, "post:view")).Get("/posts/{id}", postH.GetByID)
	r.With(middleware.RequirePermission(perm, "post:create")).Post("/posts", postH.Create)
	r.With(middleware.RequirePermission(perm, "post:create")).Post("/posts/import-url", postH.ImportURL)
	r.With(middleware.RequirePermission(perm, "post:create")).Post("/posts/slugify", postH.Slugify)
	r.Put("/posts/{id}", postH.Update)                 // 应用层鉴权
	r.Patch("/posts/{id}/status", postH.UpdateStatus)  // 应用层鉴权
	r.Patch("/posts/{id}/featured", postH.SetFeatured) // 应用层鉴权
	r.Delete("/posts/{id}", postH.Delete)              // 应用层鉴权
	r.Post("/posts/{id}/restore", postH.Restore)       // 应用层鉴权
	r.Delete("/posts/{id}/hard", postH.HardDelete)     // 应用层鉴权

	// 文章版本管理
	r.With(middleware.RequirePermission(perm, "post:view")).Get("/posts/{id}/versions", postH.ListVersions)
	r.With(middleware.RequirePermission(perm, "post:view")).Get("/posts/versions/{versionId}", postH.GetVersion)
	r.Post("/posts/{id}/versions/{versionId}/restore", postH.RestoreVersion) // 应用层鉴权

	// 音乐管理（读：playlist:view；写：按动作细分）
	r.Route("/music", func(r chi.Router) {
		r.Route("/playlists", func(r chi.Router) {
			r.With(middleware.RequirePermission(perm, "playlist:view")).Get("/", mediaH.ListAllPlaylists)
			r.With(middleware.RequirePermission(perm, "playlist:create")).Post("/", mediaH.CreatePlaylist)
			r.With(middleware.RequirePermission(perm, "playlist:create")).Post("/custom", mediaH.CreateCustomPlaylist)
			r.With(middleware.RequirePermission(perm, "playlist:view")).Get("/{id}", mediaH.GetPlaylistDetail)
			r.With(middleware.RequirePermission(perm, "playlist:update")).Patch("/{id}", mediaH.UpdatePlaylist)
			r.With(middleware.RequirePermission(perm, "playlist:delete")).Delete("/{id}", mediaH.DeletePlaylist)
			r.With(middleware.RequirePermission(perm, "playlist:toggle")).Patch("/{id}/active", mediaH.SetPlaylistActive)
			r.With(middleware.RequirePermission(perm, "playlist:update")).Post("/{id}/refresh", mediaH.RefreshPlaylist)
			// 歌曲增删改仅超管
			r.Group(func(r chi.Router) {
				r.Use(middleware.SuperAdminRequired)
				r.Post("/{id}/songs", mediaH.AddSongToPlaylist)
				r.Delete("/{id}/songs/{index}", mediaH.RemoveSongFromPlaylist)
				r.Patch("/{id}/songs/{index}", mediaH.UpdateSongInPlaylist)
			})
		})
		r.With(middleware.RequirePermission(perm, "playlist:update")).
			Patch("/settings", mediaH.UpdatePlayerVersion)
	})

	// 表情管理（读：emoji:view；分组管理 emoji:manage-group；建/改 emoji:create；删 emoji:delete）
	r.Route("/emojis", func(r chi.Router) {
		r.With(middleware.RequirePermission(perm, "emoji:view")).Get("/groups", mediaH.ListAllEmojiGroups)
		r.With(middleware.RequirePermission(perm, "emoji:manage-group")).Post("/groups", mediaH.CreateEmojiGroup)
		r.With(middleware.RequirePermission(perm, "emoji:manage-group")).Patch("/groups/batch-status", mediaH.BatchUpdateEmojiGroupStatus)
		r.With(middleware.RequirePermission(perm, "emoji:manage-group")).Patch("/groups/{id}", mediaH.UpdateEmojiGroup)
		r.With(middleware.RequirePermission(perm, "emoji:manage-group")).Delete("/groups/{id}", mediaH.DeleteEmojiGroup)
		r.With(middleware.RequirePermission(perm, "emoji:view")).Get("/groups/{id}/emojis", mediaH.ListGroupEmojis)
		r.With(middleware.RequirePermission(perm, "emoji:create")).Post("/groups/{id}/emojis", mediaH.CreateEmoji)
		// 单个表情（{id} 必须在 groups 之后，避免与 groups/{id} 冲突）
		r.With(middleware.RequirePermission(perm, "emoji:create")).Patch("/{id}", mediaH.UpdateEmoji)
		r.With(middleware.RequirePermission(perm, "emoji:delete")).Delete("/{id}", mediaH.DeleteEmoji)
		r.With(middleware.RequirePermission(perm, "emoji:refetch")).Post("/bilibili/refetch", mediaH.RefetchBilibiliEmojis)
		r.With(middleware.RequirePermission(perm, "emoji:refetch")).Get("/bilibili/refetch/status", mediaH.GetRefetchStatus)
		r.With(middleware.RequirePermission(perm, "emoji:refetch")).Get("/bilibili/cookie", mediaH.GetBilibiliCookie)
	})

	// 项目管理
	r.Route("/projects", func(r chi.Router) {
		r.With(middleware.RequirePermission(perm, "project:create")).Post("/", contentH.CreateProject)
		r.With(middleware.RequirePermission(perm, "project:update")).Put("/{id}", contentH.UpdateProject)
		r.With(middleware.RequirePermission(perm, "project:delete")).Delete("/{id}", contentH.DeleteProject)
	})

	// 媒体素材管理（细粒度权限）
	r.With(middleware.RequirePermission(perm, "media:view")).Get("/media", mediaH.ListAllFiles)
	r.With(middleware.RequirePermission(perm, "media:upload")).Patch("/media/{id}", mediaH.UpdateFileMetadata)
	r.With(middleware.RequirePermission(perm, "media:delete")).Delete("/media/{id}", mediaH.DeleteFile)
	r.With(middleware.RequirePermission(perm, "media:delete")).Post("/media/batch-delete", mediaH.BatchDeleteMedia)

	// 服务器监控（需 system:view）
	r.Route("/system", func(r chi.Router) {
		r.With(middleware.RequirePermission(perm, "system:view")).Get("/snapshot", d.System.GetSnapshot)
		r.With(middleware.RequirePermission(perm, "system:view")).Get("/history", d.System.GetHistory)
	})

	return r
}
