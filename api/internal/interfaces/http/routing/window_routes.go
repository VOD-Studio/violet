package routing

import (
	"github.com/go-chi/chi/v5"

	"blog-api/internal/middleware"
)

// registerWindowPublicRoutes 注册窗的公开读取与敲窗端点；敲窗按访客每小时一次。
func registerWindowPublicRoutes(r chi.Router, d *Deps) {
	if d.Window == nil {
		return
	}
	r.Route("/window", func(r chi.Router) {
		r.Get("/", d.Window.Public)
		r.With(d.limit("window-knock", "POST /api/v1/window/knock")).Post("/knock", d.Window.Knock)
	})
}

// registerWindowAdminRoutes 注册窗的后台配置端点，与站点设置同权限域。
func registerWindowAdminRoutes(r chi.Router, d *Deps) {
	if d.Window == nil {
		return
	}
	h := d.Window
	r.Route("/window", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(d.PermissionChecker, "settings:view"))
			r.Get("/", h.Get)
			r.Get("/cities", h.SearchCities)
		})
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(d.PermissionChecker, "settings:update"))
			r.Put("/", h.Update)
		})
	})
}
