// Package stats 提供 stats 模块的 HTTP handler。
package stats

import (
	"encoding/json"
	"net/http"

	appstats "blog-api/internal/application/stats"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
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
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": data})
}

// GetViewTrends 浏览量趋势
func (h *Handler) GetViewTrends(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetViewTrends(r.Context())
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": data})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
