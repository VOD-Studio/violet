package middleware

import (
	"context"
	"errors"
	"net/http"
	"slices"

	"github.com/modelcontextprotocol/go-sdk/auth"

	domainshared "blog-api/internal/domain/shared"
	inframcp "blog-api/internal/infrastructure/mcp"
	"blog-api/internal/interfaces/http/response"
)

const patScopesKey contextKey = "patScopes"

// PATAuth 为 REST 请求复用 MCP 的令牌校验与异步最近使用时间更新，不依赖 Cookie。
func PATAuth(verifier *inframcp.PATVerifier) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, ok := bearerToken(r)
			if !ok {
				response.RespondError(w, r, domainshared.Unauthorized("缺少或无效的 PAT"))
				return
			}
			info, err := verifier.Verify(r.Context(), token, r)
			if err != nil {
				if errors.Is(err, auth.ErrInvalidToken) {
					response.RespondError(w, r, domainshared.Unauthorized("PAT 无效或已过期"))
				} else {
					response.RespondError(w, r, domainshared.Internal("PAT 鉴权失败", err))
				}
				return
			}
			ctx := context.WithValue(r.Context(), UserIDKey, info.UserID)
			ctx = context.WithValue(ctx, patScopesKey, info.Scopes)
			// PAT 不继承外层 Cookie/Session 中间件带来的角色与超管权限。
			ctx = context.WithValue(ctx, UserIsRootKey, false)
			ctx = context.WithValue(ctx, UserRoleKey, "")
			ctx = context.WithValue(ctx, UserEmailKey, "")
			ctx = context.WithValue(ctx, SessionIDKey, "")
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetPATScopes 返回请求上下文中的只读权限视图；未经过 PATAuth 时返回 nil，调用方不得修改。
func GetPATScopes(ctx context.Context) []string {
	scopes, _ := ctx.Value(patScopesKey).([]string)
	return scopes
}

// RequireScope 精确匹配权限字符串，不赋予通配符语义。
func RequireScope(scope string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !slices.Contains(GetPATScopes(r.Context()), scope) {
				response.RespondError(w, r, domainshared.Forbidden("PAT 权限不足"))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
