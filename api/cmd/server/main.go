// Package main 博客 API 服务主程序入口
// 初始化数据库、Redis、服务层和路由，启动 HTTP 服务器
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"blog-api/config"
	"blog-api/internal/app"
	authcmd "blog-api/internal/application/auth/command"
	appshared "blog-api/internal/application/shared"
	infraauth "blog-api/internal/infrastructure/auth"
	infraemail "blog-api/internal/infrastructure/email"
	infraemoji "blog-api/internal/infrastructure/emoji"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	"blog-api/internal/job"
	"blog-api/internal/middleware"
	"blog-api/internal/service"
)

func main() {
	ctx := context.Background()
	// config.Load 内部完成根 .env 加载与来源打印,启动日志可见每个配置项的来源
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

	// --- 基础设施初始化（DB/Redis/GORM + 迁移 + AutoMigrate）---
	infra, infraCleanup := app.InitInfra(ctx, cfg)
	defer infraCleanup()
	gormDB := infra.Gorm
	redisClient := infra.Redis

	roleContainer, roleCleanup, err := app.InitializeRoleContainer(gormDB)
	if err != nil {
		log.Fatal().Err(err).Msg("DDD role 容器初始化失败")
	}
	defer roleCleanup()

	// --- 服务层初始化 ---

	// 邮件发送：devMode 下打印验证码明文到日志，方便开发期联调（无需配置 Resend）。
	emailSender := infraemail.NewSender(cfg.ResendAPIKey, cfg.EmailFrom, cfg.Environment != "production")

	// 权限检查器：由 RoleContainer 装配（wire 单例总线 + 事件订阅），
	// superadmin 通配放行，其他角色按 role_permissions 表判断（带 5min 内存缓存）。
	// 角色权限变更经 RolePermissionsChanged 事件即时清缓存，不再等 TTL 过期。
	permissionChecker := roleContainer.PermissionChecker

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
	releasesContainer := app.NewReleasesContainer(settingsContainer.Store, redisClient)
	auditContainer := app.NewAuditContainer(gormDB)
	statsContainer := app.NewStatsContainer(gormDB)
	userAdminContainer := app.NewUserAdminContainer(gormDB, authcmd.NewBcryptHasher(), auditContainer.Service)
	commentReactionContainer := app.NewCommentReactionContainer(gormDB)
	apiTokenContainer := app.NewAPITokenContainer(gormDB)
	subscriptionContainer := app.NewSubscriptionContainer(gormDB, postContainer.PostService)
	// MCP 服务器：PAT 鉴权已在内层 handler 经由 auth.RequireBearerToken 完成；
	// postSvc 复用文章模块，tokenLookup 复用 PAT 模块仓储，subSvc 复用订阅模块。
	mcpContainer := app.NewMCPContainer(apiTokenContainer.TokenLookup, postContainer.PostService, subscriptionContainer.SubscriptionService, commentContainer.CommentService)

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

	// 订阅定时抓取调度器（T8）：与 cleanupJob 并列，30 分钟轮询 due 订阅，
	// 有界并行 worker pool 抓取，失败按 Miniflux 共识分类处理
	subscriptionJob := job.NewSubscriptionJob(
		subscriptionContainer.SubscriptionService,
		subscriptionContainer.SubscriptionRepository,
		nil, 0, 0, // now/worker/tick 用默认（time.Now / 5 / 30min）
	)
	go subscriptionJob.Start(ctx)

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

	app.RegisterRoutes(r, &app.Deps{
		Cfg:               cfg,
		Redis:             redisClient,
		PermissionChecker: permissionChecker,
		SessionAuth:           middleware.SessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL),
		OptionalAuth:          middleware.OptionalSessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL),
		SessionAuthReadOnlyMW: middleware.SessionAuthReadOnly(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL),
		Role:              roleContainer,
		Settings:          settingsContainer,
		Stats:             statsContainer,
		GitHub:            githubContainer,
		Releases:          releasesContainer,
		Auth:              authContainer,
		Content:           contentContainer,
		Comment:           commentContainer,
		CommentReaction:   commentReactionContainer,
		Media:             mediaContainer,
		Post:              postContainer,
		Tag:               tagContainer,
		Audit:             auditContainer,
		UserAdmin:         userAdminContainer,
		APIToken:          apiTokenContainer,
		Subscription:      subscriptionContainer,
		MCP:               mcpContainer,
		CodeRunner:        codeRunnerContainer,
		System:            systemContainer,
	})

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Info().Str("addr", addr).Msg("博客 API 服务启动")
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal().Err(err).Msg("服务启动失败")
	}
}
