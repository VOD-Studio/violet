// Package middleware 提供接口层（HTTP）中间件与 context 辅助函数。
//
// 错误响应（RespondError）已迁移至 internal/interfaces/http/response 包。
// 本包仅保留 HTTP 中间件（Auth/限流/CORS）与 context 存取辅助函数。
package middleware

import (
	"context"
	"net/http"
)

// GetUserIDFromContext 从 request context 获取认证后的用户 ID
func GetUserIDFromContext(r *http.Request) string {
	if v, ok := r.Context().Value(userIDContextKey).(string); ok {
		return v
	}
	return r.Header.Get("X-User-Id")
}

// SetUserIDToContext 将用户 ID 注入 context
func SetUserIDToContext(r *http.Request, userID string) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), userIDContextKey, userID))
}

type contextKey string

const userIDContextKey contextKey = "user_id"
