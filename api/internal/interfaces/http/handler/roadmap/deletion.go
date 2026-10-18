package roadmap

import (
	"net/http"

	"blog-api/internal/interfaces/http/response"
)

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.Delete(r.Context(), r.PathValue("projectID"), r.PathValue("id")); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondNoContent(w)
}

func (h *Handler) Restore(w http.ResponseWriter, r *http.Request) {
	dto, err := h.svc.Restore(r.Context(), r.PathValue("projectID"), r.PathValue("id"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}
