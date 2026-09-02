package routing

import (
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/require"
)

func TestNoteRoutesExposeAnonymousReadsAndManagedMaintenance(t *testing.T) {
	public := chi.NewRouter()
	registerNotePublicRoutes(public, &Deps{})
	publicRoutes := routeMethods(t, public)
	require.Contains(t, publicRoutes, "GET /notes/")
	require.Contains(t, publicRoutes, "GET /notes/{id}")

	admin := chi.NewRouter()
	registerAdminNoteRoutes(admin, nil, noteRoutePermissionChecker{})
	adminRoutes := routeMethods(t, admin)
	require.Contains(t, adminRoutes, "GET /notes/")
	require.Contains(t, adminRoutes, "GET /notes/{id}")
	require.Contains(t, adminRoutes, "POST /notes/")
	require.Contains(t, adminRoutes, "PUT /notes/{id}")
	require.Contains(t, adminRoutes, "POST /notes/{id}/publish")
	require.Contains(t, adminRoutes, "DELETE /notes/{id}")
}

type noteRoutePermissionChecker struct{}

func (noteRoutePermissionChecker) HasPermission(string, bool, ...string) bool { return true }

var _ = noteRoutePermissionChecker{}.HasPermission
