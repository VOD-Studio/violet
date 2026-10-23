package routing

import (
	"github.com/go-chi/chi/v5"

	domainapitoken "blog-api/internal/domain/api_token"
	"blog-api/internal/middleware"
)

func registerOMPUsageIngestRoute(r chi.Router, d *Deps) {
	if d.OMPUsage == nil {
		return
	}
	r.With(d.OMPUsageAuth, middleware.RequireScope(domainapitoken.ScopeUsageWrite),
		d.limit("omp-usage", "POST /api/v1/omp-usage/batch")).
		Post("/api/v1/omp-usage/batch", d.OMPUsage.Batch)
}

func registerOMPUsageQueryRoutes(v1 chi.Router, d *Deps) {
	if d.OMPUsage == nil {
		return
	}
	v1.Route("/omp-usage", func(r chi.Router) {
		r.Use(d.SessionAuth)
		r.Get("/summary", d.OMPUsage.Summary)
		r.Get("/models", d.OMPUsage.Models)
		r.Get("/timeseries", d.OMPUsage.Timeseries)
	})
}
