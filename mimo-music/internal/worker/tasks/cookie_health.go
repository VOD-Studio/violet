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

// CookieHealthResult 是单个 session 健康检查的结果。
type CookieHealthResult struct {
	// UserID 是被检查的用户 ID。
	UserID string

	// Healthy 是 Cookie 是否有效。
	Healthy bool
}

// HandleCookieHealth 处理 Cookie 健康检查任务。
//
// 遍历 SessionStore 中所有 session，逐个验证 Cookie 有效性。
// 失效的记 Warn 日志、更新 cookie_health_status gauge、通知回调标记不可用。
// 有效的恢复可用状态。
func HandleCookieHealth(
	store provider.SessionStore,
	auth provider.Auth,
	m *observability.Metrics,
	onResult func(ctx context.Context, r CookieHealthResult),
) asynq.Handler {
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
			healthy := checkOneCookie(ctx, store, auth, uid, m)
			if healthy {
				checked++
			} else {
				expired++
			}
			if onResult != nil {
				onResult(ctx, CookieHealthResult{UserID: uid, Healthy: healthy})
			}
		}

		slog.InfoContext(ctx, "cookie health check done",
			slog.Int("total", len(userIDs)),
			slog.Int("valid", checked),
			slog.Int("expired", expired))
		return nil
	})
}

// checkOneCookie 检查单个 session 的 Cookie 有效性，返回是否健康。
func checkOneCookie(ctx context.Context, store provider.SessionStore, auth provider.Auth, uid string, m *observability.Metrics) bool {
	cookie, err := store.Get(ctx, uid)
	if err != nil || cookie == "" {
		m.SetCookieHealth(uid, false)
		slog.WarnContext(ctx, "cookie missing or invalid",
			slog.String(observability.FieldUserID, uid))
		return false
	}

	_, err = auth.LoginStatus(ctx, cookie)
	if err != nil {
		m.SetCookieHealth(uid, false)
		slog.WarnContext(ctx, "cookie expired",
			slog.String(observability.FieldUserID, uid),
			slog.String(observability.FieldErrorCode, err.Error()))
		return false
	}

	m.SetCookieHealth(uid, true)
	return true
}
