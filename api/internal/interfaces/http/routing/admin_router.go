// Package routing admin_router 提供管理后台独立 sub-router（chi 官方 adminRouter 模式）。
// 统一套 SessionAuth + AdminRequired 基线，内部按模块/权限码细分。
package routing

import (
	"github.com/go-chi/chi/v5"

	"blog-api/internal/domain/permission"
	galleryhttp "blog-api/internal/interfaces/http/handler/gallery"
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
	friendLinkH := d.FriendLink

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

	// OAuth 凭据（读 settings:view；写 settings:update，与设置组同权限域）
	r.Route("/oauth", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(perm, "settings:view"))
			r.Get("/status", d.Auth.GetOAuthStatus)
		})
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(perm, "settings:update"))
			// 探测虽是读操作（不落盘），但外呼 provider 且管理员手动触发，
			// 与写入同权限域
			r.Post("/verify", d.Auth.VerifyOAuthCredentials)
			r.Put("/credentials", d.Auth.UpdateOAuthCredentials)
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
			r.Put("/{id}/permissions", roleH.UpdateRolePermissions)
		})
	})

	// 操作日志（需 log:view）
	r.With(middleware.RequirePermission(perm, "log:view")).
		Get("/logs", d.Audit.ListEvents)
	r.With(middleware.RequirePermission(perm, "log:view")).
		Get("/logs/user/{id}", d.Audit.ListEventsByActor)

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
		r.Post("/{id}/fetch", d.Subscription.Fetch)
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
	r.Put("/posts/{id}", postH.Update)                                                                // 应用层鉴权
	r.Patch("/posts/{id}/status", postH.UpdateStatus)                                                 // 应用层鉴权
	r.Patch("/posts/{id}/featured", postH.SetFeatured)                                                // 应用层鉴权
	r.Delete("/posts/{id}", postH.Delete)                                                             // 应用层鉴权
	r.Post("/posts/{id}/restore", postH.Restore)                                                      // 应用层鉴权
	r.Delete("/posts/{id}/hard", postH.HardDelete)                                                    // 应用层鉴权
	r.With(middleware.RequirePermission(perm, "post:create")).Post("/posts/batch", postH.BatchAction) // 鉴权下放应用层逐条

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
		// 用户自定义表情（customemoji:manage；下架走公开 DELETE /custom-emojis/{id}，应用层双轨鉴权）
		r.With(middleware.RequirePermission(perm, permission.CustomEmojiManage.String())).
			Get("/custom", d.CustomEmoji.ListAll)
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

	// 友链审核（读：friendlink:view；写：friendlink:manage）。
	// 与评论域同构：view 角色可读 pending/count（后台菜单角标）+ 全量列表；manage 角色可改。
	r.Route("/friend-links", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(perm, "friendlink:view"))
			r.Get("/pending/count", friendLinkH.CountPending)
			r.Get("/", friendLinkH.ListByStatus)
		})
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(perm, "friendlink:manage"))
			r.Post("/", friendLinkH.CreateManual)
			r.Patch("/{id}", friendLinkH.Update)
			r.Post("/{id}/approve", friendLinkH.Approve)
			r.Post("/{id}/reject", friendLinkH.Reject)
			r.Post("/{id}/disable", friendLinkH.Disable)
			r.Post("/{id}/restore", friendLinkH.Restore)
			r.Delete("/{id}", friendLinkH.Delete)
		})
	})

	// 系列书管理（PRD-0021）：读 series:view；建书 series:create；
	// 编辑/卷/挂章/调序 series:update；解散 series:delete。写操作叠加 owner 校验（application 层）。
	seriesH := d.Series
	r.Route("/series", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(perm, "series:view"))
			r.Get("/", seriesH.ListAdmin)
			r.Get("/{id}", seriesH.GetAdmin)
		})
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(perm, "series:create"))
			r.Post("/", seriesH.Create)
		})
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(perm, "series:update"))
			r.Patch("/{id}", seriesH.Update)
			r.Post("/{id}/sections", seriesH.AddSection)
			r.Delete("/{id}/sections/{sectionId}", seriesH.RemoveSection)
			r.Put("/{id}/sections/order", seriesH.ReorderSections)
			r.Post("/{id}/chapters", seriesH.AttachChapters)
			r.Delete("/{id}/chapters/{postId}", seriesH.DetachChapter)
			r.Put("/{id}/chapters/order", seriesH.ReorderChapters)
			r.Post("/{id}/cover/generate", seriesH.GenerateCovers)
			r.Post("/cover/generate", seriesH.GenerateCoversStandalone)
		})
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(perm, "series:delete"))
			r.Delete("/{id}", seriesH.Delete)
		})
	})

	// 图集工作稿：读 gallery:view；创建、保存与发布维护 gallery:manage。
	registerAdminGalleryRoutes(r, d.Gallery, perm)

	return r
}

func registerAdminGalleryRoutes(r chi.Router, galleryH *galleryhttp.Handler, perm middleware.PermissionChecker) {
	r.Route("/galleries", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(perm, permission.GalleryView.String()))
			r.Get("/", galleryH.ListForEditor)
			r.Get("/{id}", galleryH.GetForEditor)
		})
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(perm, permission.GalleryManage.String()))
			r.Post("/", galleryH.CreateDraft)
			r.Put("/{id}", galleryH.Save)
			r.Post("/{id}/publish", galleryH.Publish)
			r.Post("/{id}/unpublish", galleryH.Unpublish)
			r.Delete("/{id}", galleryH.Delete)
		})
	})
}
