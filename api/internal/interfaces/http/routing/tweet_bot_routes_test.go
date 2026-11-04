package routing

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/require"
)

// TestTweetBotRoutesBypassCSRF Bot 推文写端点与 /chat/bot、MCP 同策略挂在 v1 组外：
// bot 不带 cookie，落在 CSRF 中间件下会在鉴权前被 403 拦死。
func TestTweetBotRoutesBypassCSRF(t *testing.T) {
	deps := fullRouterDeps()
	deps.Redis = newRoutingTestRedis(t)
	router := chi.NewRouter()
	RegisterRoutes(router, deps)

	routes := routeMethods(t, router)
	for _, want := range []string{
		"POST /api/v1/tweets/bot/",
		"POST /api/v1/tweets/bot/media",
		"POST /api/v1/tweets/bot/{tweetId}/comments",
		"DELETE /api/v1/tweets/bot/{tweetId}/comments/{commentId}",
		"POST /api/v1/tweets/bot/{tweetId}/like",
		"DELETE /api/v1/tweets/bot/{tweetId}/like",
		"DELETE /api/v1/tweets/bot/{tweetId}",
	} {
		require.Contains(t, routes, want)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/tweets/bot",
		strings.NewReader(`{"content":"hi"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	// 401 = 穿过 CSRF 到了 bot 鉴权；403 = CSRF 先拦（豁免失效）。
	require.Equal(t, http.StatusUnauthorized, rec.Code)
}
