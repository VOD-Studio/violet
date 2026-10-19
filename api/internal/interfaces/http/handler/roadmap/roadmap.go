package roadmap

import (
	"encoding/json"
	"net/http"

	approadmap "blog-api/internal/application/roadmap"
	"blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
)

type Handler struct{ svc *approadmap.Service }

func NewHandler(svc *approadmap.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) GetBySlug(w http.ResponseWriter, r *http.Request) {
	dto, err := h.svc.GetBySlug(r.Context(), r.PathValue("slug"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

type itemRequest struct {
	Title            string                        `json:"title"`
	Description      string                        `json:"description"`
	Stage            string                        `json:"stage"`
	Tags             []string                      `json:"tags"`
	Links            []approadmap.LinkDTO          `json:"links"`
	Checklist        []approadmap.ChecklistItemDTO `json:"checklist"`
	CompletionDate   *string                       `json:"completion_date"`
	DeliveredVersion string                        `json:"delivered_version"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req itemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.Create(r.Context(), r.PathValue("projectID"), approadmap.CreateInput{
		Title: req.Title, Description: req.Description, Stage: req.Stage, Tags: req.Tags, Links: req.Links,
		Checklist: req.Checklist, CompletionDate: req.CompletionDate, DeliveredVersion: req.DeliveredVersion,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	var req itemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if req.Stage != "" {
		response.RespondError(w, r, shared.BadRequest("阶段变更请使用移动接口"))
		return
	}
	dto, err := h.svc.Update(r.Context(), r.PathValue("projectID"), r.PathValue("id"), approadmap.UpdateInput{
		Title: req.Title, Description: req.Description, Tags: req.Tags, Links: req.Links,
		Checklist: req.Checklist, CompletionDate: req.CompletionDate, DeliveredVersion: req.DeliveredVersion,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}
