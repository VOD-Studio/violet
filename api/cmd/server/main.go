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
	"blog-api/internal/handler"
	newmodel "blog-api/internal/infrastructure/persistence/gorm/model"
	"blog-api/internal/job"
	"blog-api/internal/middleware"
	"blog-api/internal/migrate"
	"blog-api/internal/model"
	"blog-api/internal/repository"
	"blog-api/internal/repository/generated"
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
	// 配置连接池（生产关键项，避免默认 4 连接成为瓶颈）
	db.SetMaxOpenConns(cfg.Database.MaxOpenConns)
	db.SetMaxIdleConns(cfg.Database.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.Database.ConnMaxLifetime)
	if err := db.PingContext(ctx); err != nil {
		log.Fatal().Err(err).Msg("数据库 ping 失败")
	}
	log.Info().
		Int("max_open_conns", cfg.Database.MaxOpenConns).
		Int("max_idle_conns", cfg.Database.MaxIdleConns).
		Str("conn_max_lifetime", cfg.Database.ConnMaxLifetime.String()).
		Msg("数据库连接成功")

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
	if err := gormDB.AutoMigrate(&model.File{}, &model.UploadSession{}); err != nil {
		log.Fatal().Err(err).Msg("GORM 自动迁移失败")
	}

	// P2: DDD 新 model 的 AutoMigrate（全 GORM AutoMigrate 策略）
	// 旧表已由 golang-migrate 创建，AutoMigrate 只补充缺失列/表，
	// 个别约束/索引名不一致属预期（旧表用 _key 后缀，GORM 用 uni_ 前缀），
	// 记录警告但不致命退出，保证服务能启动。
	if err := gormDB.AutoMigrate(
		&newmodel.User{}, &newmodel.Role{}, &newmodel.Permission{}, &newmodel.RolePermission{},
		&newmodel.Post{}, &newmodel.Tag{},
		&newmodel.Comment{}, &newmodel.CommentReaction{},
		&newmodel.Announcement{}, &newmodel.Project{},
		&newmodel.EmojiGroup{}, &newmodel.Emoji{}, &newmodel.Playlist{},
		&newmodel.File{},
	); err != nil {
		log.Warn().Err(err).Msg("DDD model AutoMigrate 部分失败（旧表约束名不一致，可忽略；新表/列已正常迁移）")
	}

	// P2.2d: 初始化 role/permission DDD 依赖容器（与旧代码并存）
	roleContainer, roleCleanup, err := app.InitializeRoleContainer(gormDB)
	if err != nil {
		log.Fatal().Err(err).Msg("DDD role 容器初始化失败")
	}
	defer roleCleanup()

	queries := generated.New(db)

	// --- 服务层初始化 ---

	// 评论使用 GORM repository
	commentRepo := repository.NewCommentRepository(gormDB)

	emailService := service.NewEmailService(cfg.ResendAPIKey, cfg.EmailFrom)

	// P2.1: 初始化 auth/user DDD 容器（复用旧 EmailService 作为 EmailSender）
	authContainer, err := app.NewAuthContainer(gormDB, redisClient, cfg, emailService, nil)
	if err != nil {
		log.Fatal().Err(err).Msg("DDD auth 容器初始化失败")
	}

	// P2.7: 中间件端口适配器
	// middleware.Auth 已重构为接收 TokenValidator 接口，
	// 优先使用 DDD JWTService 作为令牌校验源（与旧 AuthService 共享同一密钥对，令牌互通）。
	tokenValidator := newDDDAuthValidator(authContainer.JWTService)

	// P2.5: announcement + project DDD 容器
	contentContainer := app.NewContentContainer(gormDB)

	// P2.4: comment DDD 容器
	commentContainer := app.NewCommentContainer(gormDB)

	// P2.3: post DDD 容器
	postContainer := app.NewPostContainer(gormDB)

	// P2.6: emoji/music/upload DDD 容器
	mediaContainer := app.NewMediaContainer(gormDB)
	postService := service.NewPostService(queries)
	tagService := service.NewTagService(queries)
	commentReactionService := service.NewCommentReactionService(queries)
	settingsService := service.NewSettingsService(queries)
	commentService := service.NewCommentService(commentRepo, queries, commentReactionService, settingsService)
	statsService := service.NewStatsService(queries)
	userService := service.NewUserService(queries)
	fileService := service.NewFileService(gormDB, "uploads", cfg.UploadPathPrefix)
	uploadService := service.NewUploadService(gormDB, fileService, "uploads/tmp", "uploads", cfg.UploadPathPrefix, 1024*1024*1024)
	musicService := service.NewMusicService()
	musicSearchService := service.NewMusicSearchService()
	musicPlaylistAdminService := service.NewMusicPlaylistAdminService(queries, musicService)
	musicSettingsService := service.NewMusicSettingsService(queries)
	projectService := service.NewProjectService(queries)
	emojiService := service.NewEmojiService(queries, "uploads/emojis")
	emojiSeedService := service.NewEmojiSeedService(queries, "uploads/emojis", cfg.BilibiliCookie, cfg.BilibiliAPIType)
	auditService := service.NewAuditService(queries)

	// 表情种子数据初始化（幂等）
	// P2.7: 改用 GORM 计数，移除对 sqlc 的依赖
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

	// --- 超级管理员初始化（P2.7: 改用 DDD 用例，幂等）---
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
	// P2.7: auth/role/permission/announcement 已切换 DDD handler，旧 handler/service 不再初始化

	postHandler := handler.NewPostHandler(postService, tagService)
	tagHandler := handler.NewTagHandler(tagService)
	commentHandler := handler.NewCommentHandler(commentService, fileService)
	adminHandler := handler.NewAdminHandler(statsService)
	settingsHandler := handler.NewSettingsHandler(settingsService)
	githubService := service.NewGitHubService(settingsService)
	githubHandler := handler.NewGitHubHandler(githubService)
	userMgmtHandler := handler.NewUserManagementHandler(userService, auditService)
	mediaHandler := handler.NewMediaHandler(fileService, "uploads")
	uploadHandler := handler.NewUploadHandler(uploadService)
	musicHandler := handler.NewMusicHandler(musicService, musicSearchService)
	musicAdminHandler := handler.NewMusicAdminHandler(musicPlaylistAdminService, musicSettingsService)
	projectHandler := handler.NewProjectHandler(projectService)
	emojiHandler := handler.NewEmojiHandler(emojiService)
	commentReactionHandler := handler.NewCommentReactionHandler(commentReactionService)
	auditHandler := handler.NewAuditHandler(auditService)

	// --- 路由注册 ---

	r := chi.NewRouter()
	r.Use(middleware.Recoverer)       // panic 恢复（必须在最外层，捕获最广）
	r.Use(middleware.RequestID)       // 请求追踪 ID（注入 context + 响应头）
	r.Use(middleware.Logger)          // 请求日志记录（读取 request_id）
	r.Use(middleware.CORS)            // 跨域资源共享
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
	r.Route("/api/v1", func(v1 chi.Router) {

		// 公开站点设置
		v1.Get("/settings", settingsHandler.GetPublicSettings) // 获取公开站点配置

		// GitHub 数据（公开，Token 在后端管理）
		v1.Get("/github/contributions", githubHandler.GetContributions) // GitHub 贡献数据
		v1.Get("/github/repos", githubHandler.GetRepos)                 // GitHub 仓库数据

		// 认证（P2.7: DDD auth handler 已切换为官方路径）
		authH := authContainer.AuthHandler
		v1.Route("/auth", func(r chi.Router) {
			r.Post("/register", authH.Register)        // 用户注册
			r.Post("/verify-email", authH.VerifyEmail) // 邮箱验证
			r.Post("/login", authH.Login)              // 用户登录
			r.Post("/refresh", authH.Refresh)          // 刷新令牌
			r.Post("/forgot-password", authH.ForgotPassword) // 发送重置密码邮件
			r.Post("/reset-password", authH.ResetPassword)   // 重置密码

			r.Group(func(r chi.Router) {
				r.Use(middleware.Auth(tokenValidator))
				r.Post("/logout", authH.Logout)            // 用户登出
				r.Get("/me", authH.GetMe)                  // 获取当前用户信息
				r.Patch("/profile", authH.UpdateProfile)   // 更新个人资料
				r.Patch("/password", authH.ChangePassword) // 修改密码
			})
		})

		// 文章
		v1.Route("/posts", func(r chi.Router) {
			r.Get("/", postHandler.List)                    // 文章列表（分页）
			r.Get("/{id}", postHandler.GetByID)             // 按 ID 或 slug 获取文章（统一端点）
			r.Post("/{id}/view", postHandler.IncrementView) // 增加浏览次数

			r.Group(func(r chi.Router) {
				r.Use(middleware.Auth(tokenValidator))
				r.Post("/", postHandler.Create)                   // 创建文章
				r.Put("/{id}", postHandler.Update)                // 更新文章
				r.Delete("/{id}", postHandler.Delete)             // 删除文章
				r.Patch("/{id}/status", postHandler.UpdateStatus) // 更新文章状态（发布/草稿）
			})
		})

		// 标签
		v1.Route("/tags", func(r chi.Router) {
			r.Get("/", tagHandler.List) // 标签列表

			r.Group(func(r chi.Router) {
				r.Use(middleware.Auth(tokenValidator))
				r.Post("/", tagHandler.Create)       // 创建标签
				r.Delete("/{id}", tagHandler.Delete) // 删除标签
			})
		})

		// 评论
		v1.Route("/posts/{id}/comments", func(r chi.Router) {
			r.Get("/", commentHandler.ListApprovedComments)                                          // 获取文章已审核评论
			r.With(middleware.CommentRateLimit(redisClient)).Post("/", commentHandler.CreateComment) // 提交评论（限流）
		})

		v1.Route("/comments/{id}", func(r chi.Router) {
			r.Group(func(r chi.Router) {
				r.Use(middleware.Auth(tokenValidator))
				r.Use(middleware.AdminRequired)
				r.Patch("/status", commentHandler.UpdateCommentStatus) // 审核评论（通过/拒绝）
				r.Delete("/", commentHandler.DeleteComment)            // 删除评论
			})
		})

		// 评论反应（公开接口）
		v1.Route("/comments/{comment_id}/reactions", func(r chi.Router) {
			r.Get("/", commentReactionHandler.GetCommentReactions)                                         // 获取评论反应
			r.With(middleware.CommentRateLimit(redisClient)).Post("/", commentReactionHandler.AddReaction) // 添加反应（限流）
			r.Delete("/{emoji_id}", commentReactionHandler.RemoveReaction)                                 // 删除反应
		})

		// 批量获取评论反应
		v1.Post("/comments/reactions/batch", commentReactionHandler.GetReactionsBatch)

		// 媒体
		v1.Route("/media", func(r chi.Router) {
			r.Get("/{id}", mediaHandler.GetMedia) // 获取媒体详情（公开）

			r.Group(func(r chi.Router) {
				r.Use(middleware.Auth(tokenValidator))
				r.Get("/", mediaHandler.ListMedia)                      // 媒体列表（分页、类型筛选）
				r.Delete("/{id}", mediaHandler.DeleteMedia)             // 删除媒体
				r.Post("/batch-delete", mediaHandler.BatchDeleteMedia)  // 批量删除媒体
				r.Post("/{id}/thumbnail", mediaHandler.UploadThumbnail) // 上传视频封面缩略图
			})
		})

		// 分片上传
		v1.Route("/upload", func(r chi.Router) {
			r.Use(middleware.Auth(tokenValidator))
			r.Post("/init", uploadHandler.InitSession)                   // 初始化上传会话（含秒传检查、断点续传恢复）
			r.Put("/{uploadId}/chunk/{index}", uploadHandler.SaveChunk)  // 上传单个分片
			r.Post("/{uploadId}/complete", uploadHandler.CompleteUpload) // 合并所有分片为完整文件
			r.Delete("/{uploadId}", uploadHandler.CancelUpload)          // 取消上传，清理临时分片
			r.Get("/{uploadId}/status", uploadHandler.GetUploadStatus)   // 查询上传状态（断点续传）
		})

		// 音乐（公开）
		v1.Route("/music", func(r chi.Router) {
			r.Get("/embed", musicHandler.GetEmbedInfo)                          // 解析音乐链接返回嵌入信息
			r.Get("/playlist", musicHandler.GetPlaylist)                        // 解析歌单链接返回歌单信息
			r.Get("/song", musicHandler.GetSongDetail)                          // 获取歌曲详情
			r.Get("/search", musicHandler.SearchSongs)                          // 搜索歌曲
			r.Get("/lyrics", musicHandler.GetLyrics)                            // 获取歌词
			r.Get("/meta", musicHandler.FetchSongMeta)                          // 获取歌曲元数据（封面+歌词）
			r.Get("/playlists/active", musicAdminHandler.GetAllActivePlaylists) // 获取所有启用歌单
			r.Get("/settings", musicAdminHandler.GetMusicSettings)              // 获取播放器设置
		})

		// 项目
		v1.Route("/projects", func(r chi.Router) {
			r.Get("/", projectHandler.List)        // 项目列表
			r.Get("/{id}", projectHandler.GetByID) // 项目详情
		})

		// 表情（公开）
		v1.Route("/emojis", func(r chi.Router) {
			r.Get("/", emojiHandler.GetAllEmojis)                     // 获取所有启用表情分组和表情
			r.Get("/groups/{name}", emojiHandler.GetEmojiGroupByName) // 按名称获取指定表情分组
		})

		// 公告（公开，P2.7: DDD content handler）
		contentH := contentContainer.ContentHandler
		v1.Get("/announcements", contentH.ListActiveAnnouncements) // 获取生效公告列表

		// =====================================================
		// 管理员路由（认证 + 管理员权限）
		// =====================================================
		v1.Route("/admin", func(r chi.Router) {
			r.Use(middleware.Auth(tokenValidator))
			r.Use(middleware.AdminRequired)

			// P2.7: DDD role/permission handler 切换为官方路径
			roleH := roleContainer.RoleHandler

			r.Get("/stats", adminHandler.GetDashboardStats)   // 仪表盘总览统计
			r.Get("/stats/views", adminHandler.GetViewTrends) // 浏览量趋势

			r.Get("/settings", settingsHandler.GetSettings)    // 获取站点设置
			r.Put("/settings", settingsHandler.UpdateSettings) // 更新站点设置

			r.Get("/users", userMgmtHandler.ListUsers)                           // 用户列表
			r.Get("/users/{id}", userMgmtHandler.GetUserDetail)                  // 用户详情
			r.Post("/users", userMgmtHandler.CreateUser)                         // 创建用户
			r.Put("/users/{id}", userMgmtHandler.UpdateUser)                     // 编辑用户
			r.Delete("/users/{id}", userMgmtHandler.DeleteUser)                  // 删除用户
			r.Patch("/users/{id}/role", userMgmtHandler.UpdateUserRole)          // 修改用户角色
			r.Patch("/users/{id}/status", userMgmtHandler.UpdateUserStatus)      // 启用/禁用用户
			r.Post("/users/batch-status", userMgmtHandler.BatchUpdateUserStatus) // 批量启用/禁用用户
			r.Post("/users/batch-role", userMgmtHandler.BatchUpdateUserRole)     // 批量修改用户角色

			// 权限管理（P2.7: DDD role handler）
			r.Get("/permissions", roleH.ListPermissions) // 获取所有权限定义

			// 权限 CRUD（仅限超级管理员）
			r.Group(func(r chi.Router) {
				r.Use(middleware.SuperAdminRequired)
				r.Post("/permissions", roleH.CreatePermission)          // 创建权限
				r.Patch("/permissions/{code}", roleH.UpdatePermission)  // 更新权限
				r.Delete("/permissions/{code}", roleH.DeletePermission) // 删除权限
			})

			// 角色管理（P2.7: DDD role handler，移除 role:manage 旧权限点检查）
			r.Get("/roles", roleH.ListRoles)                           // 角色列表
			r.Get("/roles/{id}", roleH.GetRole)                        // 角色详情（含权限）
			r.Post("/roles", roleH.CreateRole)                         // 创建角色
			r.Patch("/roles/{id}", roleH.UpdateRole)                   // 更新角色
			r.Delete("/roles/{id}", roleH.DeleteRole)                  // 删除角色
			r.Patch("/roles/{id}/permissions", roleH.UpdateRolePermissions) // 设置角色权限

			// 操作日志
			r.Get("/logs", auditHandler.ListLogs)                 // 操作日志列表
			r.Get("/logs/user/{id}", auditHandler.ListLogsByUser) // 用户操作日志

			// 公告管理（P2.7: DDD content handler）
			r.Get("/announcements", contentH.ListAnnouncements)       // 公告列表
			r.Get("/announcements/{id}", contentH.GetAnnouncement)    // 公告详情
			r.Post("/announcements", contentH.CreateAnnouncement)     // 创建公告
			r.Patch("/announcements/{id}", contentH.UpdateAnnouncement)  // 更新公告
			r.Delete("/announcements/{id}", contentH.DeleteAnnouncement) // 删除公告

			r.Get("/comments/pending", commentHandler.ListPendingComments)             // 待审核评论列表
			r.Get("/comments/pending/count", commentHandler.CountPendingComments)      // 待审核评论数量
			r.Get("/comments", commentHandler.ListAllComments)                         // 所有评论列表（支持状态筛选）
			r.Get("/comments/{id}", commentHandler.GetCommentDetail)                   // 评论详情
			r.Patch("/comments/batch-status", commentHandler.BatchUpdateCommentStatus) // 批量更新评论状态

			// 音乐管理
			r.Route("/music", func(r chi.Router) {
				r.Route("/playlists", func(r chi.Router) {
					r.Get("/", musicAdminHandler.ListPlaylists)                               // 歌单列表
					r.Post("/", musicAdminHandler.CreatePlaylist)                             // 导入歌单
					r.Post("/custom", musicAdminHandler.CreateCustomPlaylist)                 // 创建自定义歌单
					r.Patch("/{id}", musicAdminHandler.UpdatePlaylist)                        // 更新歌单（启用/禁用）
					r.Delete("/{id}", musicAdminHandler.DeletePlaylist)                       // 删除歌单
					r.Post("/{id}/activate", musicAdminHandler.SetActivePlaylist)             // 设置为启用歌单
					r.Post("/{id}/refresh", musicAdminHandler.RefreshPlaylistSongs)           // 刷新歌单歌曲
					r.Post("/{id}/songs", musicAdminHandler.AddSongToPlaylist)                // 添加歌曲到歌单
					r.Delete("/{id}/songs/{index}", musicAdminHandler.RemoveSongFromPlaylist) // 从歌单移除歌曲
					r.Patch("/{id}/songs/{index}", musicAdminHandler.UpdateSongInPlaylist)    // 更新歌单中的歌曲信息
				})
				r.Patch("/settings", musicAdminHandler.UpdatePlayerVersion) // 更新播放器设置
			})

			// 表情管理
			r.Route("/emojis", func(r chi.Router) {
				r.Route("/groups", func(r chi.Router) {
					r.Get("/", emojiHandler.ListAllGroups)                   // 获取所有表情分组（含未启用）
					r.Post("/", emojiHandler.CreateGroup)                    // 创建表情分组
					r.Patch("/batch-status", emojiHandler.BatchUpdateStatus) // 批量更新分组启用状态
					r.Patch("/{id}", emojiHandler.UpdateGroup)               // 更新表情分组
					r.Delete("/{id}", emojiHandler.DeleteGroup)              // 删除表情分组
					r.Get("/{id}/emojis", emojiHandler.ListGroupEmojis)      // 获取分组内表情列表
					r.Post("/{id}/emojis", emojiHandler.CreateEmoji)         // 在分组内创建表情
				})
				r.Post("/upload", emojiHandler.UploadEmoji) // 上传表情图片
				r.Patch("/{id}", emojiHandler.UpdateEmoji)  // 更新表情
				r.Delete("/{id}", emojiHandler.DeleteEmoji) // 删除表情
			})

			r.Route("/projects", func(r chi.Router) {
				r.Post("/", projectHandler.Create)       // 创建项目
				r.Put("/{id}", projectHandler.Update)    // 更新项目
				r.Delete("/{id}", projectHandler.Delete) // 删除项目
			})
		})
	})

	// ============================================================
	// P2.7: 已迁移至官方路径的 DDD 模块（auth/role/permission/announcement）
	//       其 shadow 路由已删除，下方仅保留尚未迁移模块的 shadow 路由
	// ============================================================

	// announcement + project DDD 影子路由
	contentH := contentContainer.ContentHandler
	// 项目（前台公开读取）
	r.Get("/api/v1/projects/ddd", contentH.ListProjects)
	// 项目（后台管理）
	r.Route("/api/v1/admin/ddd/projects", func(r chi.Router) {
		r.Use(middleware.Auth(tokenValidator))
		r.Use(middleware.AdminRequired)
		r.Post("/", contentH.CreateProject)
		r.Put("/{id}", contentH.UpdateProject)
		r.Delete("/{id}", contentH.DeleteProject)
	})

	// comment DDD 影子路由
	commentH := commentContainer.CommentHandler
	// 前台公开（按文章列出评论 + 发表评论）
	r.Get("/api/v1/posts/ddd/{postId}/comments", commentH.ListByPost)
	r.Post("/api/v1/posts/ddd/{postId}/comments", commentH.Create)
	// 后台管理（待审核列表 + 审核 + 删除）
	r.Route("/api/v1/admin/ddd/comments", func(r chi.Router) {
		r.Use(middleware.Auth(tokenValidator))
		r.Use(middleware.AdminRequired)
		r.Get("/pending", commentH.ListPending)
		r.Patch("/{id}/approve", commentH.Approve)
		r.Patch("/{id}/spam", commentH.MarkSpam)
		r.Delete("/{id}", commentH.Delete)
	})

	// post DDD 影子路由
	postH := postContainer.PostHandler
	// 前台公开
	r.Get("/api/v1/posts/ddd", postH.ListPublished)
	r.Get("/api/v1/posts/ddd/{slug}", postH.GetBySlug)
	// 后台管理
	r.Route("/api/v1/admin/ddd/posts", func(r chi.Router) {
		r.Use(middleware.Auth(tokenValidator))
		r.Use(middleware.AdminRequired)
		r.Get("/", postH.ListAll)
		r.Post("/", postH.Create)
		r.Put("/{id}", postH.Update)
		r.Patch("/{id}/publish", postH.Publish)
		r.Delete("/{id}", postH.Delete)
	})

	// media DDD 影子路由
	mediaH := mediaContainer.MediaHandler
	// 表情（前台公开）
	r.Get("/api/v1/emojis/ddd", mediaH.GetAllEmojis)
	// 表情（后台管理）
	r.Route("/api/v1/admin/ddd/emojis", func(r chi.Router) {
		r.Use(middleware.Auth(tokenValidator))
		r.Use(middleware.AdminRequired)
		r.Get("/groups", mediaH.ListAllEmojiGroups)
		r.Post("/groups", mediaH.CreateEmojiGroup)
		r.Patch("/groups/{id}/enabled", mediaH.SetEmojiGroupEnabled)
		r.Delete("/groups/{id}", mediaH.DeleteEmojiGroup)
	})
	// 音乐（前台公开）
	r.Get("/api/v1/music/ddd/playlists/active", mediaH.GetActivePlaylists)
	// 音乐（后台管理）
	r.Route("/api/v1/admin/ddd/music", func(r chi.Router) {
		r.Use(middleware.Auth(tokenValidator))
		r.Use(middleware.AdminRequired)
		r.Get("/playlists", mediaH.ListAllPlaylists)
		r.Patch("/playlists/{id}/active", mediaH.SetPlaylistActive)
		r.Delete("/playlists/{id}", mediaH.DeletePlaylist)
	})
	// 文件（后台管理）
	r.Route("/api/v1/admin/ddd/files", func(r chi.Router) {
		r.Use(middleware.Auth(tokenValidator))
		r.Use(middleware.AdminRequired)
		r.Get("/", mediaH.ListFiles)
		r.Get("/instant", mediaH.CheckInstantUpload)
		r.Delete("/{id}", mediaH.DeleteFile)
	})

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
