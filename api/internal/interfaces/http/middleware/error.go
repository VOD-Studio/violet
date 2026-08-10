// Package middleware 提供接口层（HTTP）中间件与 context 辅助函数。
//
// 错误响应（RespondError）已迁移至 internal/interfaces/http/response 包。
// 本包仅保留 HTTP 中间件（Auth/限流/CORS）与 context 存取辅助函数。
package middleware

import (
	"net/http"

	"blog-api/internal/middleware"
)

// GetUserIDFromContext 从 request context 获取认证后的用户 ID
//
// 使用与认证中间件相同的 context key，避免跨包 key 不一致导致读取失败。
func GetUserIDFromContext(r *http.Request) string {
	return middleware.GetUserID(r.Context())
}

// GetUserRoleFromContext 从 request context 获取认证后的用户角色
func GetUserRoleFromContext(r *http.Request) string {
	return middleware.GetUserRole(r.Context())
}

// GetUserIsRootFromContext 从 request context 获取是否为 root 用户
func GetUserIsRootFromContext(r *http.Request) bool {
	return middleware.GetUserIsRoot(r.Context())
}

// GetSessionIDFromContext 从 request context 获取当前 session id。
// 登出端点据此删除当前设备的 session。
func GetSessionIDFromContext(r *http.Request) string {
	return middleware.GetSessionID(r.Context())
}

// GetUserEmailFromContext 从 request context 获取认证后的用户邮箱。
func GetUserEmailFromContext(r *http.Request) string {
	return middleware.GetUserEmail(r.Context())
}
