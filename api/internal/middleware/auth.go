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
	UserID              string
	Email               string
	Role                string
	RoleID              int32
	IsBuiltinSuperAdmin bool
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

// Auth JWT 认证中间件（强制）。
//
// 无 token 或 token 无效 → 401 拒绝。用于必须登录的端点。
//
// token 读取顺序：
//  1. Authorization: Bearer <token>（优先，兼容旧客户端与 SSR server 端调用）
//  2. access Cookie（回退，配合 HttpOnly Cookie 鉴权方案，浏览器自动携带）
//
// 通过 WithAccessCookie(name) 启用 Cookie 回退；默认仅认 Authorization header。
func Auth(validator TokenValidator, opts ...AuthOption) func(http.Handler) http.Handler {
	cfg := newAuthConfig(opts)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, ok := authenticate(w, r, validator, cfg.accessCookieName)
			if !ok {
				return // 401 已写
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// OptionalAuth 软认证中间件（PRD-0001 评论双轨认证专用）。
//
// 与 Auth 的区别：无 token 时不 401，直接放行（context 里无 UserIDKey，handler 据此走匿名分支）。
// 有 token 且有效 → 注入 UserIDKey 等，handler 据此走登录分支。
// 有 token 但无效 → 与 Auth 一致 401（防止过期 token 被误当匿名）。
//
// 用途：评论 POST /comments 同时允许匿名与登录，登录用户从 cookie 识别身份。
func OptionalAuth(validator TokenValidator, opts ...AuthOption) func(http.Handler) http.Handler {
	cfg := newAuthConfig(opts)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, _ := extractToken(r, cfg.accessCookieName)
			if token == "" {
				// 匿名：无 token 直接放行，context 不注入 UserIDKey
				next.ServeHTTP(w, r)
				return
			}
			ctx, ok := authenticate(w, r, validator, cfg.accessCookieName)
			if !ok {
				return // 401 已写
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// newAuthConfig 应用 AuthOption 得到配置。
func newAuthConfig(opts []AuthOption) *authConfig {
	cfg := &authConfig{}
	for _, opt := range opts {
		opt(cfg)
	}
	return cfg
}

// authenticate 提取并校验 token，成功则返回注入了 user claims 的 context。
//
// 失败时写 401 响应并记录日志，返回 (nil, false)，调用方应直接 return。
// Auth 与 OptionalAuth 的共享逻辑：token 提取、claims 解析、context 注入一致。
func authenticate(w http.ResponseWriter, r *http.Request, validator TokenValidator, accessCookieName string) (context.Context, bool) {
	token, source := extractToken(r, accessCookieName)
	if token == "" {
		log.Warn().
			Str("method", r.Method).
			Str("path", r.URL.Path).
			Str("ip", getClientIP(r)).
			Msg("认证失败：缺少 Authorization 请求头或 access Cookie")
		writeUnauthorized(w)
		return nil, false
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
		writeUnauthorized(w)
		return nil, false
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
	ctx = context.WithValue(ctx, UserIsBuiltinSuperAdminKey, claims.IsBuiltinSuperAdmin)
	return ctx, true
}

// writeUnauthorized 写 401 JSON 响应。
func writeUnauthorized(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	w.Write([]byte(`{"error":"unauthorized","message":"缺少或无效的认证凭据"}`))
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
