package middleware

import (
	"context"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"

	"blog-api/config"
	domainsession "blog-api/internal/domain/session"
)

// SessionIDKey 当前 session id 的 context key，供登出端点取出删除当前 session。
const SessionIDKey contextKey = "sessionID"

// SessionLookup session 查询与续期端口，由 SessionStore 实现实现。
// 中间件只依赖端口，不直接依赖 Redis，便于测试用 fake 替换。
type SessionLookup interface {
	Get(ctx context.Context, id domainsession.ID) (*domainsession.Session, error)
	Touch(ctx context.Context, sess *domainsession.Session, idleTTL time.Duration) error
}

// SessionAuth 强制 session 鉴权中间件。无 cookie 或 session 失效 → 401。
// 成功路径：查 session → 注入 ctx → Touch 滑动续期，不轮换 id、不 Set-Cookie。
func SessionAuth(lookup SessionLookup, cookieCfg config.CookieConfig, idleTTL time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, ok := authenticateSession(w, r, lookup, cookieCfg, idleTTL, true)
			if !ok {
				return
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// OptionalSessionAuth 软鉴权：无 cookie 放行不注入（评论匿名/登录双轨用）；
// 有 cookie 但失效 → 401（防过期 session 被误当匿名）。
func OptionalSessionAuth(lookup SessionLookup, cookieCfg config.CookieConfig, idleTTL time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if _, err := r.Cookie(cookieCfg.SessionName); err != nil {
				next.ServeHTTP(w, r)
				return
			}
			ctx, ok := authenticateSession(w, r, lookup, cookieCfg, idleTTL, true)
			if !ok {
				return
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// SessionAuthReadOnly 只读 session 探活中间件，供 /auth/session 端点。
// 命门不变量①：不调 Touch（不续期）、不 Set-Cookie——SSR 拿到 claims 即可。
func SessionAuthReadOnly(lookup SessionLookup, cookieCfg config.CookieConfig, idleTTL time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, ok := authenticateSession(w, r, lookup, cookieCfg, idleTTL, false)
			if !ok {
				return
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// authenticateSession 提取 session cookie → 查询 → 注入 ctx。
// touch=true 时滑动续期（命门：续期不轮换 id、不 Set-Cookie）。
// 失败写 401 并返回 false，调用方直接 return。
func authenticateSession(w http.ResponseWriter, r *http.Request, lookup SessionLookup, cookieCfg config.CookieConfig, idleTTL time.Duration, touch bool) (context.Context, bool) {
	c, err := r.Cookie(cookieCfg.SessionName)
	if err != nil || c.Value == "" {
		writeUnauthorized(w)
		return nil, false
	}
	sess, err := lookup.Get(r.Context(), domainsession.ID(c.Value))
	if err != nil {
		log.Warn().Err(err).Str("path", r.URL.Path).Msg("session 鉴权失败：session 不存在或已过期")
		writeUnauthorized(w)
		return nil, false
	}
	if sess.IsExpired(time.Now(), idleTTL) {
		writeUnauthorized(w)
		return nil, false
	}
	if touch {
		if err := lookup.Touch(r.Context(), sess, idleTTL); err != nil {
			log.Warn().Err(err).Msg("session 续期失败，不影响本次鉴权")
		}
	}
	claims := sess.Claims()
	ctx := r.Context()
	ctx = context.WithValue(ctx, SessionIDKey, string(sess.ID()))
	ctx = context.WithValue(ctx, UserIDKey, claims.UserID)
	ctx = context.WithValue(ctx, UserRoleKey, claims.Role)
	ctx = context.WithValue(ctx, UserEmailKey, claims.Email)
	ctx = context.WithValue(ctx, UserIsBuiltinSuperAdminKey, claims.IsBuiltinSuperAdmin)
	// 审计上下文：IP/UA 从请求取（登录后同一请求链路内事件发布可达）
	ctx = context.WithValue(ctx, ClientIPKey, GetClientIP(r))
	ctx = context.WithValue(ctx, UserAgentKey, r.UserAgent())
	return ctx, true
}

// GetSessionID 从上下文获取当前 session id，登出端点据此删除当前 session。
func GetSessionID(ctx context.Context) string {
	if id, ok := ctx.Value(SessionIDKey).(string); ok {
		return id
	}
	return ""
}
