// Package main 是 mimo-music worker 进程入口。
//
// 独立于 HTTP server 进程，负责定时任务（Cookie 健康检查等）。
// 重启不影响 HTTP 服务。
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/hibiken/asynq"

	"github.com/VOD-Studio/mimo-music/config"
	infraredis "github.com/VOD-Studio/mimo-music/internal/infra/redis"
	"github.com/VOD-Studio/mimo-music/internal/worker"
	"github.com/VOD-Studio/mimo-music/internal/worker/tasks"
	"github.com/VOD-Studio/mimo-music/observability"
	"github.com/VOD-Studio/mimo-music/provider"
	"github.com/VOD-Studio/mimo-music/provider/netease"
	storeredis "github.com/VOD-Studio/mimo-music/store/redis"
)

func main() {
	cfg := config.Load()

	// 可观测性
	tracerShutdown, err := observability.InitTracer()
	if err != nil {
		slog.Error("init tracer failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer func() { _ = tracerShutdown(context.Background()) }()
	observability.InitLogger(cfg.Server.Env)

	// 装配 provider（复用 server 的模式）
	neteaseClient := netease.New(
		provider.WithLogger(observability.NewSlogLogger(slog.Default())),
		provider.WithTimeout(cfg.Provider.UpstreamTimeout),
	)

	// Redis 连接（store 健康检查用）
	rdb, err := infraredis.New(cfg.Redis)
	if err != nil {
		slog.Error("init redis failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer func() { _ = rdb.Close() }()
	slog.Info("redis connected", slog.String("addr", cfg.Redis.Addr()))

	sessionStore := storeredis.NewSessionStore(rdb)

	// Asynq server（处理任务）
	srv := asynq.NewServer(
		asynq.RedisClientOpt{Addr: cfg.Redis.Addr()},
		asynq.Config{Concurrency: cfg.Worker.Concurrency},
	)

	// 注册任务 handler
	mux := asynq.NewServeMux()
	mux.Handle(tasks.TypeCookieHealth, tasks.HandleCookieHealth(sessionStore, neteaseClient.Auth()))

	// 定时调度器
	scheduler := worker.NewScheduler(cfg.Redis.Addr(), cfg.Worker.CookieCheckInterval)

	// 启动信号监听
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	// 启动 scheduler
	go func() {
		slog.Info("worker scheduler starting")
		if err := scheduler.Run(); err != nil {
			slog.Error("scheduler failed", slog.String("error", err.Error()))
		}
	}()

	// 启动 server（阻塞）
	go func() {
		slog.Info("worker server starting", slog.Int("concurrency", cfg.Worker.Concurrency))
		if err := srv.Run(mux); err != nil {
			slog.Error("worker server failed", slog.String("error", err.Error()))
			os.Exit(1)
		}
	}()

	<-quit
	slog.Info("shutting down worker...")
	srv.Shutdown()
	scheduler.Shutdown()
	slog.Info("worker stopped")
}
