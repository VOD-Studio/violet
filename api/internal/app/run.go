// Package app 应用启动入口：吃下 infra→container→jobs→seed→routing→server→shutdown 全链路。
//
// 由 cmd/server/main.go 调用，使 main 回归纯启动入口（配置 + 日志 + 信号 + app.Run）。
package app

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	"blog-api/config"
	"blog-api/internal/interfaces/http/routing"
	"blog-api/internal/job"
	"blog-api/internal/middleware"
)

// Run 启动并运行 API 服务，直到 ctx 取消（信号）后执行 graceful shutdown 后返回。
//
// 完整流程：InitInfra → NewContainer → 启动后台 job（emoji seed / cleanup / subscription）
// → EnsureSuperAdmin → 挂全局中间件 → 注册路由 → 启 HTTP server → 阻塞 → 收到信号 → 优雅关闭。
//
// 日志初始化、config 加载、信号 context 仍由 main 负责（main.go 极薄入口）。
func Run(ctx context.Context, cfg *config.Config) error {
	// --- 基础设施 ---
	infra, infraCleanup := InitInfra(ctx, cfg)
	defer infraCleanup()

	// --- 模块容器（composition root） ---
	container, containerCleanup, err := NewContainer(ctx, infra, cfg)
	if err != nil {
		return fmt.Errorf("模块容器初始化失败: %w", err)
	}
	defer containerCleanup()

	// --- 后台任务 ---
	startJobs(ctx, container, infra.Gorm, cfg.UploadDir)

	// --- 超级管理员种子 ---
	// 返回 error 而非 log.Fatal：Fatal 调 os.Exit 会跳过上方 defer cleanup，
	// 导致 DB/Redis 连接泄漏。error 上抛给 main，由 main 在 cleanup 全部执行后退出。
	if cfg.SuperAdmin.Enabled {
		if err := container.Auth.SeedSuperAdmin(ctx, cfg.SuperAdmin); err != nil {
			return fmt.Errorf("超级管理员初始化失败: %w", err)
		}
	}

	// --- 路由 + HTTP server ---
	return serveHTTP(ctx, cfg, infra.Redis, container)
}

// startJobs 启动三类后台任务（emoji 种子幂等导入 + 上传清理 + 订阅抓取调度）。
func startJobs(ctx context.Context, c *Container, gormDB *gorm.DB, uploadRoot string) {
	chunkDir := filepath.Join(uploadRoot, "tmp")

	go func() {
		log.Info().Msg("开始执行 B站表情种子数据初始化（幂等，后台）...")
		if err := c.Media.EmojiSeedService.SeedBilibiliEmojis(ctx); err != nil {
			log.Error().Err(err).Msg("表情种子数据初始化失败（不影响服务运行）")
		}
	}()

	go job.NewCleanupJob(gormDB, chunkDir, uploadRoot).Start(ctx)

	// now/worker/tick 用默认值（time.Now / 5 / 30min）。
	go job.NewSubscriptionJob(
		c.Subscription.SubscriptionService,
		c.Subscription.SubscriptionRepository,
		nil, 0, 0,
	).Start(ctx)
}

// serveHTTP 构建路由、挂中间件、启 server，阻塞至 ctx 取消后执行 graceful shutdown。
func serveHTTP(ctx context.Context, cfg *config.Config, redisClient *redis.Client, c *Container) error {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.NewCORS(cfg.CORSAllowedOrigins, middleware.WithCSRFHeader("X-CSRF-Token")))
	r.Use(middleware.SecurityHeaders)

	routing.RegisterRoutes(r, buildRoutingDeps(cfg, redisClient, c))

	addr := fmt.Sprintf(":%s", cfg.Port)
	srv := &http.Server{Addr: addr, Handler: r}

	serverErr := make(chan error, 1)
	go func() {
		log.Info().Str("addr", addr).Msg("博客 API 服务启动")
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
		close(serverErr)
	}()

	select {
	case err := <-serverErr:
		return fmt.Errorf("服务启动失败: %w", err)
	case <-ctx.Done():
		log.Info().Msg("收到退出信号，开始优雅关闭")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("HTTP 优雅关闭失败")
	}
	log.Info().Msg("服务已关闭")
	return nil
}

// buildRoutingDeps 从 Container 装配 routing 所需的全部依赖（含 session 中间件预构造）。
// 把 25 字段的 Deps 填充从 main 下沉到 app 层，使 main 不再触碰路由依赖图。
func buildRoutingDeps(cfg *config.Config, redisClient *redis.Client, c *Container) *routing.Deps {
	sessionLookup := c.Auth.SessionStore
	return &routing.Deps{
		Cfg:                   cfg,
		Redis:                 redisClient,
		PermissionChecker:     c.Role.PermissionChecker,
		SessionAuth:           middleware.SessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL),
		OptionalAuth:          middleware.OptionalSessionAuth(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL),
		SessionAuthReadOnlyMW: middleware.SessionAuthReadOnly(sessionLookup, cfg.Cookie, cfg.Session.IdleTTL),
		Role:                  c.Role.RoleHandler,
		Settings:              c.Settings.SettingsHandler,
		Stats:                 c.Stats.StatsHandler,
		GitHub:                c.GitHub.GitHubHandler,
		Releases:              c.Releases.ReleasesHandler,
		Auth:                  c.Auth.AuthHandler,
		Content:               c.Content.ContentHandler,
		Comment:               c.Comment.CommentHandler,
		CommentReaction:       c.CommentReaction.CommentReactionHandler,
		Media:                 c.Media.MediaHandler,
		Post:                  c.Post.PostHandler,
		Tag:                   c.Tag.TagHandler,
		Audit:                 c.Audit.AuditHandler,
		UserAdmin:             c.UserAdmin.UserAdminHandler,
		APIToken:              c.APIToken.APITokenHandler,
		Subscription:          c.Subscription.SubscriptionHandler,
		CodeRunner:            c.CodeRunner.CodeRunnerHandler,
		System:                c.System.SystemHandler,
		Image:                 c.Image.ImageHandler,
		MCP: routing.MCPHandlers{
			Post:     c.MCP.PostHandler,
			Scraper:  c.MCP.ScraperHandler,
			Public:   c.MCP.PublicHandler,
			Comments: c.MCP.CommentsHandler,
		},
	}
}
