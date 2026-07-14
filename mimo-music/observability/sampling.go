// Package observability 提供 mimo-music 的可观测性基础设施。
package observability

import (
	"context"
	"log/slog"
	"sync/atomic"
)

// samplingConfig 是高频日志的采样配置。
type samplingConfig struct {
	// Initial 是前 N 条全量记录。
	initial int32

	// Thereafter 是之后每 M 条记录 1 条。
	thereafter int32
}

// samplingHandler 包装 slog.Handler，对高频日志做 head-based 采样。
//
// 前 N 条全记，之后按比例采样。避免 url_refresh / cache_warm 这类
// 高频后台任务日志刷屏，采集成本失控。
type samplingHandler struct {
	next    slog.Handler
	counter atomic.Int64
	config  samplingConfig
}

func newSamplingHandler(next slog.Handler) slog.Handler {
	return &samplingHandler{
		next:   next,
		config: samplingConfig{initial: 5, thereafter: 100},
	}
}

// Handle 按 head-based 采样策略决定是否记录。
func (h *samplingHandler) Handle(ctx context.Context, r slog.Record) error {
	count := h.counter.Add(1)

	// 前 initial 条全记
	if count <= int64(h.config.initial) {
		return h.next.Handle(ctx, r)
	}

	// 之后每 thereafter 条记 1 条
	if count%int64(h.config.thereafter) == 0 {
		return h.next.Handle(ctx, r)
	}

	return nil
}

// WithAttrs 委托给下层 handler，但新 handler 共享计数器（同一采样流）。
func (h *samplingHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &samplingHandler{
		next:    h.next.WithAttrs(attrs),
		config:  h.config,
		counter: atomic.Int64{},
	}
}

// WithGroup 委托给下层 handler。
func (h *samplingHandler) WithGroup(name string) slog.Handler {
	return &samplingHandler{
		next:   h.next.WithGroup(name),
		config: h.config,
	}
}

// Enabled 委托给下层 handler。
func (h *samplingHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.next.Enabled(ctx, level)
}
