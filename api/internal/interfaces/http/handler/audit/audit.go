// Package audit 提供 audit 模块的 HTTP handler。
package audit

import (
	"encoding/json"
	"net/http"
	"strconv"

	appaudit "blog-api/internal/application/audit"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
)

// Handler 操作日志 HTTP handler
type Handler struct {
	svc *appaudit.Service
}

// NewHandler 构造日志 handler
func NewHandler(svc *appaudit.Service) *Handler {
	return &Handler{svc: svc}
}

// ListLogs 操作日志列表（后台）
func (h *Handler) ListLogs(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	result, err := h.svc.List(r.Context(), page, limit)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"data": result.Logs, "total": result.Total, "page": page, "limit": limit,
	})
}

// ListLogsByUser 指定用户操作日志（后台）
func (h *Handler) ListLogsByUser(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("id")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	result, err := h.svc.ListByUser(r.Context(), userID, page, limit)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"data": result.Logs, "total": result.Total, "page": page, "limit": limit,
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
