package routing

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"blog-api/config"
	appsiteidentity "blog-api/internal/application/siteidentity"
	siteidentityhttp "blog-api/internal/interfaces/http/handler/siteidentity"
	"blog-api/internal/middleware"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type emptySiteIdentitySettings struct{}

func (emptySiteIdentitySettings) GetAll(context.Context) (map[string]string, error) {
	return map[string]string{}, nil
}

func TestSiteIdentityRouteIsAnonymous(t *testing.T) {
	handler := siteidentityhttp.NewHandler(appsiteidentity.NewService(emptySiteIdentitySettings{}))
	router := chi.NewRouter()
	router.Use(middleware.CSRF(config.CookieConfig{CSRFName: "csrf"}, nil))
	router.Route("/api/v1", func(v1 chi.Router) {
		registerSiteIdentityRoutes(v1, &Deps{SiteIdentity: handler})
	})

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/site-identity", nil))
	require.Equal(t, http.StatusOK, response.Code)
	assert.Contains(t, response.Body.String(), `"site_name":"Violet"`)
}
