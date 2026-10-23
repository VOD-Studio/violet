package routing

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	appmedia "blog-api/internal/application/media"
	appsettings "blog-api/internal/application/settings"
	domainsettings "blog-api/internal/domain/settings"
	mediahttp "blog-api/internal/interfaces/http/handler/media"
	settingshttp "blog-api/internal/interfaces/http/handler/settings"
	"blog-api/internal/middleware"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type routeRuntimeStore struct {
	records   map[domainsettings.RuntimeGroup]domainsettings.RuntimeRecord
	effective map[domainsettings.RuntimeGroup]domainsettings.RuntimeEffective
}

func (s *routeRuntimeStore) Load(_ context.Context, group domainsettings.RuntimeGroup) (domainsettings.RuntimeRecord, error) {
	if record, ok := s.records[group]; ok {
		return record, nil
	}
	return domainsettings.RuntimeRecord{Overrides: json.RawMessage(`{}`)}, nil
}

func (s *routeRuntimeStore) CompareAndSwap(_ context.Context, group domainsettings.RuntimeGroup, version uint64, overrides json.RawMessage) (domainsettings.RuntimeRecord, error) {
	if s.records[group].Version != version {
		return domainsettings.RuntimeRecord{}, domainsettings.ErrRuntimeConflict
	}
	record := domainsettings.RuntimeRecord{Version: version + 1, Overrides: append(json.RawMessage(nil), overrides...)}
	s.records[group] = record
	return record, nil
}

func (*routeRuntimeStore) LoadLegacyRunner(context.Context) (map[string]string, error) {
	return map[string]string{}, nil
}

func (s *routeRuntimeStore) LoadEffective(_ context.Context, group domainsettings.RuntimeGroup) (*domainsettings.RuntimeEffective, error) {
	value, ok := s.effective[group]
	if !ok {
		return nil, nil
	}
	value.Values = append(json.RawMessage(nil), value.Values...)
	return &value, nil
}

func (s *routeRuntimeStore) SaveEffective(_ context.Context, group domainsettings.RuntimeGroup, value domainsettings.RuntimeEffective) error {
	if s.effective == nil {
		s.effective = make(map[domainsettings.RuntimeGroup]domainsettings.RuntimeEffective)
	}
	value.Values = append(json.RawMessage(nil), value.Values...)
	s.effective[group] = value
	return nil
}

func TestUploadQuotaDoesNotBlockCancellationStatusOrPolicy(t *testing.T) {
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	policies := appsettings.NewRuntimePolicies(&routeRuntimeStore{records: make(map[domainsettings.RuntimeGroup]domainsettings.RuntimeRecord)}, domainsettings.CodeRunnerPolicy{
		Enabled: true, MaxCPUCores: 1, MaxMemoryMB: 256, MaxTimeoutSecs: 30,
		MaxOutputBytes: 1 << 20, MaxSourceBytes: 1 << 20, MaxConcurrent: 1,
		QueueTimeoutSecs: 10, TaskTTLSecs: 3600, Languages: []string{"python"},
	}, nil)
	deps := &Deps{
		Redis: client, RateLimits: middleware.NewRateLimiter(client, policies),
		RuntimeSettings: settingshttp.NewRuntimeHandler(policies),
		Media:           mediahttp.NewHandler(nil, appmedia.NewUploadService(nil, nil, nil, nil, t.TempDir(), t.TempDir(), "/uploads/")),
		SessionAuth: func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Header.Get("X-Test-User") == "" {
					w.WriteHeader(http.StatusUnauthorized)
					return
				}
				next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), middleware.UserIDKey, "test-user")))
			})
		},
	}
	router := chi.NewRouter()
	router.Route("/api/v1", func(r chi.Router) { registerMediaRoutes(r, deps) })
	require.NoError(t, policies.Initialize(context.Background()))
	request := func(method, path string, authenticated bool) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, strings.NewReader(`{}`))
		r.RemoteAddr = "192.0.2.1:1234"
		if authenticated {
			r.Header.Set("X-Test-User", "reader")
		}
		w := httptest.NewRecorder()
		router.ServeHTTP(w, r)
		return w
	}
	assert.Equal(t, http.StatusUnauthorized, request(http.MethodGet, "/api/v1/uploads/policy", false).Code)
	for range 30 {
		response := request(http.MethodPost, "/api/v1/uploads/", true)
		require.NotEqual(t, http.StatusTooManyRequests, response.Code)
	}
	for _, endpoint := range []struct{ method, path string }{
		{http.MethodPost, "/api/v1/uploads/"},
		{http.MethodPut, "/api/v1/uploads/invalid/chunks/0"},
		{http.MethodPost, "/api/v1/uploads/invalid/complete"},
		{http.MethodPost, "/api/v1/uploads/thumbnail"},
		{http.MethodPost, "/api/v1/uploads/replace"},
		{http.MethodPost, "/api/v1/uploads/emoji"},
	} {
		assert.Equal(t, http.StatusTooManyRequests, request(endpoint.method, endpoint.path, true).Code)
	}
	for _, method := range []string{http.MethodDelete, http.MethodGet} {
		response := request(method, "/api/v1/uploads/invalid", true)
		assert.NotEqual(t, http.StatusTooManyRequests, response.Code)
		assert.NotEqual(t, http.StatusNotFound, response.Code)
	}
	response := request(http.MethodGet, "/api/v1/uploads/policy", true)
	require.Equal(t, http.StatusOK, response.Code)
	var body struct {
		Data struct {
			MaxConcurrentFiles int `json:"max_concurrent_files"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &body))
	assert.Equal(t, 3, body.Data.MaxConcurrentFiles)
}
