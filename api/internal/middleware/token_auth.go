package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	domainapitoken "blog-api/internal/domain/api_token"
)

// TokenScopesKey PAT 授予的 scope 列表的 context key，供 MCP tool handler 读取。
const TokenScopesKey contextKey = "tokenScopes"

// TokenAuth PAT 鉴权中间件。
//
// 提取 Authorization: Bearer <token> → 哈希 → 查 TokenLookup → 校验未过期 →
// 注入 ctx（UserIDKey + TokenScopesKey）→ 异步刷新 last_used_at。
// 缺失/无效/已过期 → 401。
//
// 与 SessionAuth 正交：浏览器走 cookie session，MCP 走 Bearer PAT。
// 失败一律返回相同 401 体，不泄露"token 存在但已过期"等信息。
func TokenAuth(lookup domainapitoken.TokenLookup) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			plain, ok := extractBearer(r)
			if !ok {
				writeUnauthorized(w)
				return
			}
			p, err := lookup.FindByHash(r.Context(), domainapitoken.HashToken(plain))
			if err != nil {
				writeUnauthorized(w)
				return
			}
			if p.IsExpired(time.Now()) {
				writeUnauthorized(w)
				return
			}
			// 异步刷新 last_used_at：用独立 context（不复用请求 ctx，请求结束即取消），
			// 不阻塞响应；失败仅记日志。spec：成功路径异步刷新。
			go func(tokenID string) {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				if err := lookup.TouchLastUsed(ctx, tokenID, time.Now()); err != nil {
					log.Warn().Err(err).Str("token_id", tokenID).Msg("刷新 PAT last_used_at 失败")
				}
			}(p.ID())
			ctx := context.WithValue(r.Context(), UserIDKey, p.UserID())
			ctx = context.WithValue(ctx, TokenScopesKey, p.Scopes())
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// extractBearer 从 Authorization header 提取 Bearer token 明文。
// 缺失 header、非 Bearer scheme、空 token → ok=false。
func extractBearer(r *http.Request) (string, bool) {
	h := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if len(h) <= len(prefix) || !strings.EqualFold(h[:len(prefix)], prefix) {
		return "", false
	}
	plain := strings.TrimSpace(h[len(prefix):])
	if plain == "" {
		return "", false
	}
	return plain, true
}

// GetTokenScopes 从上下文获取 PAT 授予的 scope 列表（MCP tool handler 用）。
// 非 PAT 鉴权路径返回 nil。
func GetTokenScopes(ctx context.Context) []string {
	v, _ := ctx.Value(TokenScopesKey).([]string)
	return v
}
