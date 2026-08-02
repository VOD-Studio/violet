// Package main 博客 API 服务主程序入口
// 初始化数据库、Redis、服务层和路由，启动 HTTP 服务器
package main

import (
	"context"
	"fmt"
	"github.com/go-chi/chi/v5"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"blog-api/config"
	"blog-api/internal/app"
	authcmd "blog-api/internal/application/auth/command"
	"blog-api/internal/interfaces/http/routing"
	"blog-api/internal/job"
	"blog-api/internal/middleware"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
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

	// --- 模块容器装配（composition root: 聚合全部 DDD 模块 + 跨模块依赖）---
	container, containerCleanup, err := app.NewContainer(ctx, infra, cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("模块容器初始化失败")
	}
	defer containerCleanup()

	// session 鉴权中间件依赖：RedisSessionStore 同时实现 SessionStore 与 SessionLookup。
	// main.go 挂载 SessionAuth/OptionalSessionAuth/SessionAuthReadOnly 时复用同一实例。
	sessionLookup := container.Auth.SessionStore

	// 上传目录：仅供 cleanupJob 使用；media_container / image 服务从 cfg 自行派生。
	uploadRoot := cfg.UploadDir
	chunkDir := filepath.Join(uploadRoot, "tmp")

	// 表情种子数据初始化（幂等，后台执行）：首次启动执行完整导入，
	// 后续启动仅回填 bilibili 分组缺失的封面 URL。不阻塞 HTTP 服务启动。
	go func() {
		log.Info().Msg("开始执行 B站表情种子数据初始化（幂等，后台）...")
		if err := container.Media.EmojiSeedService.SeedBilibiliEmojis(ctx); err != nil {
			log.Error().Err(err).Msg("表情种子数据初始化失败（不影响服务运行）")
		}
	}()

	cleanupJob := job.NewCleanupJob(gormDB, chunkDir, uploadRoot)
	go cleanupJob.Start(ctx)

	// 订阅定时抓取调度器（T8）：与 cleanupJob 并列，30 分钟轮询 due 订阅，
	// 有界并行 worker pool 抓取，失败按 Miniflux 共识分类处理
	subscriptionJob := job.NewSubscriptionJob(
		container.Subscription.SubscriptionService,
		container.Subscription.SubscriptionRepository,
		nil, 0, 0, // now/worker/tick 用默认（time.Now / 5 / 30min）
	)
	go subscriptionJob.Start(ctx)

	// --- 超级管理员初始化---
	if cfg.SuperAdmin.Enabled {
		if err := container.Auth.EnsureSuperAdmin.Handle(ctx, authcmd.EnsureSuperAdminInput{
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

	routing.RegisterRoutes(r, &routing.Deps{
		Cfg:                   cfg,
		Redis:                 redisClient,
		PermissionChecker:     container.Role.PermissionChecker,
		SessionAuth:           middleware.SessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL),
		OptionalAuth:          middleware.OptionalSessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL),
		SessionAuthReadOnlyMW: middleware.SessionAuthReadOnly(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL),
		Role:                  container.Role.RoleHandler,
		Settings:              container.Settings.SettingsHandler,
		Stats:                 container.Stats.StatsHandler,
		GitHub:                container.GitHub.GitHubHandler,
		Releases:              container.Releases.ReleasesHandler,
		Auth:                  container.Auth.AuthHandler,
		Content:               container.Content.ContentHandler,
		Comment:               container.Comment.CommentHandler,
		CommentReaction:       container.CommentReaction.CommentReactionHandler,
		Media:                 container.Media.MediaHandler,
		Post:                  container.Post.PostHandler,
		Tag:                   container.Tag.TagHandler,
		Audit:                 container.Audit.AuditHandler,
		UserAdmin:             container.UserAdmin.UserAdminHandler,
		APIToken:              container.APIToken.APITokenHandler,
		Subscription:          container.Subscription.SubscriptionHandler,
		CodeRunner:            container.CodeRunner.CodeRunnerHandler,
		System:                container.System.SystemHandler,
		Image:                 container.Image.ImageHandler,
		MCP: routing.MCPHandlers{
			Post:     container.MCP.PostHandler,
			Scraper:  container.MCP.ScraperHandler,
			Public:   container.MCP.PublicHandler,
			Comments: container.MCP.CommentsHandler,
		},
	})

	addr := fmt.Sprintf(":%s", cfg.Port)
	srv := &http.Server{Addr: addr, Handler: r}

	go func() {
		log.Info().Str("addr", addr).Msg("博客 API 服务启动")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("服务启动失败")
		}
	}()

	<-ctx.Done()
	log.Info().Msg("收到退出信号，开始优雅关闭")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("HTTP 优雅关闭失败")
	}
	stop()
	log.Info().Msg("服务已关闭")
}
