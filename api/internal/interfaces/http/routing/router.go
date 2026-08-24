package routing

import (
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"blog-api/internal/domain/permission"
	"blog-api/internal/middleware"
	"blog-api/internal/openapi"
)

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
		v1.Get("/settings", d.Settings.GetPublicSettings)
		v1.Get("/stats", d.Stats.GetPublicStats)

		// GitHub 数据（公开，Token 在后端管理）
		v1.Route("/github", func(r chi.Router) {
			r.Get("/contributions", d.GitHub.GetContributions)
			r.Get("/repos", d.GitHub.GetRepos)
		})

		// 更新日志（公开，后端代理 GitHub Releases + Redis 缓存）
		v1.Get("/releases", d.Releases.GetReleases)

		// 认证
		registerAuthRoutes(v1, d)

		// 文章（前台公开）
		registerPostPublicRoutes(v1, d)

		// 标签（公开 List + 管理写操作）
		registerTagRoutes(v1, d)

		// 评论（前台公开 + 双轨认证 + admin 审核写操作散在 /comments/{id}）
		registerCommentRoutes(v1, d)

		// 推文（公开时间线/详情/用户列表 + 登录发布/删除）
		registerTweetRoutes(v1, d)

		// 媒体（公开获取 + 登录上传 + 音乐/表情公开查询）
		registerMediaRoutes(v1, d)

		// 通知（登录用户：列表/未读计数/标记已读）
		registerNotificationRoutes(v1, d)

		// 聊天（登录用户：私聊/私有房间/消息/事件流/推送订阅）
		registerChatRoutes(v1, d)

		// 自定义表情（登录用户：自助上传/删除/收藏）
		registerCustomEmojiRoutes(v1, d)

		// 项目 / 公告（公开）
		v1.Route("/projects", func(r chi.Router) {
			r.Get("/", d.Content.ListProjects)
			r.Get("/{id}", d.Content.GetProject)
		})
		v1.Route("/announcements", func(r chi.Router) {
			r.Get("/", d.Content.ListActiveAnnouncements)
			r.Get("/{id}", d.Content.GetActiveAnnouncement)
		})

		// 友链（前台公开：列表 + 申请 + 发码）
		registerFriendLinkRoutes(v1, d)

		// 代码运行器（登录可执行，SSE 用 GET 绕过 CSRF）
		registerCodeRunnerRoutes(v1, d)

		// 管理后台（独立 sub-router，SessionAuth + AdminRequired 基线）
		v1.Mount("/admin", NewAdminRouter(d))
	})

	// MCP 端点（顶层挂载，绕过 v1 CSRF/SessionAuth；PAT 鉴权在 handler 内）
	registerMCPRoutes(r, d)

	// 图片服务（动态 resize/转码 + 二级缓存 + ETag/304）
	r.Get(cfg.UploadPathPrefix+"*", d.Image.ServeImage)
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
	redisClient := d.Redis
	authH := d.Auth

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
		r.With(d.SessionAuthReadOnlyMW).
			Get("/session", authH.Session)

		r.Group(func(r chi.Router) {
			r.Use(d.SessionAuth)
			r.Post("/logout", authH.Logout)
			r.Get("/me", authH.GetMe)
			r.Patch("/profile", authH.UpdateProfile)
			r.Patch("/password", authH.ChangePassword)
		})
	})
}

// registerPostPublicRoutes 注册 /posts 前台公开路由。
func registerPostPublicRoutes(v1 chi.Router, d *Deps) {
	postH := d.Post
	v1.Route("/posts", func(r chi.Router) {
		r.Get("/", postH.ListPublished)
		r.Get("/archive", postH.ArchiveYears)
		r.Get("/archive/{year}", postH.ArchiveByYear)
		r.Get("/search", postH.SearchPublished)
		r.Get("/{slug}", postH.GetBySlug)
		r.Post("/{id}/view", postH.IncrementView)
	})
}

// registerTagRoutes 注册 /tags 路由（公开 List + 登录管理员写操作）。
func registerTagRoutes(v1 chi.Router, d *Deps) {
	perm := d.PermissionChecker
	tagH := d.Tag

	v1.Route("/tags", func(r chi.Router) {
		r.Get("/", tagH.List) // 公开

		r.Group(func(r chi.Router) {
			r.Use(d.SessionAuth)
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
	redisClient := d.Redis
	perm := d.PermissionChecker
	commentH := d.Comment
	// /posts/{postId}/comments（列表 OptionalAuth；创建 OptionalAuth + 限流；发码独立限流）
	v1.Route("/posts/{postId}/comments", func(r chi.Router) {
		r.With(d.OptionalAuth).
			Get("/", commentH.ListByPost)
		r.With(
			d.OptionalAuth,
			middleware.CommentRateLimit(redisClient),
		).Post("/", commentH.Create)
		r.With(middleware.CommentCodeRateLimit(redisClient)).Post("/code", commentH.SendCode)
	})

	// 评论回复列表（公开 + OptionalAuth）
	v1.With(d.OptionalAuth).
		Get("/comments/{commentId}/replies", commentH.ListReplies)

	// 批注按块聚合统计
	v1.With(d.OptionalAuth).
		Get("/posts/{postId}/annotations/summary", commentH.AnnotationSummary)

	// 评论反应（DDD commentReactionContainer）
	crH := d.CommentReaction
	v1.Route("/comments/{comment_id}/reactions", func(r chi.Router) {
		r.With(d.OptionalAuth).
			Get("/", crH.GetCommentReactions)
		r.With(d.SessionAuth).
			With(middleware.CommentRateLimit(redisClient)).
			Post("/", crH.AddReaction)
		r.With(d.SessionAuth). // 删除反应需认证，防匿名删除他人反应
					Delete("/{emoji_id}", crH.RemoveReaction)
	})
	v1.With(d.OptionalAuth).
		Post("/comments/reactions/batch", crH.GetReactionsBatch)

	// 评论审核/删除（admin 权限，但路径在 /comments/{id} 不在 /admin 下）
	v1.Route("/comments/{id}", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(d.SessionAuth)
			r.Use(middleware.AdminRequired(perm))
			r.Patch("/approve", commentH.Approve)
			r.Patch("/spam", commentH.MarkSpam)
			r.Delete("/", commentH.Delete)
		})
	})
}

// registerMediaRoutes 注册媒体相关路由（公开获取 + 登录上传 + 音乐/表情公开查询）。
func registerMediaRoutes(v1 chi.Router, d *Deps) {
	redisClient := d.Redis
	mediaH := d.Media

	// 媒体（公开获取详情 + 登录列表/删除/批量删除）
	v1.Route("/media", func(r chi.Router) {
		r.Get("/{id}", mediaH.GetMedia)
		r.Group(func(r chi.Router) {
			r.Use(d.SessionAuth)
			r.Get("/", mediaH.ListFiles)
			r.Delete("/{id}", mediaH.DeleteFile)
			r.Post("/batch-delete", mediaH.BatchDeleteMedia)
		})
	})

	// 上传（统一入口，分片/整体/秒传；登录 + UploadRateLimit）
	v1.Route("/uploads", func(r chi.Router) {
		r.Use(d.SessionAuth)
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

// registerTweetRoutes 注册推文路由（PRD-0013）。
// 时间线/详情/用户列表/评论列表公开；发布登录 + 发布限流；
// 评论发/删登录（作者或 tweet:delete-any 的双重判定在 application 层，路由仅卡登录）。
func registerTweetRoutes(v1 chi.Router, d *Deps) {
	tweetH := d.Tweet

	v1.Route("/tweets", func(r chi.Router) {
		r.With(d.OptionalAuth).Get("/", tweetH.ListTimeline)
		r.With(d.OptionalAuth).Get("/{id}", tweetH.Get)
		r.With(d.OptionalAuth).Get("/topics/{tag}", tweetH.ListByTopic)
		r.With(d.SessionAuth, middleware.TweetRateLimit(d.Redis)).Post("/", tweetH.Create)
		r.With(d.SessionAuth).Delete("/{id}", tweetH.Delete)
		r.With(d.SessionAuth).Post("/{id}/like", tweetH.Like)
		r.With(d.SessionAuth).Delete("/{id}/like", tweetH.Unlike)
		// 评论：列表公开；发/删登录（作者或 tweet:delete-any 在 application 层）
		r.With(d.OptionalAuth).Get("/{id}/comments", tweetH.ListComments)
		r.With(d.SessionAuth).Post("/{id}/comments", tweetH.CreateComment)
		r.With(d.SessionAuth).Delete("/{id}/comments/{commentId}", tweetH.DeleteComment)
		r.With(d.OptionalAuth).Get("/{id}/comments/{commentId}/replies", tweetH.ListReplies)
	})

	// 用户主页公开资料与推文列表（公开，支持 OptionalAuth 获取 is_liked）
	v1.With(d.OptionalAuth).Get("/users/{username}", tweetH.GetUserProfile)
	v1.With(d.OptionalAuth).Get("/users/{username}/tweets", tweetH.ListByUser)
}

// registerCodeRunnerRoutes 注册 /code-runner 路由（登录可执行，SSE 用 GET）。
func registerCodeRunnerRoutes(v1 chi.Router, d *Deps) {
	redisClient := d.Redis
	codeRunnerH := d.CodeRunner

	v1.Route("/code-runner", func(r chi.Router) {
		r.Use(d.SessionAuth)
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
		Handle("/api/v1/mcp", mcp.Post)
	r.With(middleware.RateLimit("mcp-scraper", redisClient, time.Minute, 30)).
		Handle("/api/v1/mcp/scraper", mcp.Scraper)
	r.With(middleware.RateLimit("mcp-reader", redisClient, time.Minute, 120)).
		Handle("/api/v1/mcp/reader", mcp.Public)
	r.With(middleware.RateLimit("mcp-comments", redisClient, time.Minute, 60)).
		Handle("/api/v1/mcp/comments", mcp.Comments)
}

// registerFriendLinkRoutes 注册友链前台公开路由。
//
// 公开端点：
//   - GET /friend-links：仅 approved 列表（前台首页展示）
//   - POST /friend-links：申请友链（OptionalAuth + 申请限流；登录跳验证码）
//   - POST /friend-links/code：匿名申请第一步，发送邮箱验证码（独立限流）
//
// 审核/写操作在 admin sub-router 内（friendlink:view/manage 权限码细分）。
// 与评论域同构：OptionalAuth 让登录态享受简化流程，匿名走邮箱验证码两步流。
func registerFriendLinkRoutes(v1 chi.Router, d *Deps) {
	redisClient := d.Redis
	friendLinkH := d.FriendLink

	v1.Route("/friend-links", func(r chi.Router) {
		r.Get("/", friendLinkH.ListPublic)
		r.With(
			d.OptionalAuth,
			middleware.FriendLinkRateLimit(redisClient),
		).Post("/", friendLinkH.Apply)
		r.With(middleware.FriendLinkCodeRateLimit(redisClient)).
			Post("/code", friendLinkH.SendCode)
	})
}

// registerNotificationRoutes 注册通知路由（全部登录鉴权）。
func registerNotificationRoutes(v1 chi.Router, d *Deps) {
	notifH := d.Notification

	v1.Route("/notifications", func(r chi.Router) {
		r.With(d.SessionAuth).Group(func(r chi.Router) {
			r.Get("/", notifH.List)
			r.Get("/unread-count", notifH.UnreadCount)
			r.Get("/stream", d.NotificationStream.Stream)
			r.Post("/read-all", notifH.MarkAllRead)
			r.Post("/{id}/read", notifH.MarkRead)
		})
	})
}

// registerChatRoutes 注册集中式聊天路由（全部登录鉴权）。
func registerChatRoutes(v1 chi.Router, d *Deps) {
	h := d.Chat
	v1.Route("/chat", func(r chi.Router) {
		r.With(d.SessionAuth).Get("/contacts", h.ListContacts)
		r.With(d.SessionAuth).Get("/users/{username}", h.FindUserByUsername)
		r.With(d.SessionAuth).Get("/unread-count", h.UnreadCount)
		r.With(d.SessionAuth).Get("/events", d.ChatStream.Stream)
		r.With(d.SessionAuth).Get("/push/config", h.PushConfig)
		r.With(d.SessionAuth).Post("/push/subscription", h.SavePushSubscription)
		r.With(d.SessionAuth).Delete("/push/subscription", h.DeletePushSubscription)

		r.With(d.SessionAuth).Get("/conversations", h.ListConversations)
		r.With(d.SessionAuth).Post("/conversations", h.CreateConversation)
		r.With(d.SessionAuth).Get("/conversations/{conversationId}", h.GetConversation)
		r.With(d.SessionAuth).Patch("/conversations/{conversationId}", h.RenameConversation)
		r.With(d.SessionAuth).Get("/conversations/{conversationId}/members", h.ListMembers)
		r.With(d.SessionAuth).Post("/conversations/{conversationId}/members", h.InviteMember)
		r.With(d.SessionAuth).Delete("/conversations/{conversationId}/members/me", h.LeaveConversation)
		r.With(d.SessionAuth).Delete("/conversations/{conversationId}/members/{userId}", h.RemoveMember)
		r.With(d.SessionAuth).Get("/conversations/{conversationId}/messages", h.ListMessages)
		r.With(d.SessionAuth).Get("/conversations/{conversationId}/messages/{messageId}/reactions", h.ListMessageReactions)
		r.With(d.SessionAuth).Post("/conversations/{conversationId}/messages/{messageId}/reactions", h.AddMessageReaction)
		r.With(d.SessionAuth).Delete("/conversations/{conversationId}/messages/{messageId}/reactions/{emojiId}", h.RemoveMessageReaction)
		r.With(d.SessionAuth).Post("/conversations/{conversationId}/messages", h.SendMessage)
		r.With(d.SessionAuth).Post("/conversations/{conversationId}/read", h.MarkRead)
		r.With(d.SessionAuth, middleware.ChatTypingRateLimit(d.Redis)).Post("/conversations/{conversationId}/typing", h.SetTyping)
		r.With(d.SessionAuth).Patch("/conversations/{conversationId}/mute", h.SetMuted)
		r.With(d.SessionAuth, middleware.RequirePermission(d.PermissionChecker, permission.ChatManage.String())).
			Delete("/conversations/{conversationId}/messages/{messageId}", h.DeleteMessage)
	})
}

// registerCustomEmojiRoutes 注册自定义表情路由（全部登录鉴权）。
// DELETE 的「owner 本人或 customemoji:manage」双重判定在 application 层完成
// （与 tweet:delete-any 同构，路由仅卡登录）。
func registerCustomEmojiRoutes(v1 chi.Router, d *Deps) {
	h := d.CustomEmoji
	v1.Route("/custom-emojis", func(r chi.Router) {
		r.With(d.SessionAuth).Post("/", h.Create)
		r.With(d.SessionAuth).Get("/mine", h.ListMine)
		r.With(d.SessionAuth).Delete("/{id}", h.Delete)
		r.With(d.SessionAuth).Post("/{id}/favorite", h.Favorite)
		r.With(d.SessionAuth).Delete("/{id}/favorite", h.Unfavorite)
	})
}
