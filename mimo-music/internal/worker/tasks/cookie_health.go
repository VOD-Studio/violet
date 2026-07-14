// Package tasks 定义 mimo-music worker 的异步任务。
package tasks

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/hibiken/asynq"

	"github.com/VOD-Studio/mimo-music/observability"
	"github.com/VOD-Studio/mimo-music/provider"
)

// TypeCookieHealth 是 Cookie 健康检查任务的类型标识。
const TypeCookieHealth = "cookie:health"

// CookieHealthPayload 是 Cookie 健康检查任务的载荷（无参数）。
type CookieHealthPayload struct{}

// NewCookieHealthTask 创建 Cookie 健康检查任务。
func NewCookieHealthTask() (*asynq.Task, error) {
	return asynq.NewTask(TypeCookieHealth, nil), nil
}

// HandleCookieHealth 处理 Cookie 健康检查任务。
//
// 遍历 SessionStore 中所有 session，逐个验证 Cookie 有效性。
// 失效的记 Warn 日志。
func HandleCookieHealth(store provider.SessionStore, auth provider.Auth) asynq.Handler {
	return asynq.HandlerFunc(func(ctx context.Context, t *asynq.Task) error {
		userIDs, err := store.ListAll(ctx)
		if err != nil {
			slog.ErrorContext(ctx, "list sessions failed",
				slog.String(observability.FieldErrorCode, err.Error()))
			return fmt.Errorf("列出 session 失败: %w", err)
		}

		checked := 0
		expired := 0
		for _, uid := range userIDs {
			cookie, err := store.Get(ctx, uid)
			if err != nil || cookie == "" {
				expired++
				slog.WarnContext(ctx, "cookie missing or invalid",
					slog.String(observability.FieldUserID, uid))
				continue
			}

			// 调用 LoginStatus 验证 Cookie
			_, err = auth.LoginStatus(ctx, cookie)
			if err != nil {
				expired++
				slog.WarnContext(ctx, "cookie expired",
					slog.String(observability.FieldUserID, uid),
					slog.String(observability.FieldErrorCode, err.Error()))
				continue
			}
			checked++
		}

		slog.InfoContext(ctx, "cookie health check done",
			slog.Int("total", len(userIDs)),
			slog.Int("valid", checked),
			slog.Int("expired", expired))
		return nil
	})
}
