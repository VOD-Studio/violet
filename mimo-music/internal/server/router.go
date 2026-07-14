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
// 注册了 recovery / request_id / logger 中间件（后续 issue 补充），
// 以及 GET /health 端点。后续 issue 会在此添加 auth / playlist / song / search 路由组。
func NewRouter() http.Handler {
	r := chi.NewRouter()

	// 中间件
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.RequestID)
	r.Use(servermiddleware.Logging)

	// 路由
	r.Get("/health", handler.Health)

	return r
}
