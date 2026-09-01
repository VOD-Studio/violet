package routing

import (
	"net/http"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/require"

	"blog-api/internal/middleware"
)

type galleryRoutePermissionChecker struct{}

func (galleryRoutePermissionChecker) HasPermission(string, bool, ...string) bool { return true }

func TestGalleryRoutesExposeAnonymousReadsAndManagedMaintenance(t *testing.T) {
	public := chi.NewRouter()
	registerGalleryPublicRoutes(public, &Deps{})
	publicRoutes := routeMethods(t, public)
	require.Contains(t, publicRoutes, "GET /galleries/")
	require.Contains(t, publicRoutes, "GET /galleries/{slug}")

	admin := chi.NewRouter()
	registerAdminGalleryRoutes(admin, nil, galleryRoutePermissionChecker{})
	adminRoutes := routeMethods(t, admin)
	require.Contains(t, adminRoutes, "POST /galleries/{id}/publish")
	require.Contains(t, adminRoutes, "POST /galleries/{id}/unpublish")
	require.Contains(t, adminRoutes, "DELETE /galleries/{id}")
}

func routeMethods(t *testing.T, router chi.Routes) []string {
	t.Helper()
	routes := make([]string, 0)
	err := chi.Walk(router, func(method, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		routes = append(routes, method+" "+route)
		return nil
	})
	require.NoError(t, err)
	return routes
}

var _ middleware.PermissionChecker = galleryRoutePermissionChecker{}
