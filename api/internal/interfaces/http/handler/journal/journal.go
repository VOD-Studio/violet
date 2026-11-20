// Package journal 将手记时间线的公开用例适配为 HTTP。
package journal

import (
	"net/http"

	appjournal "blog-api/internal/application/journal"
	"blog-api/internal/interfaces/http/response"
)

type Handler struct {
	service *appjournal.Service
}

func NewHandler(service *appjournal.Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Browse(w http.ResponseWriter, r *http.Request) {
	cursor, limit := response.ParseCursor(r)
	query := r.URL.Query()
	page, err := h.service.Browse(r.Context(), appjournal.Query{
		Cursor: cursor, Limit: limit, Type: query.Get("type"),
		Tag: query.Get("tag"), ProjectID: query.Get("project_id"),
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, page)
}

func (h *Handler) GetDay(w http.ResponseWriter, r *http.Request) {
	day, err := h.service.GetDay(r.Context(), r.PathValue("projectId"), r.PathValue("day"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, day)
}

func (h *Handler) Growth(w http.ResponseWriter, r *http.Request) {
	growth, err := h.service.Growth(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, growth)
}
