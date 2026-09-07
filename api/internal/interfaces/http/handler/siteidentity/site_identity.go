// Package siteidentity 提供公开站点身份 HTTP 适配。
package siteidentity

import (
	"net/http"

	appsiteidentity "blog-api/internal/application/siteidentity"
	"blog-api/internal/interfaces/http/response"
)

const cacheControl = "public, max-age=60, stale-while-revalidate=300"

// Handler 处理站点身份公开读取请求。
type Handler struct {
	service *appsiteidentity.Service
}

// NewHandler 绑定站点身份读取服务。
func NewHandler(service *appsiteidentity.Service) *Handler {
	return &Handler{service: service}
}

// Get 返回首页直接消费的站点身份。
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	identity, err := h.service.Get(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := response.WriteCacheableJSON(w, r, cacheControl, response.Envelope{Data: identity}); err != nil {
		response.RespondError(w, r, err)
	}
}
