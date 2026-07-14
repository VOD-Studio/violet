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
)

func main() {
	cfg := config.Load()

	logger := slog.Default()
	slog.SetDefault(logger)

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
		logger.Info("mimo-music server starting", slog.String("config", cfg.String()))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server failed", slog.String("error", err.Error()))
			os.Exit(1)
		}
	}()

	<-quit
	logger.Info("shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("server forced to shutdown", slog.String("error", err.Error()))
		os.Exit(1)
	}

	logger.Info("server stopped")
}
