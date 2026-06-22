// Package middleware 提供 HTTP 中间件，处理认证、日志、限流等横切关注点
package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/rs/zerolog/log"
)

// TokenClaims 令牌声明（中间件关心的字段）
//
// 由 TokenValidator 实现返回，避免中间件直接依赖 *service.AuthService
// 或 *infrastructure/auth.JWTService，保持中间件与具体实现解耦。
type TokenClaims struct {
	UserID string
	Email  string
	Role   string
	RoleID int32
}

// TokenValidator 令牌校验端口
//
// 任何能从 access token 解析出 TokenClaims 的实现都能作为 Auth 中间件依赖。
// 当前实现：*service.AuthService（旧）与 *infrastructure/auth.JWTService（DDD）皆满足。
type TokenValidator interface {
	// ParseToken 解析并校验 access token，返回声明
	ParseToken(tokenString string) (*TokenClaims, error)
}

// AuthOption Auth 中间件的可选配置
type AuthOption func(*authConfig)

// authConfig Auth 中间件运行时配置
type authConfig struct {
	// accessCookieName 若非空，Authorization header 缺失时回退读取该 Cookie
	accessCookieName string
}

// WithAccessCookie 启用从 Cookie 读取 access token 的回退路径
//
// 配合 HttpOnly Cookie 鉴权方案使用：浏览器自动携带 Cookie，
// 服务端无需依赖客户端手动注入 Authorization header。
// 读取顺序：Authorization header 优先（兼容旧客户端），缺失时回退 Cookie。
func WithAccessCookie(name string) AuthOption {
	return func(c *authConfig) {
		c.accessCookieName = name
	}
}

// PermissionChecker 权限点检查端口
//
// 任何能根据 (role, roleID, codes) 判断是否授权的实现都能作为 RequirePermission 中间件依赖。
// 当前实现：*service.PermissionService。
type PermissionChecker interface {
	HasPermission(role string, roleID *int32, codes ...string) bool
}

type contextKey string

const (
	UserIDKey     contextKey = "userID"
	UserRoleKey   contextKey = "userRole"
	UserEmailKey  contextKey = "userEmail"
	UserRoleIDKey contextKey = "userRoleID"
)

// Auth JWT 认证中间件
//
// token 读取顺序：
//  1. Authorization: Bearer <token>（优先，兼容旧客户端与 SSR server 端调用）
//  2. access Cookie（回退，配合 HttpOnly Cookie 鉴权方案，浏览器自动携带）
//
// 通过 WithAccessCookie(name) 启用 Cookie 回退；默认仅认 Authorization header。
func Auth(validator TokenValidator, opts ...AuthOption) func(http.Handler) http.Handler {
	cfg := &authConfig{}
	for _, opt := range opts {
		opt(cfg)
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, source := extractToken(r, cfg.accessCookieName)
			if token == "" {
				log.Warn().
					Str("method", r.Method).
					Str("path", r.URL.Path).
					Str("ip", getClientIP(r)).
					Msg("认证失败：缺少 Authorization 请求头或 access Cookie")
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"error":"unauthorized","message":"缺少认证凭据"}`))
				return
			}

			claims, err := validator.ParseToken(token)
			if err != nil {
				log.Warn().
					Err(err).
					Str("method", r.Method).
					Str("path", r.URL.Path).
					Str("ip", getClientIP(r)).
					Str("source", source).
					Str("token_prefix", getTokenPrefix(token)).
					Msg("认证失败：令牌无效或已过期")
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"error":"unauthorized","message":"无效或已过期的令牌"}`))
				return
			}

			log.Info().
				Str("user_id", claims.UserID).
				Str("role", claims.Role).
				Str("email", claims.Email).
				Str("source", source).
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Msg("认证成功")

			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			ctx = context.WithValue(ctx, UserRoleKey, claims.Role)
			ctx = context.WithValue(ctx, UserEmailKey, claims.Email)
			ctx = context.WithValue(ctx, UserRoleIDKey, claims.RoleID)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// extractToken 从请求中提取 access token
//
// 优先级：Authorization header > access Cookie。
// 返回值 source 用于日志（"header" / "cookie" / ""），便于排查鉴权问题。
func extractToken(r *http.Request, accessCookieName string) (token string, source string) {
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
			return parts[1], "header"
		}
	}
	if accessCookieName != "" {
		if c, err := r.Cookie(accessCookieName); err == nil && c.Value != "" {
			return c.Value, "cookie"
		}
	}
	return "", ""
}

// AdminRequired 管理员权限中间件
func AdminRequired(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role := GetUserRole(r.Context())
		userID := GetUserID(r.Context())
		if role != "admin" && role != "superadmin" {
			log.Warn().
				Str("user_id", userID).
				Str("role", role).
				Str("required", "admin/superadmin").
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Msg("权限不足：需要管理员权限")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			w.Write([]byte(`{"error":"forbidden","message":"需要管理员权限"}`))
			return
		}
		next.ServeHTTP(w, r)
	})
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
// superadmin 角色直接放行，其他角色查询内存缓存判断
func RequirePermission(checker PermissionChecker, codes ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role := GetUserRole(r.Context())
			roleID := GetUserRoleID(r.Context())
			userID := GetUserID(r.Context())

			if !checker.HasPermission(role, roleID, codes...) {
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

// GetUserRoleID 从上下文中获取用户角色 ID
func GetUserRoleID(ctx context.Context) *int32 {
	if roleID, ok := ctx.Value(UserRoleIDKey).(int32); ok && roleID != 0 {
		return &roleID
	}
	return nil
}
