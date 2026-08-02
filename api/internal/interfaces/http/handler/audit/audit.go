// Package audit 提供操作日志的 HTTP handler。
package audit

import (
	"net/http"

	appaudit "blog-api/internal/application/audit"
	domainaudit "blog-api/internal/domain/audit"
	"blog-api/internal/interfaces/http/response"
)

// Handler 操作日志 HTTP handler
type Handler struct {
	query *appaudit.Query
}

// NewHandler 构造操作日志 handler
func NewHandler(query *appaudit.Query) *Handler {
	return &Handler{query: query}
}

// ListEvents 操作日志列表（后台）
//
// 支持按 action / resource_type / actor（user_id）过滤。
func (h *Handler) ListEvents(w http.ResponseWriter, r *http.Request) {
	page, limit := response.ParsePaging(r)
	filter := parseFilter(r)
	result, err := h.query.ListFiltered(r.Context(), filter, page, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, result.Events, page, limit, result.Total)
}

// ListEventsByActor 指定用户操作日志（后台）
func (h *Handler) ListEventsByActor(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("id")
	page, limit := response.ParsePaging(r)
	result, err := h.query.ListByActor(r.Context(), userID, page, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, result.Events, page, limit, result.Total)
}

// parseFilter 从 query 解析筛选条件（action/resource_type/actor）
func parseFilter(r *http.Request) domainaudit.ListFilter {
	filter := domainaudit.ListFilter{}
	if v := r.URL.Query().Get("action"); v != "" {
		filter.Action = &v
	}
	if v := r.URL.Query().Get("resource_type"); v != "" {
		filter.ResourceType = &v
	}
	if v := r.URL.Query().Get("actor"); v != "" {
		filter.ActorUserID = &v
	}
	return filter
}
