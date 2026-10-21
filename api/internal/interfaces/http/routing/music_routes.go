package routing

import (
	"time"

	"github.com/go-chi/chi/v5"

	"blog-api/internal/domain/permission"
	"blog-api/internal/middleware"
)

func registerMusicPublicRoutes(r chi.Router, d *Deps) {
	if d.Music == nil {
		return
	}
	h := d.Music
		r.Route("/music", func(r chi.Router) {
			r.Get("/playback", h.PublicPlayback)
			r.Get("/playlists", h.PublicPlaylists)
		r.Group(func(r chi.Router) {
			r.Use(middleware.RateLimit("music_public", d.Redis, time.Minute, 60))
			r.Get("/playlists/{id}/tracks", h.PublicTracks)
			r.Get("/songs/{id}", h.Song)
			r.Get("/songs/{id}/lyric", h.Lyric)
		})
		r.Group(func(r chi.Router) {
			// 播放解析单独收紧：单 IP 20 次/分钟；全站聚合 30 次/分钟，
			// 避免站点账号取链形态被上游识别为机器批量行为。
			r.Use(middleware.RateLimit("music_playback", d.Redis, time.Minute, 20))
			r.Use(middleware.GlobalRateLimit("music_resolve", d.Redis, time.Minute, 30))
			r.Get("/songs/{id}/url", h.SongURL)
			r.Get("/songs/{id}/stream", h.SongStream)
		})
	})
}
func registerMusicAdminRoutes(r chi.Router, d *Deps) {
	if d.Music == nil {
		return
	}
	h := d.Music
	r.Route("/music", func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(d.PermissionChecker, permission.MusicView.String()))
			r.Get("/status", h.Status)
			r.Get("/account", h.Account)
			r.Get("/library/playlists", h.UserPlaylists)
			r.Get("/library/search", h.Search)
			r.Get("/library/playlists/{id}/tracks", h.AdminTracks)
			r.Get("/playlists", h.Featured)
		})
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequirePermission(d.PermissionChecker, permission.MusicManage.String()))
			r.Post("/verify", h.Verify)
			r.Post("/login/qr", h.LoginQR)
			r.Post("/login/qr/{id}/check", h.CheckQR)
			r.Delete("/login/qr/{id}", h.CancelQR)
			r.Post("/account/refresh", h.Refresh)
			r.Delete("/account", h.Logout)
			r.Post("/playlists", h.AddFeatured)
			r.Patch("/playlists/{id}", h.SetEnabled)
			r.Put("/playlists/order", h.OrderFeatured)
			r.Delete("/playlists/{id}", h.RemoveFeatured)
		})
	})
}
