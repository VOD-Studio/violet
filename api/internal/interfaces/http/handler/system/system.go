// Package system 提供服务器监控的 HTTP handler。
package system

import (
	"net/http"

	appsystem "blog-api/internal/application/system"
	"blog-api/internal/interfaces/http/response"
)

// Handler 服务器监控 HTTP handler
type Handler struct {
	svc *appsystem.Service
}

// NewHandler 构造监控 handler
func NewHandler(svc *appsystem.Service) *Handler {
	return &Handler{svc: svc}
}

// GetSnapshot 实时快照 GET /admin/system/snapshot
func (h *Handler) GetSnapshot(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetSnapshot(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// GetHistory 历史趋势 GET /admin/system/history
func (h *Handler) GetHistory(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetHistory(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}
