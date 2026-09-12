// Package main 博客 API 服务主程序入口
// 仅负责 bootstrap：信号 + 配置 + 日志 + app.Run
package main

import (
	"context"
	"io"
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
	logOutput := initLogger(cfg)

	if err := app.Run(ctx, cfg, logOutput); err != nil {
		log.Fatal().Err(err).Msg("服务退出")
	}
}

// 返回 stderr 编码器，采集侧收到格式化前的 JSON。
func initLogger(cfg *config.Config) io.Writer {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	var output io.Writer = os.Stderr
	if cfg.Environment == "development" {
		output = zerolog.ConsoleWriter{Out: os.Stderr}
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	} else {
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	}
	log.Logger = log.Output(output).With().Str("service", "blog-api").Logger()
	zerolog.DefaultContextLogger = &log.Logger
	return output
}
