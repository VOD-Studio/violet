package gorm

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"

	"blog-api/config"
	appusage "blog-api/internal/application/omp_usage"
	domainapitoken "blog-api/internal/domain/api_token"
	domainusage "blog-api/internal/domain/omp_usage"
	domainsession "blog-api/internal/domain/session"
	infraauth "blog-api/internal/infrastructure/auth"
	inframcp "blog-api/internal/infrastructure/mcp"
	usagehttp "blog-api/internal/interfaces/http/handler/omp_usage"
	"blog-api/internal/interfaces/http/routing"
	"blog-api/internal/middleware"
)

type usageHTTPFixture struct {
	router      http.Handler
	pat         string
	cookie      *http.Cookie
	otherPAT    string
	otherCookie *http.Cookie
	wrongScope  string
	expired     string
	cache       *miniredis.Miniredis
	failStorage func()
	clock       time.Time
}

func newUsageHTTPFixture(t *testing.T) usageHTTPFixture {
	t.Helper()
	db := setupIntegrationDB(t)
	cache := miniredis.RunT(t)
	clock := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	cache.SetTime(clock)
	redisClient := redis.NewClient(&redis.Options{Addr: cache.Addr()})
	t.Cleanup(func() { require.NoError(t, redisClient.Close()) })
	tokens := NewAPITokenRepository(db)
	store := infraauth.NewRedisSessionStore(redisClient)
	cookieCfg := config.CookieConfig{SessionName: "violet_session", CSRFName: "violet_csrf", SameSite: "lax"}
	owner := preseedAuthor(t, db)
	other := preseedAuthor(t, db)
	createPAT := func(userID, scope string, expiry time.Time) string {
		pat, raw, err := domainapitoken.NewPAT(userID, "usage test", []string{scope}, expiry, time.Now())
		require.NoError(t, err)
		require.NoError(t, tokens.Save(context.Background(), pat))
		return raw
	}
	createCookie := func(userID string) *http.Cookie {
		sess := domainsession.Reconstruct(domainsession.ID("session-"+userID), userID, "test@example.test", "user", false,
			domainsession.CSRFToken("csrf"), time.Now(), time.Now(), time.Now().Add(time.Hour))
		require.NoError(t, store.Create(context.Background(), sess, time.Hour))
		return &http.Cookie{Name: cookieCfg.SessionName, Value: string(sess.ID())}
	}
	identity := func(next http.Handler) http.Handler { return next }
	deps := &routing.Deps{
		Cfg: &config.Config{Cookie: cookieCfg, UploadPathPrefix: "/uploads/"}, Redis: redisClient,
		SessionAuth: middleware.SessionAuth(store, cookieCfg, time.Hour), OptionalAuth: identity, SessionAuthReadOnlyMW: identity, BotAuth: identity,
		OMPUsage:     usagehttp.NewHandler(appusage.NewService(NewOMPUsageRepository(db))),
		OMPUsageAuth: middleware.PATAuth(inframcp.NewPATVerifier(tokens)),
		MCP:          routing.MCPHandlers{Post: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })},
	}
	router := chi.NewRouter()
	routing.RegisterRoutes(router, deps)
	return usageHTTPFixture{router: router, cache: cache, clock: clock,
		pat: createPAT(owner.String(), "usage:write", time.Time{}), cookie: createCookie(owner.String()),
		otherPAT: createPAT(other.String(), "usage:write", time.Time{}), otherCookie: createCookie(other.String()),
		wrongScope: createPAT(owner.String(), "posts:write", time.Time{}), expired: createPAT(owner.String(), "usage:write", time.Now().Add(-time.Hour)),
		failStorage: func() { require.NoError(t, db.Exec("DROP TABLE omp_usage_events").Error) },
	}
}

func (f usageHTTPFixture) request(method, path, body, pat string, cookie *http.Cookie) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, "/api/v1/omp-usage/"+path, strings.NewReader(body))
	if pat != "" {
		req.Header.Set("Authorization", "Bearer "+pat)
	}
	if cookie != nil {
		req.AddCookie(cookie)
	}
	result := httptest.NewRecorder()
	f.router.ServeHTTP(result, req)
	return result
}

func usageWireEvent(id string) map[string]any {
	return map[string]any{"client_event_id": id, "provider": "test", "model": "model", "input_tokens": 100,
		"output_tokens": 20, "cache_read_tokens": 50, "cache_write_tokens": 10, "reasoning_tokens": 5,
		"cost_total": 0.25, "stop_reason": "stop", "is_error": false, "duration_ms": 2000, "ttft_ms": 1000,
		"is_subagent": false, "omp_version": "1.0", "occurred_at": time.Now().UTC().Add(-time.Minute).Format(time.RFC3339Nano)}
}

func usageBatch(t *testing.T, events ...map[string]any) string {
	t.Helper()
	body, err := json.Marshal(map[string]any{"events": events})
	require.NoError(t, err)
	return string(body)
}

func TestOMPUsageHTTPIntegrationAuthIsolationDedupAndRateLimit(t *testing.T) {
	f := newUsageHTTPFixture(t)
	body := usageBatch(t, usageWireEvent("same"))
	for _, tc := range []struct {
		token  string
		cookie *http.Cookie
		status int
	}{
		{"", nil, 401}, {"forged", nil, 401}, {f.expired, nil, 401}, {f.wrongScope, nil, 403}, {"", f.cookie, 401},
	} {
		result := f.request("POST", "batch", body, tc.token, tc.cookie)
		require.Equal(t, tc.status, result.Code, result.Body.String())
		require.Contains(t, result.Header().Get("Content-Type"), "application/json")
	}
	first := f.request("POST", "batch", body, f.pat, f.otherCookie)
	require.Equal(t, 200, first.Code, first.Body.String())
	require.JSONEq(t, `{"data":{"accepted":1,"duplicated":0}}`, first.Body.String())
	duplicate := f.request("POST", "batch", body, f.pat, nil)
	require.Equal(t, 200, duplicate.Code, duplicate.Body.String())
	require.JSONEq(t, `{"data":{"accepted":0,"duplicated":1}}`, duplicate.Body.String())

	for _, endpoint := range []string{"summary", "models", "timeseries"} {
		require.Equal(t, 401, f.request("GET", endpoint, "", f.pat, nil).Code, "PAT must not replace a browser session")
		own := f.request("GET", endpoint+"?range=7d", "", "", f.cookie)
		require.Equal(t, 200, own.Code, own.Body.String())
		require.Equal(t, "private, no-store", own.Header().Get("Cache-Control"))
	}
	other := f.request("GET", "summary", "", f.pat, f.otherCookie)
	require.Equal(t, 200, other.Code, other.Body.String())
	var result struct {
		Data domainusage.Summary `json:"data"`
	}
	require.NoError(t, json.Unmarshal(other.Body.Bytes(), &result))
	require.Zero(t, result.Data.Requests)
	own := f.request("GET", "summary", "", "", f.cookie)
	require.NoError(t, json.Unmarshal(own.Body.Bytes(), &result))
	require.EqualValues(t, 1, result.Data.Requests)
	require.EqualValues(t, 180, result.Data.TotalTokens)

	for range 58 {
		require.Equal(t, 200, f.request("POST", "batch", body, f.pat, nil).Code)
	}
	limited := f.request("POST", "batch", body, f.pat, nil)
	require.Equal(t, 429, limited.Code, limited.Body.String())
	require.NotEmpty(t, limited.Header().Get("Retry-After"))
	control := httptest.NewRecorder()
	f.router.ServeHTTP(control, httptest.NewRequest(http.MethodPost, "/api/v1/mcp", nil))
	require.Equal(t, http.StatusNoContent, control.Code, "用量配额不能耗尽独立 MCP 配额")
	require.Equal(t, 200, f.request("GET", "summary", "", "", f.cookie).Code)
	require.Equal(t, 200, f.request("POST", "batch", body, f.otherPAT, nil).Code)
	f.cache.FastForward(time.Minute)
	f.cache.SetTime(f.clock.Add(time.Minute))
	require.Equal(t, 200, f.request("POST", "batch", body, f.pat, nil).Code)
}

func TestOMPUsageHTTPIntegrationStrictWholeBatchAndQueryValidation(t *testing.T) {
	f := newUsageHTTPFixture(t)
	for _, tc := range []struct {
		name   string
		change func(map[string]any)
	}{
		{"negative", func(e map[string]any) { e["input_tokens"] = -1 }},
		{"fractional", func(e map[string]any) { e["output_tokens"] = 1.5 }},
		{"unsafe integer", func(e map[string]any) { e["input_tokens"] = int64(9007199254740992) }},
		{"missing count", func(e map[string]any) { delete(e, "cache_read_tokens") }},
		{"null count", func(e map[string]any) { e["reasoning_tokens"] = nil }},
		{"negative cost", func(e map[string]any) { e["cost_total"] = -1 }},
		{"overflow cost", func(e map[string]any) { e["cost_total"] = 1e100 }},
		{"missing flag", func(e map[string]any) { delete(e, "is_error") }},
		{"negative duration", func(e map[string]any) { e["duration_ms"] = -1 }},
		{"huge timing", func(e map[string]any) { e["ttft_ms"] = 1e30 }},
		{"future", func(e map[string]any) { e["occurred_at"] = time.Now().UTC().Add(time.Hour).Format(time.RFC3339) }},
		{"nonUTC", func(e map[string]any) { e["occurred_at"] = "2026-01-01T00:00:00+01:00" }},
		{"bad time", func(e map[string]any) { e["occurred_at"] = "yesterday" }},
		{"empty id", func(e map[string]any) { e["client_event_id"] = "" }},
		{"path id", func(e map[string]any) { e["client_event_id"] = "/home/private/session" }},
		{"oversized model", func(e map[string]any) { e["model"] = strings.Repeat("m", 257) }},
		{"UTF8 bytes", func(e map[string]any) { e["provider"] = strings.Repeat("中", 43) }},
		{"user identity", func(e map[string]any) { e["user_id"] = "other" }},
		{"prompt", func(e map[string]any) { e["prompt"] = "private prompt" }},
		{"cwd", func(e map[string]any) { e["cwd"] = "/home/private" }},
		{"content", func(e map[string]any) { e["content"] = "private answer" }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			invalid := usageWireEvent("invalid")
			tc.change(invalid)
			response := f.request("POST", "batch", usageBatch(t, usageWireEvent("valid-prefix"), invalid), f.pat, nil)
			require.Equal(t, 400, response.Code, response.Body.String())
		})
	}
	for _, body := range []string{`{"events":[]}`, `{"events":null}`, `null`, `{}`, `{"events":[],"user_id":"other"}`, `{"events":[]} {}`, strings.Repeat(" ", usagehttp.MaxBatchBytes+1), `{"events":[{"cost_total":1e999}]}`} {
		require.Equal(t, 400, f.request("POST", "batch", body, f.pat, nil).Code)
	}
	tooMany := make([]map[string]any, 201)
	for i := range tooMany {
		tooMany[i] = usageWireEvent(fmt.Sprintf("event-%d", i))
	}
	require.Equal(t, 400, f.request("POST", "batch", usageBatch(t, tooMany...), f.pat, nil).Code)
	for _, path := range []string{"summary?range=1d", "models?range=", "summary?range=%zz", "summary?user_id=other", "summary?range=7d&range=30d", "timeseries?bucket=minute", "summary?bucket=day"} {
		require.Equal(t, 400, f.request("GET", path, "", "", f.cookie).Code, path)
	}
	summary := f.request("GET", "summary", "", "", f.cookie)
	require.Equal(t, 200, summary.Code)
	var result struct {
		Data domainusage.Summary `json:"data"`
	}
	require.NoError(t, json.Unmarshal(summary.Body.Bytes(), &result))
	require.Equal(t, domainusage.Summary{}, result.Data, "invalid batches cannot commit their valid prefix")

	old := usageWireEvent("old")
	old["occurred_at"], old["duration_ms"], old["ttft_ms"] = "2000-01-01T00:00:00Z", nil, nil
	accepted := f.request("POST", "batch", usageBatch(t, old), f.pat, nil)
	require.Equal(t, 200, accepted.Code, accepted.Body.String())
	maximum := usageWireEvent("safe-maximum")
	maximum["input_tokens"] = int64(9007199254740991)
	maximum["cost_total"] = float64(1e12)
	delete(maximum, "duration_ms")
	delete(maximum, "ttft_ms")
	require.Equal(t, 200, f.request("POST", "batch", usageBatch(t, maximum), f.pat, nil).Code)
	f.cache.FastForward(time.Minute)
	acceptedBatch := f.request("POST", "batch", usageBatch(t, tooMany[:200]...), f.pat, nil)
	require.Equal(t, 200, acceptedBatch.Code, acceptedBatch.Body.String())
	require.JSONEq(t, `{"data":{"accepted":200,"duplicated":0}}`, acceptedBatch.Body.String())
}

func TestOMPUsageHTTPIntegrationEmptyWindowsAndStorageFailure(t *testing.T) {
	f := newUsageHTTPFixture(t)
	models := f.request("GET", "models", "", "", f.cookie)
	require.Equal(t, 200, models.Code, models.Body.String())
	require.JSONEq(t, `{"data":{"models":[]}}`, models.Body.String())
	for _, window := range []struct {
		rangeName string
		days      int
	}{{"7d", 7}, {"30d", 30}, {"90d", 90}, {"", 30}} {
		path := "timeseries"
		if window.rangeName != "" {
			path += "?range=" + window.rangeName
		}
		result := f.request("GET", path, "", "", f.cookie)
		require.Equal(t, 200, result.Code, result.Body.String())
		var series struct {
			Data appusage.TimeseriesDTO `json:"data"`
		}
		require.NoError(t, json.Unmarshal(result.Body.Bytes(), &series))
		require.Equal(t, "day", series.Data.Bucket)
		require.Len(t, series.Data.Points, window.days)
		for _, point := range series.Data.Points {
			require.Zero(t, point.Requests)
			require.Zero(t, point.Errors)
			require.Zero(t, point.TotalTokens)
			require.Zero(t, point.APICostEstimate)
			require.Equal(t, 0, point.Timestamp.Hour())
		}
	}
	hourly := f.request("GET", "timeseries?range=90d&bucket=hour", "", "", f.cookie)
	require.Equal(t, 200, hourly.Code, hourly.Body.String())
	var series struct {
		Data appusage.TimeseriesDTO `json:"data"`
	}
	require.NoError(t, json.Unmarshal(hourly.Body.Bytes(), &series))
	require.LessOrEqual(t, len(series.Data.Points), 2160)
	require.GreaterOrEqual(t, len(series.Data.Points), 2137)
	require.False(t, series.Data.Points[len(series.Data.Points)-1].Timestamp.After(time.Now().UTC()))

	f.failStorage()
	for _, path := range []string{"summary", "models", "timeseries"} {
		result := f.request("GET", path, "", "", f.cookie)
		require.Equal(t, 500, result.Code, result.Body.String())
		require.Contains(t, result.Body.String(), `"error"`)
	}
	failed := f.request("POST", "batch", usageBatch(t, usageWireEvent("failed-storage")), f.pat, nil)
	require.Equal(t, 500, failed.Code, failed.Body.String())
	require.NotContains(t, failed.Body.String(), `"accepted"`)
}
