package routing

import (
	"github.com/go-chi/chi/v5"

	"blog-api/internal/domain/permission"
	"blog-api/internal/middleware"
)

// registerPresencePublicRoutes 注册实时状态公开读取、推送与 Nowbeam 上报端点。
//
// 上报是 GET 升级，不经 CSRF 校验；鉴权只认设备凭证，在 handler 内与连接注册同锁完成。
func registerPresencePublicRoutes(r chi.Router, d *Deps) {
	if d.Presence == nil || d.PresenceIngest == nil {
		return
	}
	r.Route("/presence", func(r chi.Router) {
		r.Get("/", d.Presence.Public)
		r.With(d.limit("presence-stream", "GET /api/v1/presence/stream")).Get("/stream", d.Presence.Stream)
		r.With(d.limit("presence-ingest", "GET /api/v1/presence/ingest")).Get("/ingest", d.PresenceIngest.Ingest)
	})
}

func registerPresenceAdminRoutes(r chi.Router, d *Deps) {
	if d.Presence == nil {
		return
	}
	h := d.Presence
	r.Route("/presence", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(d.PermissionChecker, permission.PresenceView.String()))
			r.Get("/devices", h.ListDevices)
			r.Get("/settings", h.Settings)
		})
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(d.PermissionChecker, permission.PresenceManage.String()))
			r.Post("/devices", h.IssueDevice)
			r.Delete("/devices/{id}", h.RevokeDevice)
			r.Put("/settings", h.UpdateSettings)
		})
	})
}
