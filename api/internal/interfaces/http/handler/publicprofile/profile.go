// Package publicprofile adapts the public account projection to HTTP.
package publicprofile

import (
	"net/http"

	appprofile "blog-api/internal/application/publicprofile"
	"blog-api/internal/interfaces/http/response"
)

type Handler struct{ service *appprofile.Service }

func NewHandler(service *appprofile.Service) *Handler { return &Handler{service: service} }

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	profile, err := h.service.Get(r.Context(), r.PathValue("username"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, profile)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	cursor, limit := response.ParseCursor(r)
	if limit > 50 {
		limit = 50
	}
	items, next, err := h.service.List(r.Context(), r.PathValue("username"), r.URL.Query().Get("tab"), cursor, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCursor(w, items, limit, next != "", next)
}
