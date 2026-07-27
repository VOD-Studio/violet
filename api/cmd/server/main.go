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
	"time"

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
	infraauth "blog-api/internal/infrastructure/auth"
	infraemail "blog-api/internal/infrastructure/email"
	infraemoji "blog-api/internal/infrastructure/emoji"
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
		&newmodel.Post{}, &newmodel.PostVersion{}, &newmodel.PostView{}, &newmodel.Tag{},
		&newmodel.Comment{}, &newmodel.CommentReaction{},
		&newmodel.Announcement{}, &newmodel.Project{},
		&newmodel.EmojiGroup{}, &newmodel.Emoji{}, &newmodel.Playlist{},
		&newmodel.MusicSetting{},
		&newmodel.File{}, &newmodel.UploadSession{},
		&newmodel.APIToken{},
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
	settingsContainer := app.NewSettingsContainer(gormDB)

	authContainer, err := app.NewAuthContainer(gormDB, redisClient, cfg, emailSender, appshared.NoopEventBus{}, settingsContainer.Service)
	if err != nil {
		log.Fatal().Err(err).Msg("DDD auth 容器初始化失败")
	}

	// session 鉴权中间件依赖：RedisSessionStore 同时实现 SessionStore 与 SessionLookup。
	// main.go 挂载 SessionAuth/OptionalSessionAuth/SessionAuthReadOnly 时复用同一实例。
	sessionLookup := authContainer.SessionStore

	contentContainer := app.NewContentContainer(gormDB)

	commentCodeStore := infraauth.NewRedisCodeStore(redisClient)
	commentContainer := app.NewCommentContainer(gormDB, commentCodeStore, emailSender)

	postContainer := app.NewPostContainer(gormDB, permissionChecker, settingsContainer.Store)
	tagContainer := app.NewTagContainer(gormDB)
	githubContainer := app.NewGitHubContainer(settingsContainer.Store)
	auditContainer := app.NewAuditContainer(gormDB)
	statsContainer := app.NewStatsContainer(gormDB)
	userAdminContainer := app.NewUserAdminContainer(gormDB, authcmd.NewBcryptHasher(), auditContainer.Service)
	commentReactionContainer := app.NewCommentReactionContainer(gormDB)
	apiTokenContainer := app.NewAPITokenContainer(gormDB)
	// MCP 服务器：PAT 鉴权已在内层 handler 经由 auth.RequireBearerToken 完成；
	// postSvc 复用文章模块，tokenLookup 复用 PAT 模块仓储。
	mcpContainer := app.NewMCPContainer(apiTokenContainer.TokenLookup, postContainer.PostService)

	// 服务器监控模块（DDD）：启动 30s 采样 goroutine，随 appCtx 退出
	systemContainer := app.NewSystemContainer(gormDB, redisClient, ctx)

	// 上传目录与 URL 前缀：统一从配置派生，保持相对路径（搬家可移植）。
	// 绝对路径仅在进程内按需 filepath.Abs，绝不持久化、绝不硬编码。
	uploadRoot := cfg.UploadDir                     // "uploads"
	emojiDir := filepath.Join(uploadRoot, "emojis") // uploads/emojis
	chunkDir := filepath.Join(uploadRoot, "tmp")    // uploads/tmp
	urlPrefix := cfg.UploadPathPrefix               // "/uploads/"

	emojiRepo := gormrepo.NewEmojiGroupRepository(gormDB)
	emojiSeedService := service.NewEmojiSeedService(emojiRepo, emojiDir, urlPrefix, cfg.BilibiliCookie, cfg.BilibiliAPIType)
	refetchStatusStore := infraemoji.NewRefetchStatusStore(redisClient)
	mediaContainer := app.NewMediaContainer(gormDB, emojiDir, chunkDir, uploadRoot, urlPrefix, cfg.KiteURL, emojiSeedService, refetchStatusStore)

	// 代码运行器（可运行代码块沙箱执行）：始终连 docker.sock 起隔离容器执行用户代码。
	// enabled 开关与资源阈值走 site_settings（运行时可改），settingsStore 注入 service 实时读取。
	codeRunnerContainer := app.NewCodeRunnerContainer(redisClient, settingsContainer.Store, cfg.CodeRunner)

	// 表情种子数据初始化（幂等，后台执行）：首次启动执行完整导入，
	// 后续启动仅回填 bilibili 分组缺失的封面 URL。不阻塞 HTTP 服务启动。
	go func() {
		log.Info().Msg("开始执行 B站表情种子数据初始化（幂等，后台）...")
		if err := emojiSeedService.SeedBilibiliEmojis(ctx); err != nil {
			log.Error().Err(err).Msg("表情种子数据初始化失败（不影响服务运行）")
		}
	}()

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
		// opaque session 模型下无 refresh 端点，CSRF 保护所有写操作，无显式豁免。
		// 注意：chi 要求所有 Use() 必须在任何路由注册之前调用，故先注册中间件。
		v1.Use(middleware.CSRF(cfg.Cookie, nil))

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
			r.With(middleware.AuthRateLimit(redisClient)).Post("/google", authH.GoogleLogin)
			r.With(middleware.AuthRateLimit(redisClient)).Post("/github", authH.GithubLogin)
			r.With(middleware.AuthRateLimit(redisClient)).Post("/forgot-password", authH.ForgotPassword)
			r.With(middleware.AuthRateLimit(redisClient)).Post("/reset-password", authH.ResetPassword)

			// SSR 探活端点：只读校验当前 session，不续期、不写 cookie（命门不变量①）
			r.With(middleware.SessionAuthReadOnly(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL)).
				Get("/session", authH.Session)

			r.Group(func(r chi.Router) {
				r.Use(middleware.SessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL))
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
				r.Use(middleware.SessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL))
				r.Use(middleware.AdminRequired(permissionChecker))
				r.With(middleware.RequirePermission(permissionChecker, "tag:create")).
					Post("/", tagH.Create) // 创建标签
				r.With(middleware.RequirePermission(permissionChecker, "tag:update")).
					Patch("/{id}", tagH.Update) // 编辑标签
				r.With(middleware.RequirePermission(permissionChecker, "tag:delete")).
					Delete("/{id}", tagH.Delete) // 删除标签
			})
		})

		// 评论（DDD commentH；评论反应 DDD commentReactionContainer）
		// OptionalAuth：登录用户从 cookie 解析身份注入 ctx，匿名放行。
		// GET 需要它做黑洞模式判定（登录 vs 匿名 viewer）；
		// POST 需要它做双轨认证（登录直发 vs 匿名验证码两步流）。
		commentH := commentContainer.CommentHandler
		v1.Route("/posts/{postId}/comments", func(r chi.Router) {
			r.With(middleware.OptionalSessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL)).
				Get("/", commentH.ListByPost) // 获取文章评论（登录看 approved∪自己pending；匿名黑洞返回空）
			r.With(
				middleware.OptionalSessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL),
				middleware.CommentRateLimit(redisClient),
			).Post("/", commentH.Create) // 提交评论（双轨认证，限流）
			r.With(middleware.CommentCodeRateLimit(redisClient)).Post("/code", commentH.SendCode) // 匿名评论发送邮箱验证码（独立限流防邮件轰炸）
		})

		// 评论回复列表（DDD commentH，公开 + OptionalSessionAuth）
		// 配合顶层评论列表的「按需拉回复」分页策略：前端点「查看全部 xx 条回复」走此接口。
		v1.With(middleware.OptionalSessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL)).
			Get("/comments/{commentId}/replies", commentH.ListReplies)

		// 批注按块聚合统计（轻量端点，不含正文/回复）
		v1.With(middleware.OptionalSessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL)).
			Get("/posts/{postId}/annotations/summary", commentH.AnnotationSummary)

		// 评论反应（DDD commentReactionContainer）
		crH := commentReactionContainer.CommentReactionHandler
		v1.Route("/comments/{comment_id}/reactions", func(r chi.Router) {
			r.With(middleware.OptionalSessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL)).
				Get("/", crH.GetCommentReactions) // 获取评论反应（需软鉴权以识别 self）
			r.With(middleware.SessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL)).
				With(middleware.CommentRateLimit(redisClient)).
				Post("/", crH.AddReaction) // 添加反应需登录（限流）
			r.With(middleware.SessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL)). // 删除反应需认证，防匿名删除他人反应
													Delete("/{emoji_id}", crH.RemoveReaction)
		})
		v1.With(middleware.OptionalSessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL)).
			Post("/comments/reactions/batch", crH.GetReactionsBatch) // 批量获取评论反应（需软鉴权以识别 self）
		// 评论审核/删除（DDD commentH，admin 权限）
		v1.Route("/comments/{id}", func(r chi.Router) {
			r.Group(func(r chi.Router) {
				r.Use(middleware.SessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL))
				r.Use(middleware.AdminRequired(permissionChecker))
				r.Patch("/approve", commentH.Approve) // 审核通过
				r.Patch("/spam", commentH.MarkSpam)   // 标记垃圾
				r.Delete("/", commentH.Delete)        // 删除评论
			})
		})

		// 媒体（DDD mediaH）
		v1.Route("/media", func(r chi.Router) {
			r.Get("/{id}", mediaH.GetMedia) // 获取媒体详情（公开）

			r.Group(func(r chi.Router) {
				r.Use(middleware.SessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL))
				r.Get("/", mediaH.ListFiles)                     // 媒体列表（分页、用途筛选）
				r.Delete("/{id}", mediaH.DeleteFile)             // 删除媒体
				r.Post("/batch-delete", mediaH.BatchDeleteMedia) // 批量删除媒体
			})
		})

		// 上传（DDD mediaH）—— 统一入口，分片协议 / 整体上传 / 秒传检查
		// 收敛原 /upload/*、/media/{id}/thumbnail、/admin/emojis/upload、/admin/files/instant
		// 鉴权统一为登录即可（与上传语义一致），并叠加 UploadRateLimit。
		v1.Route("/uploads", func(r chi.Router) {
			r.Use(middleware.SessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL))
			r.Use(middleware.UploadRateLimit(redisClient))
			r.Post("/", mediaH.InitUploadSession)                       // 初始化上传会话（秒传/续传/新建）
			r.Put("/{uploadId}/chunks/{index}", mediaH.SaveUploadChunk) // 上传单个分片
			r.Post("/{uploadId}/complete", mediaH.CompleteUpload)       // 合并所有分片
			r.Delete("/{uploadId}", mediaH.CancelUpload)                // 取消上传
			r.Get("/{uploadId}", mediaH.GetUploadStatus)                // 查询上传状态（断点续传）
			r.Post("/thumbnail", mediaH.UploadThumbnail)                // 上传缩略图（fileId 经 multipart 字段）
			r.Post("/replace", mediaH.ReplaceMediaFile)                 // 覆盖素材原图（fileId 经 multipart 字段，仅 owner）
			r.Post("/emoji", mediaH.UploadEmoji)                        // 上传表情图片（返回 URL，非创建 emoji 记录）
			r.Get("/instant", mediaH.CheckInstantUpload)                // 秒传检查（?hash=）
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

		// 代码运行器（可运行代码块）：登录用户可执行，按 IP 限流防容器资源耗尽。
		// SSE 消费端点用 GET（EventSource 限制 + 绕过 CSRF）；提交执行用 POST。
		codeRunnerH := codeRunnerContainer.CodeRunnerHandler
		v1.Route("/code-runner", func(r chi.Router) {
			r.Use(middleware.SessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL))
			// 轮询路径：提交拿 task_id，轮询查结果
			r.With(middleware.CodeRunnerRateLimit(redisClient)).Post("/run", codeRunnerH.Run)
			r.Get("/tasks/{id}", codeRunnerH.GetTask)
			// 流式路径：POST 提交拿 task_id，GET SSE 消费（GET 路径不在 CSRF 校验范围）
			r.With(middleware.CodeRunnerRateLimit(redisClient)).Post("/run/stream", codeRunnerH.RunStream)
			r.Get("/stream", codeRunnerH.Stream)
		})

		// 公告
		v1.Get("/announcements", contentH.ListActiveAnnouncements)    // 获取生效公告列表
		v1.Get("/announcements/{id}", contentH.GetActiveAnnouncement) // 获取单个生效公告(article 详情页)

		// =====================================================
		// 管理员路由（认证 + 管理员权限）
		// =====================================================
		v1.Route("/admin", func(r chi.Router) {
			r.Use(middleware.SessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL))
			r.Use(middleware.AdminRequired(permissionChecker))

			roleH := roleContainer.RoleHandler

			r.Get("/stats", statsContainer.StatsHandler.GetDashboardStats)   // 仪表盘总览统计
			r.Get("/stats/views", statsContainer.StatsHandler.GetViewTrends) // 浏览量趋势

			r.With(middleware.RequirePermission(permissionChecker, "settings:view")).
				Get("/settings", settingsContainer.SettingsHandler.GetSettings) // 获取站点设置
			r.With(middleware.RequirePermission(permissionChecker, "settings:update")).
				Put("/settings", settingsContainer.SettingsHandler.UpdateSettings) // 更新站点设置

			// 用户管理（DDD userAdminContainer）
			r.With(middleware.RequirePermission(permissionChecker, "user:view")).
				Get("/users", userAdminContainer.UserAdminHandler.ListUsers) // 用户列表
			r.With(middleware.RequirePermission(permissionChecker, "user:view")).
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

			// 角色管理（读 role:view；写 role:manage）
			r.With(middleware.RequirePermission(permissionChecker, "role:view")).
				Get("/roles", roleH.ListRoles)    // 角色列表
			r.With(middleware.RequirePermission(permissionChecker, "role:view")).
				Get("/roles/{id}", roleH.GetRole) // 角色详情
			r.With(middleware.RequirePermission(permissionChecker, "role:manage")).
				Post("/roles", roleH.CreateRole) // 创建角色
			r.With(middleware.RequirePermission(permissionChecker, "role:manage")).
				Patch("/roles/{id}", roleH.UpdateRole) // 更新角色
			r.With(middleware.RequirePermission(permissionChecker, "role:manage")).
				Delete("/roles/{id}", roleH.DeleteRole) // 删除角色
			r.With(middleware.RequirePermission(permissionChecker, "role:manage")).
				Patch("/roles/{id}/permissions", roleH.UpdateRolePermissions) // 设置角色权限

			// 操作日志（含 IP/操作明细，需 log:view）
			r.With(middleware.RequirePermission(permissionChecker, "log:view")).
				Get("/logs", auditContainer.AuditHandler.ListLogs) // 操作日志列表
			r.With(middleware.RequirePermission(permissionChecker, "log:view")).
				Get("/logs/user/{id}", auditContainer.AuditHandler.ListLogsByUser) // 用户操作日志

			// 公告管理（读 announcement:view；写 announcement:manage）
			r.With(middleware.RequirePermission(permissionChecker, "announcement:view")).
				Get("/announcements", contentH.ListAnnouncements) // 公告列表
			r.With(middleware.RequirePermission(permissionChecker, "announcement:view")).
				Get("/announcements/{id}", contentH.GetAnnouncement) // 公告详情
			r.With(middleware.RequirePermission(permissionChecker, "announcement:manage")).
				Post("/announcements", contentH.CreateAnnouncement) // 创建公告
			r.With(middleware.RequirePermission(permissionChecker, "announcement:manage")).
				Patch("/announcements/{id}", contentH.UpdateAnnouncement) // 更新公告
			r.With(middleware.RequirePermission(permissionChecker, "announcement:manage")).
				Delete("/announcements/{id}", contentH.DeleteAnnouncement) // 删除公告

			// MCP 访问令牌管理（PAT；读/写需 mcp:manage-tokens）
			r.With(middleware.RequirePermission(permissionChecker, "mcp:manage-tokens")).
				Get("/api-tokens", apiTokenContainer.APITokenHandler.List)   // 列出当前用户 PAT
			r.With(middleware.RequirePermission(permissionChecker, "mcp:manage-tokens")).
				Post("/api-tokens", apiTokenContainer.APITokenHandler.Create) // 创建 PAT（返回明文一次性）
			r.With(middleware.RequirePermission(permissionChecker, "mcp:manage-tokens")).
				Delete("/api-tokens/{id}", apiTokenContainer.APITokenHandler.Delete) // 吊销 PAT

			// 评论审核（读 comment:view；批量状态 comment:approve）
			r.With(middleware.RequirePermission(permissionChecker, "comment:view")).
				Get("/comments/pending", commentH.ListPending) // 待审核评论列表
			r.With(middleware.RequirePermission(permissionChecker, "comment:view")).
				Get("/comments/pending/count", commentH.CountPending) // 待审核评论数量
			r.With(middleware.RequirePermission(permissionChecker, "comment:view")).
				Get("/comments", commentH.ListAll) // 所有评论列表（支持状态筛选）
			r.With(middleware.RequirePermission(permissionChecker, "comment:view")).
				Get("/comments/{id}", commentH.GetDetail) // 评论详情
			r.With(middleware.RequirePermission(permissionChecker, "comment:approve")).
				Patch("/comments/batch-status", commentH.BatchUpdateStatus) // 批量更新评论状态

			// 文章管理（DDD postH）
			// 读：post:view；写：权限下放应用层（所有权 + 权限码判定）
			r.With(middleware.RequirePermission(permissionChecker, "post:view")).
				Get("/posts", postH.ListAll) // 所有文章列表
			r.With(middleware.RequirePermission(permissionChecker, "post:view")).
				Get("/posts/{id}", postH.GetByID) // 文章详情
			r.With(middleware.RequirePermission(permissionChecker, "post:create")).
				Post("/posts", postH.Create) // 创建文章
			r.With(middleware.RequirePermission(permissionChecker, "post:create")).
				Post("/posts/import-url", postH.ImportURL) // 导入远程链接文档
			r.With(middleware.RequirePermission(permissionChecker, "post:create")).
				Post("/posts/slugify", postH.Slugify) // 根据标题生成 slug(中文转拼音)
			r.Put("/posts/{id}", postH.Update)                  // 更新文章（应用层鉴权）
			r.Patch("/posts/{id}/status", postH.UpdateStatus)   // 更新文章状态（应用层鉴权）
			r.Patch("/posts/{id}/featured", postH.SetFeatured)  // 切换精选标记（应用层鉴权）
			r.Delete("/posts/{id}", postH.Delete)               // 软删除文章（应用层鉴权）
			r.Post("/posts/{id}/restore", postH.Restore)        // 恢复文章（应用层鉴权）
			r.Delete("/posts/{id}/hard", postH.HardDelete)      // 彻底删除文章（应用层鉴权）

			// 文章版本管理
			r.With(middleware.RequirePermission(permissionChecker, "post:view")).
				Get("/posts/{id}/versions", postH.ListVersions)
			r.With(middleware.RequirePermission(permissionChecker, "post:view")).
				Get("/posts/versions/{versionId}", postH.GetVersion)
			r.Post("/posts/{id}/versions/{versionId}/restore", postH.RestoreVersion) // 应用层鉴权

			// 音乐管理（DDD mediaH）
			// 读：playlist:view；写：按动作细分
			r.Route("/music", func(r chi.Router) {
				r.Route("/playlists", func(r chi.Router) {
					r.With(middleware.RequirePermission(permissionChecker, "playlist:view")).
						Get("/", mediaH.ListAllPlaylists) // 歌单列表
					r.With(middleware.RequirePermission(permissionChecker, "playlist:create")).
						Post("/", mediaH.CreatePlaylist) // 导入歌单
					r.With(middleware.RequirePermission(permissionChecker, "playlist:create")).
						Post("/custom", mediaH.CreateCustomPlaylist) // 创建自定义歌单
					r.With(middleware.RequirePermission(permissionChecker, "playlist:view")).
						Get("/{id}", mediaH.GetPlaylistDetail) // 歌单详情
					r.With(middleware.RequirePermission(permissionChecker, "playlist:update")).
						Patch("/{id}", mediaH.UpdatePlaylist) // 更新歌单
					r.With(middleware.RequirePermission(permissionChecker, "playlist:delete")).
						Delete("/{id}", mediaH.DeletePlaylist) // 删除歌单
					r.With(middleware.RequirePermission(permissionChecker, "playlist:toggle")).
						Patch("/{id}/active", mediaH.SetPlaylistActive) // 启用/禁用歌单
					r.With(middleware.RequirePermission(permissionChecker, "playlist:update")).
						Post("/{id}/refresh", mediaH.RefreshPlaylist) // 刷新歌单歌曲
					// 歌曲增删改仅超管（普通管理员只管歌单本身，不管歌曲）
					r.Group(func(r chi.Router) {
						r.Use(middleware.SuperAdminRequired)
						r.Post("/{id}/songs", mediaH.AddSongToPlaylist)                // 添加歌曲到歌单
						r.Delete("/{id}/songs/{index}", mediaH.RemoveSongFromPlaylist) // 移除歌曲
						r.Patch("/{id}/songs/{index}", mediaH.UpdateSongInPlaylist)    // 更新歌曲
					})
				})
				r.With(middleware.RequirePermission(permissionChecker, "playlist:update")).
					Patch("/settings", mediaH.UpdatePlayerVersion) // 更新播放器设置
			})

			// 表情管理（DDD mediaH）
			// 读：emoji:view；分组管理 emoji:manage-group；建/改表情 emoji:create；删表情 emoji:delete
			r.Route("/emojis", func(r chi.Router) {
				// 分组管理
				r.With(middleware.RequirePermission(permissionChecker, "emoji:view")).
					Get("/groups", mediaH.ListAllEmojiGroups) // 所有分组（含未启用）
				r.With(middleware.RequirePermission(permissionChecker, "emoji:manage-group")).
					Post("/groups", mediaH.CreateEmojiGroup) // 创建分组
				r.With(middleware.RequirePermission(permissionChecker, "emoji:manage-group")).
					Patch("/groups/batch-status", mediaH.BatchUpdateEmojiGroupStatus) // 批量启用/禁用分组
				r.With(middleware.RequirePermission(permissionChecker, "emoji:manage-group")).
					Patch("/groups/{id}", mediaH.UpdateEmojiGroup) // 更新分组
				r.With(middleware.RequirePermission(permissionChecker, "emoji:manage-group")).
					Delete("/groups/{id}", mediaH.DeleteEmojiGroup) // 删除分组
				// 分组内表情
				r.With(middleware.RequirePermission(permissionChecker, "emoji:view")).
					Get("/groups/{id}/emojis", mediaH.ListGroupEmojis) // 分组内表情列表
				r.With(middleware.RequirePermission(permissionChecker, "emoji:create")).
					Post("/groups/{id}/emojis", mediaH.CreateEmoji) // 在分组内创建表情
				// 单个表情（注意 {id} 必须在 groups 之后，避免与 groups/{id} 冲突）
				r.With(middleware.RequirePermission(permissionChecker, "emoji:create")).
					Patch("/{id}", mediaH.UpdateEmoji) // 更新表情
				r.With(middleware.RequirePermission(permissionChecker, "emoji:delete")).
					Delete("/{id}", mediaH.DeleteEmoji) // 删除表情
				// B站表情重新拉取（需 emoji:refetch 权限）
				r.With(middleware.RequirePermission(permissionChecker, "emoji:refetch")).
					Post("/bilibili/refetch", mediaH.RefetchBilibiliEmojis)
				r.With(middleware.RequirePermission(permissionChecker, "emoji:refetch")).
					Get("/bilibili/refetch/status", mediaH.GetRefetchStatus)
				r.With(middleware.RequirePermission(permissionChecker, "emoji:refetch")).
					Get("/bilibili/cookie", mediaH.GetBilibiliCookie)
				// 表情图片上传已收敛到前台 POST /uploads/emoji
			})

			r.Route("/projects", func(r chi.Router) {
				r.With(middleware.RequirePermission(permissionChecker, "project:create")).
					Post("/", contentH.CreateProject) // 创建项目
				r.With(middleware.RequirePermission(permissionChecker, "project:update")).
					Put("/{id}", contentH.UpdateProject) // 更新项目
				r.With(middleware.RequirePermission(permissionChecker, "project:delete")).
					Delete("/{id}", contentH.DeleteProject) // 删除项目
			})

			// 媒体素材管理（DDD mediaH，细粒度权限）
			// 全局素材列表：media:view
			r.With(middleware.RequirePermission(permissionChecker, "media:view")).
				Get("/media", mediaH.ListAllFiles) // 全局素材列表（不限 owner）
			// 更新素材元数据：media:upload（可编辑描述/分类/重命名）
			r.With(middleware.RequirePermission(permissionChecker, "media:upload")).
				Patch("/media/{id}", mediaH.UpdateFileMetadata) // 更新素材元数据
			// 删除素材：media:delete
			r.With(middleware.RequirePermission(permissionChecker, "media:delete")).
				Delete("/media/{id}", mediaH.DeleteFile) // 删除素材

			// 服务器监控（admin-only，需 system:view 查看主机/磁盘/运行时指标）
			r.Route("/system", func(r chi.Router) {
				r.With(middleware.RequirePermission(permissionChecker, "system:view")).
					Get("/snapshot", systemContainer.SystemHandler.GetSnapshot) // 实时快照
				r.With(middleware.RequirePermission(permissionChecker, "system:view")).
					Get("/history", systemContainer.SystemHandler.GetHistory) // 历史趋势
			})
		})
	})

	// MCP 端点（挂在顶层 r，不在 v1 组内）：
	// 继承 r 的 Recoverer/RequestID/Logger/CORS/SecurityHeaders，
	// 绕过 v1 组的 CSRF（MCP 是 JSON-RPC、无 X-CSRF-Token）与 SessionAuth（用 PAT）。
	// PAT 鉴权已在 handler 内（auth.RequireBearerToken），此处仅叠加独立限流。
	r.With(middleware.RateLimit("mcp", redisClient, time.Minute, 60)).
		Handle("/api/v1/mcp", mcpContainer.Handler)

	// ============================================================
	// ============================================================

	// 图片服务（替换裸 FileServer）：支持动态 resize/转码 + 二级缓存 + ETag/304
	imageContainer := app.NewImageContainer(uploadRoot, urlPrefix)
	r.Get(urlPrefix+"*", imageContainer.ImageHandler.ServeImage)

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Info().Str("addr", addr).Msg("博客 API 服务启动")
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal().Err(err).Msg("服务启动失败")
	}
}
