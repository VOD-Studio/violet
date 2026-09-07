package routing

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"blog-api/config"
	appauth "blog-api/internal/application/auth/command"
	appsiteimpression "blog-api/internal/application/siteimpression"
	domainsiteimpression "blog-api/internal/domain/siteimpression"
	authhttp "blog-api/internal/interfaces/http/handler/auth"
	siteimpressionhttp "blog-api/internal/interfaces/http/handler/siteimpression"
	"blog-api/internal/middleware"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type routeSiteImpressionRepository struct {
	hashes map[domainsiteimpression.TokenHash]struct{}
}

func (r *routeSiteImpressionRepository) Ensure(_ context.Context, hash domainsiteimpression.TokenHash) error {
	r.hashes[hash] = struct{}{}
	return nil
}

func (r *routeSiteImpressionRepository) Count(context.Context) (int64, error) {
	return int64(len(r.hashes)), nil
}

func (r *routeSiteImpressionRepository) Contains(_ context.Context, hash domainsiteimpression.TokenHash) (bool, error) {
	_, exists := r.hashes[hash]
	return exists, nil
}

func TestSiteImpressionRouteSupportsAnonymousCSRFFlow(t *testing.T) {
	cookieConfig := config.CookieConfig{CSRFName: "violet_csrf", SameSite: "lax"}
	authHandler := authhttp.NewHandler(
		nil, nil, nil, nil, nil, nil,
		nil, nil, nil, nil, nil, nil, nil,
		appauth.NewOAuthCredentials("", "", ""),
		cookieConfig,
		config.SessionConfig{},
	)
	impressionHandler := siteimpressionhttp.NewHandler(
		appsiteimpression.NewService(
			&routeSiteImpressionRepository{hashes: make(map[domainsiteimpression.TokenHash]struct{})},
			[]byte("site-impression-token-key"),
		),
		cookieConfig,
	)
	passThrough := func(next http.Handler) http.Handler { return next }

	router := chi.NewRouter()
	router.Route("/api/v1", func(v1 chi.Router) {
		v1.Use(middleware.CSRF(cookieConfig, nil))
		v1.Get("/auth/csrf-token", authHandler.GetCSRFToken)
		registerSiteImpressionRoutes(v1, &Deps{
			SiteImpression:      impressionHandler,
			SiteImpressionLimit: passThrough,
		})
	})

	missingCSRF := httptest.NewRecorder()
	router.ServeHTTP(missingCSRF, httptest.NewRequest(http.MethodPost, "/api/v1/site-impressions", nil))
	assert.Equal(t, http.StatusForbidden, missingCSRF.Code)

	csrfResponse := httptest.NewRecorder()
	router.ServeHTTP(csrfResponse, httptest.NewRequest(http.MethodGet, "/api/v1/auth/csrf-token", nil))
	require.Equal(t, http.StatusOK, csrfResponse.Code)
	var csrfBody struct {
		Data struct {
			Token string `json:"csrf_token"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(csrfResponse.Body.Bytes(), &csrfBody))
	require.NotEmpty(t, csrfBody.Data.Token)
	var csrfCookie *http.Cookie
	for _, cookie := range csrfResponse.Result().Cookies() {
		if cookie.Name == cookieConfig.CSRFName {
			csrfCookie = cookie
			break
		}
	}
	require.NotNil(t, csrfCookie)

	impressionRequest := httptest.NewRequest(http.MethodPost, "/api/v1/site-impressions", nil)
	impressionRequest.AddCookie(csrfCookie)
	impressionRequest.Header.Set(middleware.CSRFHeaderName, csrfBody.Data.Token)
	impressionResponse := httptest.NewRecorder()
	router.ServeHTTP(impressionResponse, impressionRequest)
	require.Equal(t, http.StatusOK, impressionResponse.Code)
	assert.Contains(t, impressionResponse.Body.String(), `"impressed":true`)
	assert.Contains(t, impressionResponse.Header().Get("Set-Cookie"), "violet_impression=")
}
