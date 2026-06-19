// Package stats 提供 stats 模块的 HTTP handler。
package stats

import (
	"net/http"

	appstats "blog-api/internal/application/stats"
	"blog-api/internal/interfaces/http/response"
)

// Handler 仪表盘统计 HTTP handler
type Handler struct {
	svc *appstats.Service
}

// NewHandler 构造统计 handler
func NewHandler(svc *appstats.Service) *Handler {
	return &Handler{svc: svc}
}

// GetDashboardStats 后台总览统计
func (h *Handler) GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetDashboard(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// GetViewTrends 浏览量趋势
func (h *Handler) GetViewTrends(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetViewTrends(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}
