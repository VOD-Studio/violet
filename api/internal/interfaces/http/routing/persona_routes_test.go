package routing

import (
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/require"

	"blog-api/internal/middleware"
)

type personaRoutePermissionChecker struct{}

func (personaRoutePermissionChecker) HasPermission(string, bool, ...string) bool { return true }

func TestPersonaRoutesExposeOnePublicReadAndManagedDocuments(t *testing.T) {
	public := chi.NewRouter()
	registerPersonaPublicRoute(public, &Deps{})
	publicRoutes := routeMethods(t, public)
	require.Equal(t, []string{"GET /persona"}, publicRoutes)

	admin := chi.NewRouter()
	registerAdminPersonaRoutes(admin, nil, personaRoutePermissionChecker{})
	adminRoutes := routeMethods(t, admin)
	require.Contains(t, adminRoutes, "GET /personas/")
	require.Contains(t, adminRoutes, "POST /personas/")
	require.Contains(t, adminRoutes, "GET /personas/{id}")
	require.Contains(t, adminRoutes, "PUT /personas/{id}")
	require.Contains(t, adminRoutes, "POST /personas/{id}/activate")
	require.Contains(t, adminRoutes, "DELETE /personas/{id}")
}

var _ middleware.PermissionChecker = personaRoutePermissionChecker{}
