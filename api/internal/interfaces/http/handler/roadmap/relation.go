package roadmap

import (
	"encoding/json"
	"net/http"

	approadmap "blog-api/internal/application/roadmap"
	"blog-api/internal/interfaces/http/response"
)

type RelationHandler struct{ svc *approadmap.RelationService }

func NewRelationHandler(svc *approadmap.RelationService) *RelationHandler {
	return &RelationHandler{svc: svc}
}

type relationRequest struct {
	SourceID string `json:"source_id"`
	TargetID string `json:"target_id"`
	Type     string `json:"type"`
}

func (h *RelationHandler) Create(w http.ResponseWriter, r *http.Request) {
	var request relationRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.Create(r.Context(), r.PathValue("projectID"), approadmap.CreateRelationInput{
		SourceID: request.SourceID, TargetID: request.TargetID, Type: request.Type,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

func (h *RelationHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.Delete(r.Context(), r.PathValue("projectID"), r.PathValue("relationID")); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "条目关系已删除")
}
