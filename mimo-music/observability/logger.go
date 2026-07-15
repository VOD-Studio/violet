// Package observability 提供 mimo-music 的可观测性基础设施。
package observability

import (
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/lmittmann/tint"
)

// LevelVar 是全局动态日志等级变量。
//
// 通过 SIGHUP 信号可在运行时调整日志级别，无需重启进程。
// 排障时临时调到 Debug 级别，看完再调回 Info。
var LevelVar = new(slog.LevelVar)

// InitLogger 初始化全局 slog Logger。
//
// 生产环境用 JSON handler 输出到 stdout，开发环境用 tint 彩色文本。
// 日志等级由 LevelVar 控制，默认 Info，可通过 SIGHUP 信号动态调整。
//
// 所有日志只写 stdout，不落盘。日志采集交给 sidecar（Fluent Bit / Vector）
// 转发到 Loki / ClickHouse。
func InitLogger(env string) *slog.Logger {
	LevelVar.Set(slog.LevelInfo)

	var handler slog.Handler
	opts := &slog.HandlerOptions{
		Level:     LevelVar,
		AddSource: env == "dev",
	}

	if env == "prod" {
		// 生产：JSON，输出到 stdout
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		// 开发：tint 彩色文本
		handler = tint.NewHandler(os.Stderr, &tint.Options{
			Level:     LevelVar,
			AddSource: true,
		})
	}

	// 包装：OTel trace_id 注入 → 脱敏 → 采样 → 实际 handler
	handler = wrapHandler(handler)

	logger := slog.New(handler)
	slog.SetDefault(logger)
	return logger
}

// wrapHandler 按顺序包装 handler 链。
//
// 顺序：otelHandler（注入 trace_id）→ redactHandler（脱敏）→ samplingHandler（采样）→ 实际 handler
func wrapHandler(base slog.Handler) slog.Handler {
	h := newOtelHandler(base)
	h = newRedactHandler(h)
	h = newSamplingHandler(h)
	return h
}

// HandleSIGHUP 注册 SIGHUP 信号处理，收到时在 Info / Debug 间切换日志等级。
//
// 调用一次即可，在 main 中注册。
func HandleSIGHUP() {
	ch := make(chan os.Signal, 1)
	signal.Notify(ch, syscall.SIGHUP)
	go func() {
		for range ch {
			current := LevelVar.Level()
			if current == slog.LevelDebug {
				LevelVar.Set(slog.LevelInfo)
				slog.Info("log level changed to INFO")
			} else {
				LevelVar.Set(slog.LevelDebug)
				slog.Info("log level changed to DEBUG")
			}
		}
	}()
}

