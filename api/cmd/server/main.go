// Package main 博客 API 服务主程序入口
// 初始化数据库、Redis、服务层和路由，启动 HTTP 服务器
package main

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"blog-api/config"
	"blog-api/internal/app"
	authcmd "blog-api/internal/application/auth/command"
	infraemail "blog-api/internal/infrastructure/email"
	newmodel "blog-api/internal/infrastructure/persistence/gorm/model"
	"blog-api/internal/job"
	"blog-api/internal/middleware"
	"blog-api/internal/migrate"
	"blog-api/internal/service"
)

func main() {
	_ = godotenv.Load()
	ctx := context.Background()
	cfg := config.Load()

	// --- 日志初始化 ---
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	// 根据配置判断是否为开发环境
	if cfg.Environment == "development" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	} else {
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	}
	log.Logger = log.With().Str("service", "blog-api").Logger()

	// --- 基础设施初始化 ---

	db, err := sql.Open("pgx", cfg.Database.DSN())
	if err != nil {
		log.Fatal().Err(err).Msg("数据库连接失败")
	}
	defer db.Close()

	migrateURL := fmt.Sprintf("pgx5://%s", cfg.Database.DSN()[len("postgres://"):])
	if err := migrate.RunMigrations("migrations", migrateURL, db); err != nil {
		log.Fatal().Err(err).Msg("数据库迁移失败")
	}

	redisOpt, err := redis.ParseURL(cfg.Redis.DSN())
	if err != nil {
		log.Fatal().Err(err).Msg("解析 Redis 地址失败")
	}
	redisClient := redis.NewClient(redisOpt)
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Fatal().Err(err).Msg("Redis 连接失败")
	}
	log.Info().Msg("Redis 连接成功")

	gormDB, err := gorm.Open(postgres.Open(cfg.Database.DSN()), &gorm.Config{})
	if err != nil {
		log.Fatal().Err(err).Msg("GORM 连接失败")
	}

	// P2: DDD 新 model 的 AutoMigrate（全 GORM AutoMigrate 策略）
	// 记录警告但不致命退出，保证服务能启动。
	if err := gormDB.AutoMigrate(
		&newmodel.User{}, &newmodel.Role{}, &newmodel.Permission{}, &newmodel.RolePermission{},
		&newmodel.Post{}, &newmodel.PostView{}, &newmodel.Tag{},
		&newmodel.Comment{}, &newmodel.CommentReaction{},
		&newmodel.Announcement{}, &newmodel.Project{},
		&newmodel.EmojiGroup{}, &newmodel.Emoji{}, &newmodel.Playlist{},
		&newmodel.MusicSetting{},
		&newmodel.File{}, &newmodel.UploadSession{},
	); err != nil {
	}

	roleContainer, roleCleanup, err := app.InitializeRoleContainer(gormDB)
	if err != nil {
		log.Fatal().Err(err).Msg("DDD role 容器初始化失败")
	}
	defer roleCleanup()

	// --- 服务层初始化 ---

	emailSender := infraemail.NewSender(cfg.ResendAPIKey, cfg.EmailFrom)

	authContainer, err := app.NewAuthContainer(gormDB, redisClient, cfg, emailSender, nil)
	if err != nil {
		log.Fatal().Err(err).Msg("DDD auth 容器初始化失败")
	}

	// middleware.Auth 已重构为接收 TokenValidator 接口，
	tokenValidator := newDDDAuthValidator(authContainer.JWTService)

	contentContainer := app.NewContentContainer(gormDB)

	commentContainer := app.NewCommentContainer(gormDB)

	postContainer := app.NewPostContainer(gormDB)
	settingsContainer := app.NewSettingsContainer(gormDB)
	tagContainer := app.NewTagContainer(gormDB)
	githubContainer := app.NewGitHubContainer(settingsContainer.Store)
	auditContainer := app.NewAuditContainer(gormDB)
	statsContainer := app.NewStatsContainer(gormDB)
	userAdminContainer := app.NewUserAdminContainer(gormDB, authcmd.NewBcryptHasher(), auditContainer.Service)
	commentReactionContainer := app.NewCommentReactionContainer(gormDB)

	mediaContainer := app.NewMediaContainer(gormDB, "uploads/emojis", "uploads/tmp", "uploads", "/uploads/")
	emojiSeedService := service.NewEmojiSeedService(gormDB, "uploads/emojis", cfg.BilibiliCookie, cfg.BilibiliAPIType)

	// 表情种子数据初始化（幂等）
	var emojiGroupCount int64
	if err := gormDB.Model(&newmodel.EmojiGroup{}).Count(&emojiGroupCount).Error; err != nil {
		log.Error().Err(err).Msg("检查表情分组数量失败")
	} else if emojiGroupCount == 0 {
		log.Info().Msg("表情分组为空，开始初始化 B站表情种子数据...")
		if err := emojiSeedService.SeedBilibiliEmojis(ctx); err != nil {
			log.Error().Err(err).Msg("表情种子数据初始化失败（不影响服务启动）")
		}
	} else {
		log.Info().Int64("count", emojiGroupCount).Msg("表情分组已有数据，跳过种子初始化")
	}

	cleanupJob := job.NewCleanupJob(gormDB, "uploads/tmp")
	go cleanupJob.Start(ctx)

	// --- 超级管理员初始化---
	if cfg.SuperAdmin.Enabled {
		if err := authContainer.EnsureSuperAdmin.Handle(ctx, authcmd.EnsureSuperAdminInput{
			Email:    cfg.SuperAdmin.Email,
			Username: cfg.SuperAdmin.Username,
			Password: cfg.SuperAdmin.Password,
		}); err != nil {
			log.Fatal().Err(err).Msg("超级管理员初始化失败")
		}
	}

	// --- 处理器初始化 ---

	// --- 路由注册 ---

	r := chi.NewRouter()
	r.Use(middleware.Recoverer) // panic 恢复（必须在最外层，捕获最广）
	r.Use(middleware.RequestID) // 请求追踪 ID（注入 context + 响应头）
	r.Use(middleware.Logger)    // 请求日志记录（读取 request_id）
	// CORS：来源由配置驱动；CSRF 中间件（step2 接入后）要求 X-CSRF-Token 在 AllowedHeaders
	r.Use(middleware.NewCORS(
		cfg.CORSAllowedOrigins,
		middleware.WithCSRFHeader("X-CSRF-Token"),
	))
	r.Use(middleware.SecurityHeaders) // 安全响应头

	// 健康检查（无版本前缀）
	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ok","message":"博客 API 服务运行中"}`)
	})

	// =====================================================
	// API v1
	// =====================================================
	mediaH := mediaContainer.MediaHandler

	r.Route("/api/v1", func(v1 chi.Router) {

		// 公开站点设置
		v1.Get("/settings", settingsContainer.SettingsHandler.GetPublicSettings) // 获取公开站点配置

		// GitHub 数据（公开，Token 在后端管理）
		v1.Get("/github/contributions", githubContainer.GitHubHandler.GetContributions) // GitHub 贡献数据
		v1.Get("/github/repos", githubContainer.GitHubHandler.GetRepos)                 // GitHub 仓库数据

		// 认证
		authH := authContainer.AuthHandler
		contentH := contentContainer.ContentHandler
		v1.Route("/auth", func(r chi.Router) {
			r.Post("/register", authH.Register)              // 用户注册
			r.Post("/verify-email", authH.VerifyEmail)       // 邮箱验证
			r.Post("/login", authH.Login)                    // 用户登录
			r.Post("/refresh", authH.Refresh)                // 刷新令牌
			r.Post("/forgot-password", authH.ForgotPassword) // 发送重置密码邮件
			r.Post("/reset-password", authH.ResetPassword)   // 重置密码

			r.Group(func(r chi.Router) {
				r.Use(middleware.Auth(tokenValidator, middleware.WithAccessCookie(cfg.Cookie.AccessName)))
				r.Post("/logout", authH.Logout)            // 用户登出
				r.Get("/me", authH.GetMe)                  // 获取当前用户信息
				r.Patch("/profile", authH.UpdateProfile)   // 更新个人资料
				r.Patch("/password", authH.ChangePassword) // 修改密码
			})
		})

		// 文章（DDD postH；前台公开 List/详情/浏览）
		postH := postContainer.PostHandler
		v1.Route("/posts", func(r chi.Router) {
			r.Get("/", postH.ListPublished)           // 已发布文章列表（分页）
			r.Get("/{slug}", postH.GetBySlug)         // 按 slug 获取文章
			r.Post("/{id}/view", postH.IncrementView) // 增加浏览次数
		})

		// 标签（DDD tagContainer）
		tagH := tagContainer.TagHandler
		v1.Route("/tags", func(r chi.Router) {
			r.Get("/", tagH.List) // 标签列表（公开）

			r.Group(func(r chi.Router) {
				r.Use(middleware.Auth(tokenValidator, middleware.WithAccessCookie(cfg.Cookie.AccessName)))
				r.Use(middleware.AdminRequired)
				r.Post("/", tagH.Create)       // 创建标签
				r.Delete("/{id}", tagH.Delete) // 删除标签
			})
		})

		// 评论（DDD commentH；评论反应 DDD commentReactionContainer）
		commentH := commentContainer.CommentHandler
		v1.Route("/posts/{postId}/comments", func(r chi.Router) {
			r.Get("/", commentH.ListByPost)                                             // 获取文章已审核评论
			r.With(middleware.CommentRateLimit(redisClient)).Post("/", commentH.Create) // 提交评论（限流）
		})

		// 评论反应（DDD commentReactionContainer）
		crH := commentReactionContainer.CommentReactionHandler
		v1.Route("/comments/{comment_id}/reactions", func(r chi.Router) {
			r.Get("/", crH.GetCommentReactions)                                         // 获取评论反应
			r.With(middleware.CommentRateLimit(redisClient)).Post("/", crH.AddReaction) // 添加反应（限流）
			r.Delete("/{emoji_id}", crH.RemoveReaction)                                 // 删除反应
		})
		v1.Post("/comments/reactions/batch", crH.GetReactionsBatch) // 批量获取评论反应

		// 评论审核/删除（DDD commentH，admin 权限）
		v1.Route("/comments/{id}", func(r chi.Router) {
			r.Group(func(r chi.Router) {
				r.Use(middleware.Auth(tokenValidator, middleware.WithAccessCookie(cfg.Cookie.AccessName)))
				r.Use(middleware.AdminRequired)
				r.Patch("/approve", commentH.Approve) // 审核通过
				r.Patch("/spam", commentH.MarkSpam)   // 标记垃圾
				r.Delete("/", commentH.Delete)        // 删除评论
			})
		})

		// 媒体（DDD mediaH）
		v1.Route("/media", func(r chi.Router) {
			r.Get("/{id}", mediaH.GetMedia) // 获取媒体详情（公开）

			r.Group(func(r chi.Router) {
				r.Use(middleware.Auth(tokenValidator, middleware.WithAccessCookie(cfg.Cookie.AccessName)))
				r.Get("/", mediaH.ListFiles)                      // 媒体列表（分页、用途筛选）
				r.Delete("/{id}", mediaH.DeleteFile)              // 删除媒体
				r.Post("/batch-delete", mediaH.BatchDeleteMedia)  // 批量删除媒体
				r.Post("/{id}/thumbnail", mediaH.UploadThumbnail) // 上传缩略图
			})
		})

		// 分片上传（DDD mediaH）
		v1.Route("/upload", func(r chi.Router) {
			r.Use(middleware.Auth(tokenValidator, middleware.WithAccessCookie(cfg.Cookie.AccessName)))
			r.Post("/init", mediaH.InitUploadSession)                  // 初始化上传会话（秒传/续传/新建）
			r.Put("/{uploadId}/chunk/{index}", mediaH.SaveUploadChunk) // 上传单个分片
			r.Post("/{uploadId}/complete", mediaH.CompleteUpload)      // 合并所有分片
			r.Delete("/{uploadId}", mediaH.CancelUpload)               // 取消上传
			r.Get("/{uploadId}/status", mediaH.GetUploadStatus)        // 查询上传状态
		})

		// 音乐（DDD mediaH，公开）
		v1.Route("/music", func(r chi.Router) {
			r.Get("/embed", mediaH.GetMusicEmbed)                 // 解析音乐链接返回嵌入信息
			r.Get("/playlist", mediaH.ParsePlaylist)              // 解析歌单链接返回歌单信息
			r.Get("/song", mediaH.GetSongDetail)                  // 获取歌曲详情
			r.Get("/search", mediaH.SearchSongs)                  // 搜索歌曲
			r.Get("/lyrics", mediaH.GetLyrics)                    // 获取歌词
			r.Get("/meta", mediaH.GetSongMeta)                    // 获取歌曲元数据（封面+歌词）
			r.Get("/playlists/active", mediaH.GetActivePlaylists) // 获取所有启用歌单
			r.Get("/settings", mediaH.GetMusicSettings)           // 获取播放器设置
		})

		// 项目（公开）
		v1.Route("/projects", func(r chi.Router) {
			r.Get("/", contentH.ListProjects)   // 项目列表
			r.Get("/{id}", contentH.GetProject) // 项目详情
		})

		// 表情（DDD mediaH，公开）
		v1.Route("/emojis", func(r chi.Router) {
			r.Get("/", mediaH.GetAllEmojis)                     // 获取所有启用表情分组和表情
			r.Get("/groups/{name}", mediaH.GetEmojiGroupByName) // 按名称获取指定表情分组
		})

		// 公告
		v1.Get("/announcements", contentH.ListActiveAnnouncements) // 获取生效公告列表

		// =====================================================
		// 管理员路由（认证 + 管理员权限）
		// =====================================================
		v1.Route("/admin", func(r chi.Router) {
			r.Use(middleware.Auth(tokenValidator, middleware.WithAccessCookie(cfg.Cookie.AccessName)))
			r.Use(middleware.AdminRequired)

			roleH := roleContainer.RoleHandler

			r.Get("/stats", statsContainer.StatsHandler.GetDashboardStats)   // 仪表盘总览统计
			r.Get("/stats/views", statsContainer.StatsHandler.GetViewTrends) // 浏览量趋势

			r.Get("/settings", settingsContainer.SettingsHandler.GetSettings)    // 获取站点设置
			r.Put("/settings", settingsContainer.SettingsHandler.UpdateSettings) // 更新站点设置

			// 用户管理（DDD userAdminContainer）
			r.Get("/users", userAdminContainer.UserAdminHandler.ListUsers)                       // 用户列表
			r.Get("/users/{id}", userAdminContainer.UserAdminHandler.GetUserDetail)              // 用户详情
			r.Post("/users", userAdminContainer.UserAdminHandler.CreateUser)                     // 创建用户
			r.Put("/users/{id}", userAdminContainer.UserAdminHandler.UpdateUser)                 // 编辑用户
			r.Delete("/users/{id}", userAdminContainer.UserAdminHandler.DeleteUser)              // 删除用户
			r.Patch("/users/{id}/role", userAdminContainer.UserAdminHandler.UpdateUserRole)      // 修改用户角色
			r.Patch("/users/{id}/status", userAdminContainer.UserAdminHandler.UpdateUserStatus)  // 启用/禁用用户
			r.Post("/users/batch-status", userAdminContainer.UserAdminHandler.BatchUpdateStatus) // 批量启用/禁用用户
			r.Post("/users/batch-role", userAdminContainer.UserAdminHandler.BatchUpdateRole)     // 批量修改用户角色

			// 权限管理
			r.Get("/permissions", roleH.ListPermissions) // 获取所有权限定义

			// 权限 CRUD（仅限超级管理员）
			r.Group(func(r chi.Router) {
				r.Use(middleware.SuperAdminRequired)
				r.Post("/permissions", roleH.CreatePermission)          // 创建权限
				r.Patch("/permissions/{code}", roleH.UpdatePermission)  // 更新权限
				r.Delete("/permissions/{code}", roleH.DeletePermission) // 删除权限
			})

			// 角色管理
			r.Get("/roles", roleH.ListRoles)                                // 角色列表
			r.Get("/roles/{id}", roleH.GetRole)                             // 角色详情（含权限）
			r.Post("/roles", roleH.CreateRole)                              // 创建角色
			r.Patch("/roles/{id}", roleH.UpdateRole)                        // 更新角色
			r.Delete("/roles/{id}", roleH.DeleteRole)                       // 删除角色
			r.Patch("/roles/{id}/permissions", roleH.UpdateRolePermissions) // 设置角色权限

			// 操作日志
			r.Get("/logs", auditContainer.AuditHandler.ListLogs)                 // 操作日志列表
			r.Get("/logs/user/{id}", auditContainer.AuditHandler.ListLogsByUser) // 用户操作日志

			// 公告管理
			r.Get("/announcements", contentH.ListAnnouncements)          // 公告列表
			r.Get("/announcements/{id}", contentH.GetAnnouncement)       // 公告详情
			r.Post("/announcements", contentH.CreateAnnouncement)        // 创建公告
			r.Patch("/announcements/{id}", contentH.UpdateAnnouncement)  // 更新公告
			r.Delete("/announcements/{id}", contentH.DeleteAnnouncement) // 删除公告

			r.Get("/comments/pending", commentH.ListPending)              // 待审核评论列表
			r.Get("/comments/pending/count", commentH.CountPending)       // 待审核评论数量
			r.Get("/comments", commentH.ListAll)                          // 所有评论列表（支持状态筛选）
			r.Get("/comments/{id}", commentH.GetDetail)                   // 评论详情
			r.Patch("/comments/batch-status", commentH.BatchUpdateStatus) // 批量更新评论状态

			// 文章管理（DDD postH）
			r.Get("/posts", postH.ListAll)                    // 所有文章列表
			r.Get("/posts/{id}", postH.GetByID)               // 文章详情
			r.Post("/posts", postH.Create)                    // 创建文章
			r.Put("/posts/{id}", postH.Update)                // 更新文章
			r.Patch("/posts/{id}/status", postH.UpdateStatus) // 更新文章状态
			r.Delete("/posts/{id}", postH.Delete)             // 删除文章

			// 音乐管理（DDD mediaH）
			r.Route("/music", func(r chi.Router) {
				r.Route("/playlists", func(r chi.Router) {
					r.Get("/", mediaH.ListAllPlaylists)                            // 歌单列表
					r.Post("/", mediaH.CreatePlaylist)                             // 导入歌单
					r.Post("/custom", mediaH.CreateCustomPlaylist)                 // 创建自定义歌单
					r.Get("/{id}", mediaH.GetPlaylistDetail)                       // 歌单详情
					r.Patch("/{id}", mediaH.UpdatePlaylist)                        // 更新歌单
					r.Delete("/{id}", mediaH.DeletePlaylist)                       // 删除歌单
					r.Patch("/{id}/active", mediaH.SetPlaylistActive)              // 启用/禁用歌单
					r.Post("/{id}/refresh", mediaH.RefreshPlaylist)                // 刷新歌单歌曲
					r.Post("/{id}/songs", mediaH.AddSongToPlaylist)                // 添加歌曲到歌单
					r.Delete("/{id}/songs/{index}", mediaH.RemoveSongFromPlaylist) // 移除歌曲
					r.Patch("/{id}/songs/{index}", mediaH.UpdateSongInPlaylist)    // 更新歌曲
				})
				r.Patch("/settings", mediaH.UpdatePlayerVersion) // 更新播放器设置
			})

			// 表情管理（DDD mediaH）
			r.Route("/emojis", func(r chi.Router) {
				// 分组管理
				r.Get("/groups", mediaH.ListAllEmojiGroups)                         // 所有分组（含未启用）
				r.Post("/groups", mediaH.CreateEmojiGroup)                          // 创建分组
				r.Patch("/groups/batch-status", mediaH.BatchUpdateEmojiGroupStatus) // 批量启用/禁用分组
				r.Patch("/groups/{id}", mediaH.UpdateEmojiGroup)                    // 更新分组
				r.Delete("/groups/{id}", mediaH.DeleteEmojiGroup)                   // 删除分组
				// 分组内表情
				r.Get("/groups/{id}/emojis", mediaH.ListGroupEmojis) // 分组内表情列表
				r.Post("/groups/{id}/emojis", mediaH.CreateEmoji)    // 在分组内创建表情
				// 单个表情（注意 {id} 必须在 groups 之后，避免与 groups/{id} 冲突）
				r.Post("/upload", mediaH.UploadEmoji)        // 上传表情图片
				r.Patch("/emojis/{id}", mediaH.UpdateEmoji)  // 更新表情
				r.Delete("/emojis/{id}", mediaH.DeleteEmoji) // 删除表情
			})

			r.Route("/projects", func(r chi.Router) {
				r.Post("/", contentH.CreateProject)       // 创建项目
				r.Put("/{id}", contentH.UpdateProject)    // 更新项目
				r.Delete("/{id}", contentH.DeleteProject) // 删除项目
			})

			// 文件管理（DDD mediaH）
			r.Get("/files", mediaH.ListFiles)                  // 文件列表
			r.Get("/files/instant", mediaH.CheckInstantUpload) // 秒传检查
			r.Delete("/files/{id}", mediaH.DeleteFile)         // 删除文件
		})
	})

	// ============================================================
	// ============================================================

	// 静态文件服务（无版本前缀）
	fileServer := http.FileServer(http.Dir("./uploads"))
	r.Get("/uploads/*", func(w http.ResponseWriter, r *http.Request) {
		http.StripPrefix("/uploads/", fileServer).ServeHTTP(w, r)
	})

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Info().Str("addr", addr).Msg("博客 API 服务启动")
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal().Err(err).Msg("服务启动失败")
	}
}
