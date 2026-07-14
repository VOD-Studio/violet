// Package main 是 mimo-music HTTP 服务的入口。
//
// 启动 chi HTTP 服务，监听配置端口，收到 SIGINT/SIGTERM 时优雅关闭。
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/VOD-Studio/mimo-music/config"
	"github.com/VOD-Studio/mimo-music/internal/server"
	"github.com/VOD-Studio/mimo-music/observability"
)

func main() {
	cfg := config.Load()

	// 可观测性初始化：OTel tracer（生成 trace_id）→ logger（slog + handler 链）
	tracerShutdown, err := observability.InitTracer()
	if err != nil {
		slog.Error("init tracer failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer func() {
		_ = tracerShutdown(context.Background())
	}()

	observability.InitLogger(cfg.Server.Env)
	observability.HandleSIGHUP()

	router := server.NewRouter()
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// 优雅关闭：监听信号，收到后给 5 秒处理残余请求
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		slog.Info("mimo-music server starting", slog.String("config", cfg.String()))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server failed", slog.String("error", err.Error()))
			os.Exit(1)
		}
	}()

	<-quit
	slog.Info("shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("server forced to shutdown", slog.String("error", err.Error()))
		os.Exit(1)
	}

	slog.Info("server stopped")
}
