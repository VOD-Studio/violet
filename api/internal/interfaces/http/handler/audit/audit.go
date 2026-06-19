// Package audit 提供 audit 模块的 HTTP handler。
package audit

import (
	"net/http"

	appaudit "blog-api/internal/application/audit"
	"blog-api/internal/interfaces/http/response"
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
	page, limit := response.ParsePaging(r)
	result, err := h.svc.List(r.Context(), page, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, result.Logs, page, limit, result.Total)
}

// ListLogsByUser 指定用户操作日志（后台）
func (h *Handler) ListLogsByUser(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("id")
	page, limit := response.ParsePaging(r)
	result, err := h.svc.ListByUser(r.Context(), userID, page, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, result.Logs, page, limit, result.Total)
}
