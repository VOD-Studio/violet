// Package app 提供 HTTP 路由装配。
//
// 路由按 chi 官方模式组织（见 chi/_examples/rest）：
//   - 公开路由在 RegisterRoutes 内按资源域 r.Route 注册；
//   - 管理后台用独立 sub-router（NewAdminRouter），经 r.Mount("/admin", ...) 挂载；
//   - MCP 端点在顶层独立挂载，绕过 v1 组的 CSRF/SessionAuth。
package app

import (
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"

	"blog-api/config"
	"blog-api/internal/middleware"
	"blog-api/internal/openapi"
)

// Deps 聚合路由注册所需的全部依赖：配置、基础设施中间件依赖与各模块容器。
type Deps struct {
	Cfg               *config.Config
	Redis             *redis.Client
	PermissionChecker middleware.PermissionChecker
	SessionLookup     middleware.SessionLookup

	Role            *RoleContainer
	Settings        *SettingsContainer
	Stats           *StatsContainer
	GitHub          *GitHubContainer
	Releases        *ReleasesContainer
	Auth            *AuthContainer
	Content         *ContentContainer
	Comment         *CommentContainer
	CommentReaction *CommentReactionContainer
	Media           *MediaContainer
	Post            *PostContainer
	Tag             *TagContainer
	Audit           *AuditContainer
	UserAdmin       *UserAdminContainer
	APIToken        *APITokenContainer
	Subscription    *SubscriptionContainer
	MCP             *MCPContainer
	CodeRunner      *CodeRunnerContainer
	System          *SystemContainer
}

// RegisterRoutes 注册全部业务路由。
//
// r 在调用前应已挂载全局中间件（Recoverer/RequestID/Logger/CORS/SecurityHeaders）。
// 本函数负责：健康检查、API v1（公开 + admin sub-router）、MCP 端点、图片服务。
func RegisterRoutes(r chi.Router, d *Deps) {
	cfg := d.Cfg

	// 健康检查（无版本前缀）
	r.Get("/api/health", healthHandler)

	// =====================================================
	// API v1（公开路由 + admin sub-router）
	// =====================================================
	r.Route("/api/v1", func(v1 chi.Router) {
		// CSRF 防护（仅 state-changing 方法校验；GET/HEAD/OPTIONS 免验）。
		// 与 cookie 鉴权方案配套：浏览器自动携带 cookie，必须额外校验 X-CSRF-Token。
		// opaque session 模型下无 refresh 端点，CSRF 保护所有写操作，无显式豁免。
		v1.Use(middleware.CSRF(cfg.Cookie, nil))

		// OpenAPI 文档端点（无需 CSRF/鉴权，仅返回结构描述，供 Apifox 导入）
		v1.Get("/openapi.json", openapi.Handler())

		// 公开站点设置 / 只读统计
		v1.Get("/settings", d.Settings.SettingsHandler.GetPublicSettings)
		v1.Get("/stats", d.Stats.StatsHandler.GetPublicStats)

		// GitHub 数据（公开，Token 在后端管理）
		v1.Route("/github", func(r chi.Router) {
			r.Get("/contributions", d.GitHub.GitHubHandler.GetContributions)
			r.Get("/repos", d.GitHub.GitHubHandler.GetRepos)
		})

		// 更新日志（公开，后端代理 GitHub Releases + Redis 缓存）
		v1.Get("/releases", d.Releases.ReleasesHandler.GetReleases)

		// 认证
		registerAuthRoutes(v1, d)

		// 文章（前台公开）
		registerPostPublicRoutes(v1, d)

		// 标签（公开 List + 管理写操作）
		registerTagRoutes(v1, d)

		// 评论（前台公开 + 双轨认证 + admin 审核写操作散在 /comments/{id}）
		registerCommentRoutes(v1, d)

		// 媒体（公开获取 + 登录上传 + 音乐/表情公开查询）
		registerMediaRoutes(v1, d)

		// 项目 / 公告（公开）
		v1.Route("/projects", func(r chi.Router) {
			r.Get("/", d.Content.ContentHandler.ListProjects)
			r.Get("/{id}", d.Content.ContentHandler.GetProject)
		})
		v1.Route("/announcements", func(r chi.Router) {
			r.Get("/", d.Content.ContentHandler.ListActiveAnnouncements)
			r.Get("/{id}", d.Content.ContentHandler.GetActiveAnnouncement)
		})

		// 代码运行器（登录可执行，SSE 用 GET 绕过 CSRF）
		registerCodeRunnerRoutes(v1, d)

		// 管理后台（独立 sub-router，SessionAuth + AdminRequired 基线）
		v1.Mount("/admin", NewAdminRouter(d))
	})

	// MCP 端点（顶层挂载，绕过 v1 CSRF/SessionAuth；PAT 鉴权在 handler 内）
	registerMCPRoutes(r, d)

	// 图片服务（动态 resize/转码 + 二级缓存 + ETag/304）
	imageContainer := NewImageContainer(cfg.UploadDir, cfg.UploadPathPrefix)
	r.Get(cfg.UploadPathPrefix+"*", imageContainer.ImageHandler.ServeImage)
}

// healthHandler 健康检查（无版本前缀，无鉴权）。
func healthHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"status":"ok","message":"博客 API 服务运行中"}`)
}

// --- 公开域路由注册函数 ---

// registerAuthRoutes 注册 /auth 路由。
// 公开端点（csrf-token/register/login 等）+ 限流防暴力；session 端点只读探活；
// 登录态组（logout/me/profile/password）。
func registerAuthRoutes(v1 chi.Router, d *Deps) {
	cfg := d.Cfg
	redisClient := d.Redis
	sessionLookup := d.SessionLookup
	authH := d.Auth.AuthHandler

	v1.Route("/auth", func(r chi.Router) {
		r.Get("/csrf-token", authH.GetCSRFToken)
		// 认证类接口限流（防暴力破解与邮件轰炸）
		r.With(middleware.AuthRateLimit(redisClient)).Post("/register", authH.Register)
		r.With(middleware.AuthRateLimit(redisClient)).Post("/verify-email", authH.VerifyEmail)
		r.With(middleware.AuthRateLimit(redisClient)).Post("/login", authH.Login)
		r.With(middleware.AuthRateLimit(redisClient)).Post("/google", authH.GoogleLogin)
		r.With(middleware.AuthRateLimit(redisClient)).Post("/github", authH.GithubLogin)
		r.With(middleware.AuthRateLimit(redisClient)).Post("/forgot-password", authH.ForgotPassword)
		r.With(middleware.AuthRateLimit(redisClient)).Post("/reset-password", authH.ResetPassword)

		// SSR 探活端点：只读校验当前 session，不续期、不写 cookie（命门不变量①）
		r.With(middleware.SessionAuthReadOnly(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL)).
			Get("/session", authH.Session)

		r.Group(func(r chi.Router) {
			r.Use(middleware.SessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL))
			r.Post("/logout", authH.Logout)
			r.Get("/me", authH.GetMe)
			r.Patch("/profile", authH.UpdateProfile)
			r.Patch("/password", authH.ChangePassword)
		})
	})
}

// registerPostPublicRoutes 注册 /posts 前台公开路由。
func registerPostPublicRoutes(v1 chi.Router, d *Deps) {
	postH := d.Post.PostHandler
	v1.Route("/posts", func(r chi.Router) {
		r.Get("/", postH.ListPublished)
		r.Get("/archive", postH.ArchiveYears)
		r.Get("/archive/{year}", postH.ArchiveByYear)
		r.Get("/{slug}", postH.GetBySlug)
		r.Post("/{id}/view", postH.IncrementView)
	})
}

// registerTagRoutes 注册 /tags 路由（公开 List + 登录管理员写操作）。
func registerTagRoutes(v1 chi.Router, d *Deps) {
	cfg := d.Cfg
	perm := d.PermissionChecker
	sessionLookup := d.SessionLookup
	tagH := d.Tag.TagHandler

	v1.Route("/tags", func(r chi.Router) {
		r.Get("/", tagH.List) // 公开

		r.Group(func(r chi.Router) {
			r.Use(middleware.SessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL))
			r.Use(middleware.AdminRequired(perm))
			r.With(middleware.RequirePermission(perm, "tag:create")).Post("/", tagH.Create)
			r.With(middleware.RequirePermission(perm, "tag:update")).Patch("/{id}", tagH.Update)
			r.With(middleware.RequirePermission(perm, "tag:delete")).Delete("/{id}", tagH.Delete)
		})
	})
}

// registerCommentRoutes 注册评论前台路由。
// 评论方法散在多个前缀：/posts/{postId}/comments、/comments/{id}、/comments/{commentId}/replies 等。
// admin 审核列表走 NewAdminRouter 内 /admin/comments。
func registerCommentRoutes(v1 chi.Router, d *Deps) {
	cfg := d.Cfg
	redisClient := d.Redis
	perm := d.PermissionChecker
	sessionLookup := d.SessionLookup
	commentH := d.Comment.CommentHandler
	// /posts/{postId}/comments（列表 OptionalAuth；创建 OptionalAuth + 限流；发码独立限流）
	v1.Route("/posts/{postId}/comments", func(r chi.Router) {
		r.With(middleware.OptionalSessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL)).
			Get("/", commentH.ListByPost)
		r.With(
			middleware.OptionalSessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL),
			middleware.CommentRateLimit(redisClient),
		).Post("/", commentH.Create)
		r.With(middleware.CommentCodeRateLimit(redisClient)).Post("/code", commentH.SendCode)
	})

	// 评论回复列表（公开 + OptionalAuth）
	v1.With(middleware.OptionalSessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL)).
		Get("/comments/{commentId}/replies", commentH.ListReplies)

	// 批注按块聚合统计
	v1.With(middleware.OptionalSessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL)).
		Get("/posts/{postId}/annotations/summary", commentH.AnnotationSummary)

	// 评论反应（DDD commentReactionContainer）
	crH := d.CommentReaction.CommentReactionHandler
	v1.Route("/comments/{comment_id}/reactions", func(r chi.Router) {
		r.With(middleware.OptionalSessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL)).
			Get("/", crH.GetCommentReactions)
		r.With(middleware.SessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL)).
			With(middleware.CommentRateLimit(redisClient)).
			Post("/", crH.AddReaction)
		r.With(middleware.SessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL)). // 删除反应需认证，防匿名删除他人反应
			Delete("/{emoji_id}", crH.RemoveReaction)
	})
	v1.With(middleware.OptionalSessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL)).
		Post("/comments/reactions/batch", crH.GetReactionsBatch)

	// 评论审核/删除（admin 权限，但路径在 /comments/{id} 不在 /admin 下）
	v1.Route("/comments/{id}", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(middleware.SessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL))
			r.Use(middleware.AdminRequired(perm))
			r.Patch("/approve", commentH.Approve)
			r.Patch("/spam", commentH.MarkSpam)
			r.Delete("/", commentH.Delete)
		})
	})
}

// registerMediaRoutes 注册媒体相关路由（公开获取 + 登录上传 + 音乐/表情公开查询）。
func registerMediaRoutes(v1 chi.Router, d *Deps) {
	cfg := d.Cfg
	redisClient := d.Redis
	sessionLookup := d.SessionLookup
	mediaH := d.Media.MediaHandler
	sessionAuth := func(r chi.Router) { r.Use(middleware.SessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL)) }

	// 媒体（公开获取详情 + 登录列表/删除/批量删除）
	v1.Route("/media", func(r chi.Router) {
		r.Get("/{id}", mediaH.GetMedia)
		r.Group(func(r chi.Router) {
			sessionAuth(r)
			r.Get("/", mediaH.ListFiles)
			r.Delete("/{id}", mediaH.DeleteFile)
			r.Post("/batch-delete", mediaH.BatchDeleteMedia)
		})
	})

	// 上传（统一入口，分片/整体/秒传；登录 + UploadRateLimit）
	v1.Route("/uploads", func(r chi.Router) {
		r.Use(middleware.SessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL))
		r.Use(middleware.UploadRateLimit(redisClient))
		r.Post("/", mediaH.InitUploadSession)
		r.Put("/{uploadId}/chunks/{index}", mediaH.SaveUploadChunk)
		r.Post("/{uploadId}/complete", mediaH.CompleteUpload)
		r.Delete("/{uploadId}", mediaH.CancelUpload)
		r.Get("/{uploadId}", mediaH.GetUploadStatus)
		r.Post("/thumbnail", mediaH.UploadThumbnail)
		r.Post("/replace", mediaH.ReplaceMediaFile)
		r.Post("/emoji", mediaH.UploadEmoji)
		r.Get("/instant", mediaH.CheckInstantUpload)
	})

	// 音乐（公开）
	v1.Route("/music", func(r chi.Router) {
		r.Get("/embed", mediaH.GetMusicEmbed)
		r.Get("/playlist", mediaH.ParsePlaylist)
		r.Get("/song", mediaH.GetSongDetail)
		r.Get("/search", mediaH.SearchSongs)
		r.Get("/lyrics", mediaH.GetLyrics)
		r.Get("/meta", mediaH.GetSongMeta)
		r.Get("/playlists/active", mediaH.GetActivePlaylists)
		r.Get("/settings", mediaH.GetMusicSettings)
	})

	// 表情（公开）
	v1.Route("/emojis", func(r chi.Router) {
		r.Get("/", mediaH.GetAllEmojis)
		r.Get("/groups/{name}", mediaH.GetEmojiGroupByName)
	})
}

// registerCodeRunnerRoutes 注册 /code-runner 路由（登录可执行，SSE 用 GET）。
func registerCodeRunnerRoutes(v1 chi.Router, d *Deps) {
	cfg := d.Cfg
	redisClient := d.Redis
	sessionLookup := d.SessionLookup
	codeRunnerH := d.CodeRunner.CodeRunnerHandler

	v1.Route("/code-runner", func(r chi.Router) {
		r.Use(middleware.SessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL))
		r.With(middleware.CodeRunnerRateLimit(redisClient)).Post("/run", codeRunnerH.Run)
		r.Get("/tasks/{id}", codeRunnerH.GetTask)
		r.With(middleware.CodeRunnerRateLimit(redisClient)).Post("/run/stream", codeRunnerH.RunStream)
		r.Get("/stream", codeRunnerH.Stream)
	})
}

// registerMCPRoutes 注册 4 个 MCP 端点（顶层 r，独立限流维度）。
// 绕过 v1 的 CSRF（MCP 是 JSON-RPC、无 X-CSRF-Token）与 SessionAuth（用 PAT）。
// PAT 鉴权在 handler 内（auth.RequireBearerToken），此处仅叠加独立限流。
func registerMCPRoutes(r chi.Router, d *Deps) {
	redisClient := d.Redis
	mcp := d.MCP

	r.With(middleware.RateLimit("mcp", redisClient, time.Minute, 60)).
		Handle("/api/v1/mcp", mcp.PostHandler)
	r.With(middleware.RateLimit("mcp-scraper", redisClient, time.Minute, 30)).
		Handle("/api/v1/mcp/scraper", mcp.ScraperHandler)
	r.With(middleware.RateLimit("mcp-reader", redisClient, time.Minute, 120)).
		Handle("/api/v1/mcp/reader", mcp.PublicHandler)
	r.With(middleware.RateLimit("mcp-comments", redisClient, time.Minute, 60)).
		Handle("/api/v1/mcp/comments", mcp.CommentsHandler)
}
