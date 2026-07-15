// Package worker 提供 mimo-music 的异步任务 worker。
package worker

import (
	"context"
	"fmt"

	"github.com/hibiken/asynq"

	"github.com/VOD-Studio/mimo-music/observability"
)

// TraceMiddleware 是 Asynq 中间件，为每个任务创建 trace span。
//
// 定时任务（如 Cookie 健康检查）没有上游 HTTP 请求继承 trace context，
// 这里为每个任务起一个根 span，使异步任务在 trace UI 中可见，并与日志
// 通过 trace_id 串联（日志 handler 从 ctx 提取 SpanContext 注入 trace_id）。
//
// span 命名为 "asynq <tasktype>"，不泄漏任务 payload 细节。
func TraceMiddleware(next asynq.Handler) asynq.Handler {
	return asynq.HandlerFunc(func(ctx context.Context, t *asynq.Task) error {
		spanName := fmt.Sprintf("asynq %s", t.Type())
		ctx, span := observability.StartSpan(ctx, spanName)
		defer span.End()
		return next.ProcessTask(ctx, t)
	})
}
