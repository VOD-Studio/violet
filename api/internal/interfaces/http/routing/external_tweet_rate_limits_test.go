package routing

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	appsettings "blog-api/internal/application/settings"
	apptweet "blog-api/internal/application/tweet"
	domainsettings "blog-api/internal/domain/settings"
	domaintweet "blog-api/internal/domain/tweet"
	persistence "blog-api/internal/infrastructure/persistence/gorm"
	"blog-api/internal/infrastructure/persistence/gorm/model"
	"blog-api/internal/infrastructure/xtweet"
	tweethttp "blog-api/internal/interfaces/http/handler/tweet"
	"blog-api/internal/middleware"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestExternalReadQuotaDoesNotConsumePreviewBudget(t *testing.T) {
	ctx := context.Background()
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = sqlDB.Close() })
	require.NoError(t, db.AutoMigrate(&model.ExternalTweet{}))
	repo := persistence.NewExternalTweetRepository(db)
	const sourceID = "1234567890123456789"
	external, err := repo.Ensure(ctx, sourceID, time.Now().Add(time.Hour))
	require.NoError(t, err)
	previousVersion := external.Version
	external.Version = uuid.NewString()
	external.Availability = domaintweet.ExternalAvailable
	external.FetchedAt = time.Now()
	external.Snapshot = &domaintweet.ExternalSnapshot{
		Text: "缓存中的原文", Completeness: domaintweet.TextComplete,
	}
	saved, err := repo.SaveSnapshot(ctx, external, previousVersion)
	require.NoError(t, err)
	require.True(t, saved)
	service := apptweet.NewService(nil, nil, nil, nil, nil, nil, nil, nil, nil).
		WithExternal(apptweet.NewExternalService(repo, nil, nil, xtweet.NewPreviewStore(client)))
	policies := appsettings.NewRuntimePolicies(&routeRuntimeStore{
		records: map[domainsettings.RuntimeGroup]domainsettings.RuntimeRecord{
			domainsettings.RateLimitGroup: {
				Overrides: json.RawMessage(`{"rules":{"x-preview-minute":{"max_requests":2},"x-preview-day":{"max_requests":3}}}`),
			},
		},
	}, domainsettings.CodeRunnerPolicy{
		Enabled: true, MaxCPUCores: 1, MaxMemoryMB: 256, MaxTimeoutSecs: 30,
		MaxOutputBytes: 1 << 20, MaxSourceBytes: 1 << 20, MaxConcurrent: 1,
		QueueTimeoutSecs: 10, TaskTTLSecs: 3600, Languages: []string{"python"},
	}, nil)
	deps := &Deps{
		Redis: client, RateLimits: middleware.NewRateLimiter(client, policies),
		Tweet: tweethttp.NewHandler(service),
		SessionAuth: func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				userID := r.Header.Get("X-Test-User")
				if userID == "" {
					w.WriteHeader(http.StatusUnauthorized)
					return
				}
				next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), middleware.UserIDKey, userID)))
			})
		},
		OptionalAuth: func(next http.Handler) http.Handler { return next },
	}
	router := chi.NewRouter()
	router.Route("/api/v1", func(r chi.Router) { registerTweetRoutes(r, deps) })
	require.NoError(t, policies.Initialize(ctx))
	request := func(method, userID string) *httptest.ResponseRecorder {
		path := "/api/v1/tweets/external/resolve?url=https://x.com/i/status/" + sourceID
		if method == http.MethodPost {
			path = "/api/v1/tweets/external/preview"
		}
		r := httptest.NewRequest(method, path, strings.NewReader(`{"url":"https://x.com/i/status/`+sourceID+`"}`))
		r.Header.Set("X-Test-User", userID)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, r)
		return w
	}
	require.Equal(t, http.StatusUnauthorized, request(http.MethodGet, "").Code)
	reader := uuid.NewString()
	for range 8 {
		response := request(http.MethodGet, reader)
		require.Equal(t, http.StatusOK, response.Code, response.Body.String())
		require.Contains(t, response.Body.String(), "缓存中的原文")
	}
	for range 2 {
		response := request(http.MethodPost, reader)
		require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	}
	require.Equal(t, http.StatusTooManyRequests, request(http.MethodPost, reader).Code)
	require.Equal(t, http.StatusOK, request(http.MethodGet, reader).Code)

	version := uint64(0)
	_, err = policies.UpdateRateLimit(ctx, appsettings.RuntimeUpdate{
		ExpectedVersion: &version,
		Values:          json.RawMessage(`{"rules":{"x-resolve":{"max_requests":2}}}`),
	})
	require.NoError(t, err)
	otherReader := uuid.NewString()
	for range 2 {
		require.Equal(t, http.StatusOK, request(http.MethodGet, otherReader).Code)
	}
	require.Equal(t, http.StatusTooManyRequests, request(http.MethodGet, otherReader).Code)
	require.Equal(t, http.StatusOK, request(http.MethodPost, otherReader).Code)
	require.Equal(t, http.StatusOK, request(http.MethodGet, uuid.NewString()).Code)
}
