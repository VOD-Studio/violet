// Package main 博客 API 服务主程序入口
// 初始化数据库、Redis、服务层和路由，启动 HTTP 服务器
package main

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

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
	appshared "blog-api/internal/application/shared"
	infraemail "blog-api/internal/infrastructure/email"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	newmodel "blog-api/internal/infrastructure/persistence/gorm/model"
	"blog-api/internal/job"
	"blog-api/internal/middleware"
	"blog-api/internal/migrate"
	"blog-api/internal/openapi"
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

	// 配置受信代理（限流/IP 提取依赖；为空时一律使用 RemoteAddr）
	middleware.SetTrustedProxies(cfg.TrustedProxies)

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
		log.Warn().Err(err).Msg("AutoMigrate error")
	}

	roleContainer, roleCleanup, err := app.InitializeRoleContainer(gormDB)
	if err != nil {
		log.Fatal().Err(err).Msg("DDD role 容器初始化失败")
	}
	defer roleCleanup()

	// --- 服务层初始化 ---

	// 邮件发送：devMode 下打印验证码明文到日志，方便开发期联调（无需配置 Resend）。
	emailSender := infraemail.NewSender(cfg.ResendAPIKey, cfg.EmailFrom, cfg.Environment != "production")

	// 权限检查服务：RequirePermission 中间件依赖。superadmin 通配放行，
	// 其他角色按 role_permissions 表判断（带 5min 内存缓存）。
	permissionChecker := service.NewPermissionService(gormrepo.NewRoleRepository(gormDB), 0)

	// 事件总线：当前无异步事件订阅者，用 NoopEventBus 占位（非 nil），
	// 避免 RegisterUserHandler.Publish 在 nil bus 上触发 panic。
	// 后续接入真实事件总线（如发欢迎邮件、统计）时替换为 InMemory 实现。
	authContainer, err := app.NewAuthContainer(gormDB, redisClient, cfg, emailSender, appshared.NoopEventBus{})
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

	// 上传目录与 URL 前缀：统一从配置派生，保持相对路径（搬家可移植）。
	// 绝对路径仅在进程内按需 filepath.Abs，绝不持久化、绝不硬编码。
	uploadRoot := cfg.UploadDir                     // "uploads"
	emojiDir := filepath.Join(uploadRoot, "emojis") // uploads/emojis
	chunkDir := filepath.Join(uploadRoot, "tmp")    // uploads/tmp
	urlPrefix := cfg.UploadPathPrefix               // "/uploads/"

	mediaContainer := app.NewMediaContainer(gormDB, emojiDir, chunkDir, uploadRoot, urlPrefix)
	emojiSeedService := service.NewEmojiSeedService(gormDB, emojiDir, urlPrefix, cfg.BilibiliCookie, cfg.BilibiliAPIType)

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

	cleanupJob := job.NewCleanupJob(gormDB, chunkDir, uploadRoot)
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

		// CSRF 防护（仅 state-changing 方法校验；GET/HEAD/OPTIONS 免验）
		// 与 cookie 鉴权方案配套：浏览器自动携带 cookie，必须额外校验 X-CSRF-Token
		// 防止跨站请求伪造。
		// 豁免 /auth/refresh：refresh token 走 HttpOnly Cookie，本身即为
		// proof-of-possession，无法被 CSRF 攻击盗用；且前端 cookie 写入偶发
		// 失败会导致 403 误伤自动刷新，故豁免。其他 POST 仍需双重提交校验。
		// 注意：chi 要求所有 Use() 必须在任何路由注册之前调用，故先注册中间件。
		// GET /openapi.json 经 CSRF 中间件亦免验（仅校验 state-changing 方法），符合其「无需 CSRF」意图。
		v1.Use(middleware.CSRF(cfg.Cookie, []string{"/api/v1/auth/refresh"}))

		// OpenAPI 文档端点（无需 CSRF/鉴权，仅返回结构描述，供 Apifox 导入）
		v1.Get("/openapi.json", openapi.Handler())

		// 公开站点设置
		v1.Get("/settings", settingsContainer.SettingsHandler.GetPublicSettings) // 获取公开站点配置

		// GitHub 数据（公开，Token 在后端管理）
		v1.Get("/github/contributions", githubContainer.GitHubHandler.GetContributions) // GitHub 贡献数据
		v1.Get("/github/repos", githubContainer.GitHubHandler.GetRepos)                 // GitHub 仓库数据

		// 认证
		authH := authContainer.AuthHandler
		contentH := contentContainer.ContentHandler
		v1.Route("/auth", func(r chi.Router) {
			// 公开端点：取 CSRF token（首次访问需要先调用此端点拿到 cookie 才能 login）
			r.Get("/csrf-token", authH.GetCSRFToken) // 获取 CSRF token
			// 认证类接口限流（防暴力破解与邮件轰炸）
			r.With(middleware.AuthRateLimit(redisClient)).Post("/register", authH.Register)
			r.With(middleware.AuthRateLimit(redisClient)).Post("/verify-email", authH.VerifyEmail)
			r.With(middleware.AuthRateLimit(redisClient)).Post("/login", authH.Login)
			// refresh 用独立桶（30/min）：前端并发请求自动刷新时可能短时多次调用，
			// 与防爆破的 auth 桶（5/min）隔离，避免误伤。
			r.With(middleware.RefreshRateLimit(redisClient)).Post("/refresh", authH.Refresh)
			r.With(middleware.AuthRateLimit(redisClient)).Post("/forgot-password", authH.ForgotPassword)
			r.With(middleware.AuthRateLimit(redisClient)).Post("/reset-password", authH.ResetPassword)

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
			r.Get("/", postH.ListPublished)               // 已发布文章列表（分页）
			r.Get("/archive", postH.ArchiveYears)         // 归档年份索引
			r.Get("/archive/{year}", postH.ArchiveByYear) // 指定年份归档
			r.Get("/{slug}", postH.GetBySlug)             // 按 slug 获取文章
			r.Post("/{id}/view", postH.IncrementView)     // 增加浏览次数
		})

		// 标签（DDD tagContainer）
		tagH := tagContainer.TagHandler
		v1.Route("/tags", func(r chi.Router) {
			r.Get("/", tagH.List) // 标签列表（公开）

			r.Group(func(r chi.Router) {
				r.Use(middleware.Auth(tokenValidator, middleware.WithAccessCookie(cfg.Cookie.AccessName)))
				r.Use(middleware.AdminRequired)
				r.With(middleware.RequirePermission(permissionChecker, "tag:create")).
					Post("/", tagH.Create) // 创建标签
				r.With(middleware.RequirePermission(permissionChecker, "tag:update")).
					Patch("/{id}", tagH.Update) // 编辑标签
				r.With(middleware.RequirePermission(permissionChecker, "tag:delete")).
					Delete("/{id}", tagH.Delete) // 删除标签
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
			r.Get("/", crH.GetCommentReactions)                                                          // 获取评论反应
			r.With(middleware.CommentRateLimit(redisClient)).Post("/", crH.AddReaction)                  // 添加反应（限流）
			r.With(middleware.Auth(tokenValidator, middleware.WithAccessCookie(cfg.Cookie.AccessName))). // 删除反应需认证，防匿名删除他人反应
															Delete("/{emoji_id}", crH.RemoveReaction)
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
			r.Use(middleware.UploadRateLimit(redisClient))
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

			r.Get("/settings", settingsContainer.SettingsHandler.GetSettings) // 获取站点设置
			r.With(middleware.RequirePermission(permissionChecker, "settings:update")).
				Put("/settings", settingsContainer.SettingsHandler.UpdateSettings) // 更新站点设置

			// 用户管理（DDD userAdminContainer）
			r.With(middleware.RequirePermission(permissionChecker, "user:list")).
				Get("/users", userAdminContainer.UserAdminHandler.ListUsers) // 用户列表
			r.With(middleware.RequirePermission(permissionChecker, "user:list")).
				Get("/users/{id}", userAdminContainer.UserAdminHandler.GetUserDetail) // 用户详情
			r.With(middleware.RequirePermission(permissionChecker, "user:update-role")).
				Post("/users", userAdminContainer.UserAdminHandler.CreateUser) // 创建用户
			r.With(middleware.RequirePermission(permissionChecker, "user:update-role")).
				Put("/users/{id}", userAdminContainer.UserAdminHandler.UpdateUser) // 编辑用户
			r.With(middleware.RequirePermission(permissionChecker, "user:ban")).
				Delete("/users/{id}", userAdminContainer.UserAdminHandler.DeleteUser) // 删除用户
			r.With(middleware.RequirePermission(permissionChecker, "user:update-role")).
				Patch("/users/{id}/role", userAdminContainer.UserAdminHandler.UpdateUserRole) // 修改用户角色
			r.With(middleware.RequirePermission(permissionChecker, "user:ban")).
				Patch("/users/{id}/status", userAdminContainer.UserAdminHandler.UpdateUserStatus) // 启用/禁用用户
			r.With(middleware.RequirePermission(permissionChecker, "user:ban")).
				Post("/users/batch-status", userAdminContainer.UserAdminHandler.BatchUpdateStatus) // 批量启用/禁用用户
			r.With(middleware.RequirePermission(permissionChecker, "user:update-role")).
				Post("/users/batch-role", userAdminContainer.UserAdminHandler.BatchUpdateRole) // 批量修改用户角色

			// 权限管理
			r.Get("/permissions", roleH.ListPermissions) // 获取所有权限定义

			// 权限 CRUD（仅限超级管理员）
			r.Group(func(r chi.Router) {
				r.Use(middleware.SuperAdminRequired)
				r.Post("/permissions", roleH.CreatePermission)        // 创建权限
				r.Patch("/permissions/{id}", roleH.UpdatePermission)  // 更新权限
				r.Delete("/permissions/{id}", roleH.DeletePermission) // 删除权限
			})

			// 角色管理（均需 role:manage 权限）
			r.Get("/roles", roleH.ListRoles)    // 角色列表（查看不限）
			r.Get("/roles/{id}", roleH.GetRole) // 角色详情（查看不限）
			r.With(middleware.RequirePermission(permissionChecker, "role:manage")).
				Post("/roles", roleH.CreateRole) // 创建角色
			r.With(middleware.RequirePermission(permissionChecker, "role:manage")).
				Patch("/roles/{id}", roleH.UpdateRole) // 更新角色
			r.With(middleware.RequirePermission(permissionChecker, "role:manage")).
				Delete("/roles/{id}", roleH.DeleteRole) // 删除角色
			r.With(middleware.RequirePermission(permissionChecker, "role:manage")).
				Patch("/roles/{id}/permissions", roleH.UpdateRolePermissions) // 设置角色权限

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
			r.Get("/posts", postH.ListAll)                     // 所有文章列表
			r.Get("/posts/{id}", postH.GetByID)                // 文章详情
			r.Post("/posts", postH.Create)                     // 创建文章
			r.Post("/posts/import-url", postH.ImportURL)       // 导入远程链接文档
			r.Put("/posts/{id}", postH.Update)                 // 更新文章
			r.Patch("/posts/{id}/status", postH.UpdateStatus)  // 更新文章状态
			r.Patch("/posts/{id}/featured", postH.SetFeatured) // 切换精选标记
			r.Delete("/posts/{id}", postH.Delete)              // 删除文章

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

			// 媒体素材管理（DDD mediaH，细粒度权限）
			// 全局素材列表：media:upload 或 media:delete 任一即可查看
			r.With(middleware.RequirePermission(permissionChecker, "media:upload", "media:delete")).
				Get("/media", mediaH.ListAllFiles) // 全局素材列表（不限 owner）
			r.Get("/files/instant", mediaH.CheckInstantUpload) // 秒传检查
			// 更新素材元数据：media:upload（可编辑描述/分类/重命名）
			r.With(middleware.RequirePermission(permissionChecker, "media:upload")).
				Patch("/media/{id}", mediaH.UpdateFileMetadata) // 更新素材元数据
			// 删除素材：media:delete
			r.With(middleware.RequirePermission(permissionChecker, "media:delete")).
				Delete("/media/{id}", mediaH.DeleteFile) // 删除素材
			r.With(middleware.RequirePermission(permissionChecker, "media:delete")).
				Delete("/files/{id}", mediaH.DeleteFile) // 删除文件（兼容旧入口）
		})
	})

	// ============================================================
	// ============================================================

	// 图片服务（替换裸 FileServer）：支持动态 resize/转码 + 二级缓存 + ETag/304
	imageContainer := app.NewImageContainer(uploadRoot)
	r.Get(urlPrefix+"*", imageContainer.ImageHandler.ServeImage)

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Info().Str("addr", addr).Msg("博客 API 服务启动")
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal().Err(err).Msg("服务启动失败")
	}
}
