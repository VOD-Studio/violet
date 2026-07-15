// Package main 是 mimo-music 服务的入口。
//
// 启动 gRPC server（对外强类型 RPC）+ grpc-gateway（REST 暴露）双 server，
// 收到 SIGINT/SIGTERM 时优雅关闭。
//
// 地基阶段（issue 0001）：service 全部 unimplemented 占位，只验证 proto 契约生成
// 与双 server 能启动、grpcurl reflection 能连。真实接口实现在 issue 0005 迁移。
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/VOD-Studio/mimo-music/internal/server"
)

// startupCtx 是启动阶段没有请求 ctx 时用的兜底 context。
// ADR §11 强制 slog.*Context，启动阶段用 background 满足 linter。
var startupCtx = context.Background()

func main() {
	// 地基阶段：最小配置，gRPC 与 gateway 端口硬编码。
	// issue 0005 接入 config + wire 装配后，端口走配置。
	app, err := server.NewApp(":3722", ":3721")
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

