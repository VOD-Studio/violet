package roadmap

import (
	"encoding/json"
	"net/http"

	approadmap "blog-api/internal/application/roadmap"
	"blog-api/internal/interfaces/http/response"
)

type moveRequest struct {
	Stage            string  `json:"stage"`
	BeforeID         string  `json:"before_id"`
	AfterID          string  `json:"after_id"`
	CompletionDate   *string `json:"completion_date"`
	DeliveredVersion string  `json:"delivered_version"`
}

func (h *Handler) Move(w http.ResponseWriter, r *http.Request) {
	var req moveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.Move(r.Context(), r.PathValue("projectID"), r.PathValue("id"), approadmap.MoveInput{
		Stage: req.Stage, BeforeID: req.BeforeID, AfterID: req.AfterID,
		CompletionDate: req.CompletionDate, DeliveredVersion: req.DeliveredVersion,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}
