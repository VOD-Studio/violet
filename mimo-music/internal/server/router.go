// Package server 提供 mimo-music 的 HTTP 服务装配。
package server

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"

	"github.com/VOD-Studio/mimo-music/internal/server/handler"
	servermiddleware "github.com/VOD-Studio/mimo-music/internal/server/middleware"
	"github.com/VOD-Studio/mimo-music/observability"
)

// NewRouter 创建并配置 chi 路由器。
//
// 最外层用 otelhttp 包装：从入站请求的 W3C traceparent 头提取 trace context，
// 让外部调用方（mimo-blog 或任何 OTel-instrumented client）发起的请求在
// mimo-music 侧产生的 span 成为调用方 span 的子 span，形成完整链路。
//
// 内层中间件：recovery / request_id / 访问日志 / Prometheus 指标。
// 路由：health / metrics / auth / playlist / song / search / album / artist / recommend / fm。
func NewRouter(h *handler.Handler, m *observability.Metrics) http.Handler {
	r := chi.NewRouter()

	// 中间件
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.RequestID)
	r.Use(servermiddleware.Logging)
	r.Use(servermiddleware.Metrics(m))

	// health
	r.Get("/health", handler.Health)

	// Prometheus 指标端点（不走 metrics 中间件，避免自身递归）
	r.Method("GET", "/metrics", handler.Metrics())

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

	// 专辑
	r.Get("/api/v1/albums/{id}", h.GetAlbum)

	// 歌手
	r.Get("/api/v1/artists/{id}", h.GetArtist)

	// 每日推荐（需登录）
	r.Get("/api/v1/recommend/daily", h.GetDailyRecommend)

	// 私人 FM（需登录）
	r.Get("/api/v1/fm", h.GetPersonalFM)

	// otelhttp.NewHandler 在最外层提取入站 traceparent，创建 server span。
	// 调用方（mimo-blog 或任何 OTel-instrumented client）注入的 W3C trace context
	// 在这里被提取，本服务内的 span 成为调用方 span 的子 span。
	// span 名用 method + path（如 GET /api/v1/playlists/123），便于在 trace UI 区分。
	return otelhttp.NewHandler(r, "router",
		otelhttp.WithSpanNameFormatter(func(operation string, r *http.Request) string {
			return r.Method + " " + r.URL.Path
		}),
	)
}
