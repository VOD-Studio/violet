package routing

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/require"

	"blog-api/config"
	apptweet "blog-api/internal/application/tweet"
	tweethttp "blog-api/internal/interfaces/http/handler/tweet"
	"blog-api/internal/middleware"
)

func TestTweetViewRouteAllowsAnonymousCSRF(t *testing.T) {
	cfg := config.CookieConfig{CSRFName: "violet_csrf"}
	svc := apptweet.NewService(nil, nil, nil, nil, nil, nil, nil, nil, nil)
	pass := func(next http.Handler) http.Handler { return next }
	reject := func(http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusUnauthorized)
		})
	}
	router := chi.NewRouter()
	router.Route("/api/v1", func(r chi.Router) {
		r.Use(middleware.CSRF(cfg, nil))
		registerTweetRoutes(r, &Deps{
			Tweet:        tweethttp.NewHandler(svc).WithViewIdentity(middleware.HashedIPIdentity([]byte("test key"))),
			SessionAuth:  reject,
			OptionalAuth: pass,
		})
	})

	post := func(csrf bool) *httptest.ResponseRecorder {
		r := httptest.NewRequest(http.MethodPost, "/api/v1/tweets/invalid-id/views", nil)
		if csrf {
			r.AddCookie(&http.Cookie{Name: cfg.CSRFName, Value: "token"})
			r.Header.Set(middleware.CSRFHeaderName, "token")
		}
		w := httptest.NewRecorder()
		router.ServeHTTP(w, r)
		return w
	}
	require.Equal(t, http.StatusForbidden, post(false).Code)
	w := post(true)
	require.Equal(t, http.StatusBadRequest, w.Code, "after CSRF, an anonymous request reaches ID validation")
	require.Equal(t, "no-store", w.Header().Get("Cache-Control"))
}
