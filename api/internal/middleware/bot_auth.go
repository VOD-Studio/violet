package middleware

import (
	"context"
	"errors"
	"net/http"
	"strings"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
)

// BotLookup bot token 鉴权端口，由 application/chat.BotService 实现。
//
// 中间件只依赖端口而非 BotService 本体，测试用内存实现即可覆盖鉴权分支。
type BotLookup interface {
	FindByToken(ctx context.Context, rawToken string) (*domainchat.Bot, error)
}

// botContextKey 当前 bot 在 ctx 中的 key。
const botContextKey contextKey = "chatBot"

// BotAuth 外部 bot 的 Bearer token 鉴权中间件。
//
// 与 session 体系完全独立：bot 不持有 cookie，也不参与 CSRF 与滑动续期。
// 命中后把 bot 注入 ctx，并把 bot 的虚拟用户 ID 写进 UserIDKey —— 消息主体就是
// 这个用户，现有 handler 的 currentUserID 与按用户维度的限流因此无需再造一套。
//
// 失败分类：缺头/格式错/token 不认识 → 401；bot 已禁用 → 403；查询本身出错 → 500
// （把仓储故障伪装成鉴权失败会让 bot 误判成 token 过期而白白重置凭据）。
func BotAuth(lookup BotLookup) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, ok := bearerToken(r)
			if !ok {
				response.RespondError(w, r, domainshared.Unauthorized("缺少或无效的 Bot Token"))
				return
			}
			bot, err := lookup.FindByToken(r.Context(), token)
			if err != nil {
				if errors.Is(err, domainchat.ErrBotNotFound) {
					response.RespondError(w, r, domainshared.Unauthorized("缺少或无效的 Bot Token"))
					return
				}
				response.RespondError(w, r, domainshared.Internal("Bot 鉴权失败", err))
				return
			}
			if !bot.IsEnabled() {
				response.RespondError(w, r, domainshared.Forbidden("Bot 已禁用"))
				return
			}
			ctx := context.WithValue(r.Context(), botContextKey, bot)
			ctx = context.WithValue(ctx, UserIDKey, bot.UserID().String())
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetBot 取当前请求的 bot；未经 BotAuth 的路由返回 nil。
func GetBot(ctx context.Context) *domainchat.Bot {
	if bot, ok := ctx.Value(botContextKey).(*domainchat.Bot); ok {
		return bot
	}
	return nil
}

// bearerToken 提取 Authorization: Bearer <token> 里的 token。
//
// 大小写按 RFC 7235 对 scheme 不敏感处理；缺少前缀或非 Bearer scheme 一律视为无效凭据。
func bearerToken(r *http.Request) (string, bool) {
	scheme, value, ok := strings.Cut(r.Header.Get("Authorization"), " ")
	if !ok || !strings.EqualFold(scheme, "Bearer") {
		return "", false
	}
	value = strings.TrimSpace(value)
	return value, value != ""
}
