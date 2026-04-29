package middleware

import (
	"context"
	"net/http"
	"strings"

	"blog-api/internal/service"
)

// contextKey 自定义 context key 类型，避免 key 冲突
type contextKey string

// UserIDKey 用户 ID 在 context 中的键名
const UserIDKey contextKey = "userID"

// UserRoleKey 用户角色在 context 中的键名
const UserRoleKey contextKey = "userRole"

// UserEmailKey 用户邮箱在 context 中的键名
const UserEmailKey contextKey = "userEmail"

// Auth JWT 认证中间件
// 从 Authorization 请求头提取 Bearer token，使用 ES256 公钥验证签名和过期时间
// 验证通过后将用户信息注入请求上下文
func Auth(authService *service.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 获取 Authorization 请求头
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"error":"unauthorized","message":"缺少 Authorization 请求头"}`))
				return
			}

			// 解析 Bearer token 格式
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"error":"unauthorized","message":"Authorization 格式应为 Bearer <token>"}`))
				return
			}

			tokenString := parts[1]

			// 使用认证服务验证 JWT 令牌
			claims, err := authService.ValidateToken(tokenString)
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"error":"unauthorized","message":"无效或已过期的令牌"}`))
				return
			}

			// 将用户信息注入请求上下文
			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			ctx = context.WithValue(ctx, UserRoleKey, claims.Role)
			ctx = context.WithValue(ctx, UserEmailKey, claims.Email)

			// 将请求传递给下一个处理器
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// AdminRequired 管理员权限中间件
// 必须在 Auth 中间件之后使用，检查用户角色是否为 admin
func AdminRequired(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 从上下文获取用户角色
		role := GetUserRole(r.Context())
		if role != "admin" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			w.Write([]byte(`{"error":"forbidden","message":"需要管理员权限"}`))
			return
		}

		next.ServeHTTP(w, r)
	})
}

// GetUserID 从请求上下文中获取用户 ID
// 供下游 handler 使用，获取当前已认证用户的身份
func GetUserID(ctx context.Context) string {
	if userID, ok := ctx.Value(UserIDKey).(string); ok {
		return userID
	}
	return ""
}

// GetUserRole 从请求上下文中获取用户角色
func GetUserRole(ctx context.Context) string {
	if role, ok := ctx.Value(UserRoleKey).(string); ok {
		return role
	}
	return ""
}

// GetUserEmail 从请求上下文中获取用户邮箱
func GetUserEmail(ctx context.Context) string {
	if email, ok := ctx.Value(UserEmailKey).(string); ok {
		return email
	}
	return ""
}
