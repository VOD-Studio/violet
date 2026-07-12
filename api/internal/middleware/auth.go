// Package middleware 提供 HTTP 中间件，处理认证、日志、限流等横切关注点
package middleware

import (
	"context"
	"net/http"

	"github.com/rs/zerolog/log"
)

// PermissionChecker 权限点检查端口
//
// 任何能根据 (role, isBuiltinSuperAdmin, codes) 判断是否授权的实现都能作为 RequirePermission 中间件依赖。
// isBuiltinSuperAdmin 承载通配符语义：内置超管短路拥有所有权限，不查权限表。
// 当前实现：*service.PermissionService。
type PermissionChecker interface {
	HasPermission(role string, isBuiltinSuperAdmin bool, codes ...string) bool
}

type contextKey string

const (
	UserIDKey                  contextKey = "userID"
	UserRoleKey                contextKey = "userRole"
	UserEmailKey               contextKey = "userEmail"
	UserIsBuiltinSuperAdminKey contextKey = "userIsBuiltinSuperAdmin"
)

// AdminRequired 管理后台入口权限中间件
//
// 判定规则：拥有 admin:access 权限点即放行（admin/superadmin 角色默认拥有）。
// 这让权限矩阵可配置——例如 author 角色被授予 admin:access 后即可进入后台，
// 但具体操作仍由各路由上的 RequirePermission 逐项卡控。
// 内置超管（isBuiltinSuperAdmin）由 PermissionChecker 短路放行。
func AdminRequired(checker PermissionChecker) func(http.Handler) http.Handler {
	return RequirePermission(checker, "admin:access")
}

// SuperAdminRequired 超级管理员权限中间件
func SuperAdminRequired(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role := GetUserRole(r.Context())
		userID := GetUserID(r.Context())
		if role != "superadmin" {
			log.Warn().
				Str("user_id", userID).
				Str("role", role).
				Str("required", "superadmin").
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Msg("权限不足：需要超级管理员权限")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			w.Write([]byte(`{"error":"forbidden","message":"需要超级管理员权限"}`))
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RequirePermission 权限点检查中间件
// 内置超管（isBuiltinSuperAdmin=true）直接放行，其他角色查询内存缓存判断
func RequirePermission(checker PermissionChecker, codes ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role := GetUserRole(r.Context())
			isBuiltin := GetUserIsBuiltinSuperAdmin(r.Context())
			userID := GetUserID(r.Context())

			if !checker.HasPermission(role, isBuiltin, codes...) {
				log.Warn().
					Str("user_id", userID).
					Str("role", role).
					Strs("required", codes).
					Str("method", r.Method).
					Str("path", r.URL.Path).
					Msg("权限不足")
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				w.Write([]byte(`{"error":"forbidden","message":"权限不足"}`))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// GetUserID 从上下文中获取用户 ID
func GetUserID(ctx context.Context) string {
	if userID, ok := ctx.Value(UserIDKey).(string); ok {
		return userID
	}
	return ""
}

// GetUserRole 从上下文中获取用户角色
func GetUserRole(ctx context.Context) string {
	if role, ok := ctx.Value(UserRoleKey).(string); ok {
		return role
	}
	return ""
}

// GetUserEmail 从上下文中获取用户邮箱
func GetUserEmail(ctx context.Context) string {
	if email, ok := ctx.Value(UserEmailKey).(string); ok {
		return email
	}
	return ""
}

// GetUserIsBuiltinSuperAdmin 从上下文中获取是否为内置超级管理员
//
// 承载通配符权限语义：true 时 HasPermission 短路放行所有权限码。
func GetUserIsBuiltinSuperAdmin(ctx context.Context) bool {
	isBuiltin, ok := ctx.Value(UserIsBuiltinSuperAdminKey).(bool)
	return ok && isBuiltin
}

// writeUnauthorized 写 401 JSON 响应。
func writeUnauthorized(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	w.Write([]byte(`{"error":"unauthorized","message":"缺少或无效的认证凭据"}`))
}
