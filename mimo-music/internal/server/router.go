// Package server 提供 mimo-music 的 HTTP 服务装配。
package server

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"

	"github.com/VOD-Studio/mimo-music/internal/server/handler"
	servermiddleware "github.com/VOD-Studio/mimo-music/internal/server/middleware"
)

// NewRouter 创建并配置 chi 路由器。
//
// 中间件：recovery / request_id / 访问日志。
// 路由：health / auth。
// 后续 issue 会在此添加 playlist / song / search 路由组。
func NewRouter(h *handler.Handler) http.Handler {
	r := chi.NewRouter()

	// 中间件
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.RequestID)
	r.Use(servermiddleware.Logging)

	// health
	r.Get("/health", handler.Health)

	// auth 路由组
	r.Route("/api/v1/auth", func(r chi.Router) {
		r.Post("/captcha", h.SendCaptcha)
		r.Post("/login/cellphone", h.LoginCellphone)
		r.Get("/login/qrcode", h.LoginQrcode)
		r.Get("/login/qrcode/check", h.LoginQrcodeCheck)
		r.Get("/status", h.LoginStatus)
		r.Post("/logout", h.Logout)
	})

	// 歌单
	r.Get("/api/v1/playlists/{id}", h.GetPlaylist)

	// 歌曲
	r.Get("/api/v1/songs/{id}", h.GetSongDetail)
	r.Get("/api/v1/songs/{id}/url", h.GetSongURL)
	r.Get("/api/v1/songs/{id}/lyric", h.GetLyric)

	// 搜索
	r.Get("/api/v1/search", h.Search)

	return r
}
