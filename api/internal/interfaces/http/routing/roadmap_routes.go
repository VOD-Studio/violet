package routing

import (
	"github.com/go-chi/chi/v5"

	"blog-api/internal/domain/permission"
	roadmaphttp "blog-api/internal/interfaces/http/handler/roadmap"
	"blog-api/internal/middleware"
)

func registerRoadmapPublicRoutes(projects chi.Router, handler *roadmaphttp.Handler) {
	projects.Get("/by-slug/{slug}/roadmap", handler.GetBySlug)
}

func registerAdminRoadmapRoutes(projects chi.Router, handler *roadmaphttp.Handler, checker middleware.PermissionChecker) {
	projects.With(middleware.RequirePermission(checker, permission.ProjectUpdate.String())).
		Post("/{projectID}/roadmap/items", handler.Create)
	projects.With(middleware.RequirePermission(checker, permission.ProjectUpdate.String())).
		Put("/{projectID}/roadmap/items/{id}", handler.Update)
}
