// Package main 是 mimo-music 服务的入口。
//
// 启动 gRPC server（对外强类型 RPC）+ grpc-gateway（REST 暴露）双 server，
// 收到 SIGINT/SIGTERM 时优雅关闭。
//
// 地基阶段：engine + session 池用 noop/cache 初始化（不接 Redis），
// 真实 Redis 接入在后续。gRPC 端口 :3722，gateway HTTP 端口 :3721。
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/VOD-Studio/mimo-music/internal/cache"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
	"github.com/VOD-Studio/mimo-music/internal/server"
)

// startupCtx 是启动阶段没有请求 ctx 时用的兜底 context。
var startupCtx = context.Background()

func main() {
	// 地基阶段：engine + session 池用 noop 初始化（不接 Redis）。
	// 真实接入在后续：WithCache(redis.New(rdb)) + WithSessions(store.NewSessionStore(rdb))。
	eng := engine.New(
		engine.WithCache(cache.Noop{}),
	)
	sessions := session.NoopStore{}

	app, err := server.NewApp(":3722", ":3721", eng, sessions)
	if err != nil {
		slog.ErrorContext(startupCtx, "init server failed", slog.String("error", err.Error()))
		os.Exit(1)
	}

	// 优雅关闭：监听信号，收到后给 5 秒处理残余请求。
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.InfoContext(startupCtx, "shutting down server...")

	ctx, cancel := context.WithTimeout(startupCtx, 5*time.Second)
	defer cancel()

	if err := app.Shutdown(ctx); err != nil {
		slog.ErrorContext(startupCtx, "server forced to shutdown", slog.String("error", err.Error()))
		os.Exit(1)
	}

	slog.InfoContext(startupCtx, "server stopped")
}
