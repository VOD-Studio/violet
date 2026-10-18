package routing

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/permission"
	"blog-api/internal/openapi"
)

type roadmapRouteChecker struct{ checked []string }

func (checker *roadmapRouteChecker) HasPermission(_ string, _ bool, codes ...string) bool {
	checker.checked = append(checker.checked, codes...)
	return false
}

func TestRoadmapRoutesRequireProjectUpdate(t *testing.T) {
	for _, request := range []struct{ method, path string }{
		{http.MethodPost, "/p/roadmap/items"},
		{http.MethodPut, "/p/roadmap/items/i"},
		{http.MethodPost, "/p/roadmap/items/i/move"},
	} {
		t.Run(request.method+request.path, func(t *testing.T) {
			checker := &roadmapRouteChecker{}
			router := chi.NewRouter()
			registerAdminRoadmapRoutes(router, nil, checker)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, httptest.NewRequest(request.method, request.path, nil))
			require.Equal(t, http.StatusForbidden, response.Code)
			assert.Equal(t, []string{permission.ProjectUpdate.String()}, checker.checked)
		})
	}
}

func TestRoadmapSpecDocumentsReadAndWriteContracts(t *testing.T) {
	spec, err := openapi.Spec()
	require.NoError(t, err)
	read := spec.Paths.Find("/projects/by-slug/{slug}/roadmap")
	require.NotNil(t, read)
	require.NotNil(t, read.Get)
	assert.Empty(t, read.Get.Security)
	for path, method := range map[string]string{
		"/admin/projects/{projectID}/roadmap/items":           http.MethodPost,
		"/admin/projects/{projectID}/roadmap/items/{id}":      http.MethodPut,
		"/admin/projects/{projectID}/roadmap/items/{id}/move": http.MethodPost,
	} {
		operation := spec.Paths.Find(path).GetOperation(method)
		require.NotNil(t, operation)
		require.NotNil(t, operation.Security)
		assert.NotEmpty(t, *operation.Security)
		foundCSRF := false
		for _, parameter := range operation.Parameters {
			if parameter.Value != nil && parameter.Value.Name == "X-CSRF-Token" && parameter.Value.Required {
				foundCSRF = true
			}
		}
		assert.True(t, foundCSRF, "%s %s must document CSRF", method, path)
	}
	item := spec.Components.Schemas["RoadmapItemDTO"].Value
	assert.Equal(t, "date", item.Properties["completion_date"].Value.Format)
	assert.True(t, item.Properties["completion_date"].Value.Nullable)
}
