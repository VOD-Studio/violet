package routing

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/permission"
	"blog-api/internal/middleware"
)

func newRoutingTestRedis(t *testing.T) *redis.Client {
	t.Helper()
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	return redis.NewClient(&redis.Options{Addr: mr.Addr()})
}

// TestBotAPIRoutesBypassCSRF Bot API 与 MCP 同策略挂在 v1 组外：外部 bot 不带 cookie，
// 落在 CSRF 中间件下的话，写端点会在鉴权之前就被 403 拦死，且永远修不好。
func TestBotAPIRoutesBypassCSRF(t *testing.T) {
	deps := fullRouterDeps()
	deps.Redis = newRoutingTestRedis(t)
	router := chi.NewRouter()
	RegisterRoutes(router, deps)

	routes := routeMethods(t, router)
	for _, want := range []string{
		"GET /api/v1/chat/bot/profile",
		"GET /api/v1/chat/bot/events",
		"GET /api/v1/chat/bot/conversations",
		"GET /api/v1/chat/bot/conversations/{conversationId}/messages",
		"POST /api/v1/chat/bot/conversations/{conversationId}/messages",
		"PATCH /api/v1/chat/bot/conversations/{conversationId}/messages/{messageId}",
		"POST /api/v1/chat/bot/conversations/{conversationId}/typing",
	} {
		require.Contains(t, routes, want)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/bot/conversations/11111111-1111-1111-1111-111111111111/messages", strings.NewReader(`{"content":"你好"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	// 401 = 穿过 CSRF 到了 bot 鉴权；403 = CSRF 先拦（豁免失效）。
	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestAdminBotRoutesGateOnBotManagePermission(t *testing.T) {
	deps := fullRouterDeps()
	deps.PermissionChecker = denyingBotManageChecker{}
	admin := NewAdminRouter(deps)

	routes := routeMethods(t, admin)
	for _, want := range []string{
		"GET /chat-bots/",
		"POST /chat-bots/",
		"PATCH /chat-bots/{botId}",
		"DELETE /chat-bots/{botId}",
		"POST /chat-bots/{botId}/regenerate-token",
		"POST /chat-bots/{botId}/token",
	} {
		require.Contains(t, routes, want)
	}

	rec := httptest.NewRecorder()
	admin.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/chat-bots/", nil))
	require.Equal(t, http.StatusForbidden, rec.Code, "缺 chat:bot-manage 时后台 bot 路由必须拒绝")
}

// denyingBotManageChecker 放行 admin 入口基线，只拒 chat:bot-manage，
// 使 403 断言指向 /chat-bots 上的那道门禁而不是 NewAdminRouter 的 AdminRequired。
type denyingBotManageChecker struct{}

func (denyingBotManageChecker) HasPermission(_ string, _ bool, codes ...string) bool {
	for _, code := range codes {
		if code == permission.ChatBotManage.String() {
			return false
		}
	}
	return true
}

var _ middleware.PermissionChecker = denyingBotManageChecker{}
