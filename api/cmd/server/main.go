// Package main 博客 API 服务主程序入口
// 仅负责 bootstrap：信号 + 配置 + 日志 + app.Run
package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"blog-api/config"
	"blog-api/internal/app"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg := config.Load()
	initLogger(cfg)

	if err := app.Run(ctx, cfg); err != nil {
		log.Fatal().Err(err).Msg("服务退出")
	}
}

// initLogger 配置 zerolog 输出格式与级别（dev 用 console + debug，其余 info）。
// config.Load 内部完成根 .env 加载与来源打印，启动日志可见每个配置项的来源。
func initLogger(cfg *config.Config) {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	if cfg.Environment == "development" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	} else {
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	}
	log.Logger = log.With().Str("service", "blog-api").Logger()
}
