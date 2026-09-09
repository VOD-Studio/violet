package routing

import (
	"net/http"
	"sort"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/require"

	"blog-api/config"
	"blog-api/internal/openapi"
	publicationhttp "blog-api/internal/interfaces/http/handler/publication"
	siteidentityhttp "blog-api/internal/interfaces/http/handler/siteidentity"
	siteimpressionhttp "blog-api/internal/interfaces/http/handler/siteimpression"
)

// 路由表中存在但不进入 API 契约文档的端点：健康检查与 spec 端点是基础设施，
// /uploads/* 是图片服务（通配路由），/api/v1/mcp* 是 JSON-RPC 协议而非 REST。
func isParityExcluded(route string) bool {
	switch {
	case route == "/api/health", route == "/api/v1/openapi.json":
		return true
	case strings.HasPrefix(route, "/uploads/"), strings.HasPrefix(route, "/api/v1/mcp"):
		return true
	default:
		return false
	}
}

// fullRouterDeps 构造能走完 RegisterRoutes 全量注册的最小 Deps。
// handler 取零值指针即可（注册只提取方法值不调用）；nil 即跳过的可选域
// （Publication/SiteIdentity/SiteImpression）必须给非零值，否则其路由不注册，
// 对账会把 spec 里对应条目误判为过期。
func fullRouterDeps() *Deps {
	identity := func(h http.Handler) http.Handler { return h }
	return &Deps{
		Cfg:                   &config.Config{UploadPathPrefix: "/uploads/"},
		SessionAuth:           identity,
		OptionalAuth:          identity,
		SessionAuthReadOnlyMW: identity,
		SiteImpressionLimit:   identity,
		SiteIdentity:          &siteidentityhttp.Handler{},
		SiteImpression:        &siteimpressionhttp.Handler{},
		Publication:           &publicationhttp.Handler{},
	}
}

// normalizeRoute 把两侧路由归一到可比较形态：去掉 /api/v1 前缀与尾部斜杠。
func normalizeRoute(route string) string {
	route = strings.TrimPrefix(route, "/api/v1")
	if route != "/" {
		route = strings.TrimSuffix(route, "/")
	}
	return route
}

// TestRouteSpecParity 路由表与 openapi spec 全量双向对账（防漂移门禁）。
// handler 新注册而 spec 未记录、或 spec 记录了已删路由，都在此红了。
func TestRouteSpecParity(t *testing.T) {
	r := chi.NewRouter()
	RegisterRoutes(r, fullRouterDeps())

	live := map[string]bool{}
	err := chi.Walk(r, func(method, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		if !isParityExcluded(route) {
			live[method+" "+normalizeRoute(route)] = true
		}
		return nil
	})
	require.NoError(t, err)

	spec, err := openapi.Spec()
	require.NoError(t, err)

	documented := map[string]bool{}
	for path, item := range spec.Paths.Map() {
		for method := range item.Operations() {
			documented[strings.ToUpper(method)+" "+normalizeRoute(path)] = true
		}
	}

	var missing, stale []string
	for k := range live {
		if !documented[k] {
			missing = append(missing, k)
		}
	}
	for k := range documented {
		if !live[k] {
			stale = append(stale, k)
		}
	}
	sort.Strings(missing)
	sort.Strings(stale)
	require.Empty(t, missing, "路由已注册但 spec 未记录（文档漂移，需补 paths）")
	require.Empty(t, stale, "spec 记录了不存在的路由（过期条目，需删除）")
}
