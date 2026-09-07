package routing

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"blog-api/config"
	apppublication "blog-api/internal/application/publication"
	domainpublication "blog-api/internal/domain/publication"
	publicationhttp "blog-api/internal/interfaces/http/handler/publication"
	"blog-api/internal/middleware"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/require"
)

func TestPublicationRouteIsAnonymous(t *testing.T) {
	handler := publicationhttp.NewHandler(
		apppublication.NewService(emptyPublicationRepository{}, []byte("test")),
	)
	router := chi.NewRouter()
	router.Use(middleware.CSRF(config.CookieConfig{CSRFName: "csrf"}, nil))
	router.Route("/api/v1", func(v1 chi.Router) {
		registerPublicationRoutes(v1, &Deps{Publication: handler})
	})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/publications", nil))
	require.Equal(t, http.StatusOK, response.Code)
	var body struct {
		Data []apppublication.ItemDTO `json:"data"`
	}
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &body))
	require.Empty(t, body.Data)
}

type emptyPublicationRepository struct{}

func (emptyPublicationRepository) FindPage(context.Context, domainpublication.Query) ([]domainpublication.Entry, error) {
	return nil, nil
}
