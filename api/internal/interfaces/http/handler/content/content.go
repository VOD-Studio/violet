// Package content 提供 announcement + project 的 HTTP handler（DDD 版）。
package content

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-playground/validator/v10"

	appann "blog-api/internal/application/announcement"
	appproj "blog-api/internal/application/project"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
)

// Handler announcement + project HTTP 处理器
type Handler struct {
	annSvc   *appann.Service
	projSvc  *appproj.Service
	validate *validator.Validate
}

// NewHandler 创建 handler
func NewHandler(annSvc *appann.Service, projSvc *appproj.Service) *Handler {
	return &Handler{annSvc: annSvc, projSvc: projSvc, validate: validator.New()}
}

// ============================================================
// Announcement
// ============================================================

func (h *Handler) ListAnnouncements(w http.ResponseWriter, r *http.Request) {
	items, err := h.annSvc.List(r.Context())
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": items})
}

func (h *Handler) ListActiveAnnouncements(w http.ResponseWriter, r *http.Request) {
	items, err := h.annSvc.ListActive(r.Context())
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": items})
}

func (h *Handler) GetAnnouncement(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	dto, err := h.annSvc.Get(r.Context(), int32(id))
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": dto})
}

type announcementRequest struct {
	Title     string `json:"title" validate:"required"`
	Content   string `json:"content" validate:"required"`
	Type      string `json:"type" validate:"required,oneof=info warning success error"`
	IsActive  *bool  `json:"is_active"`
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`
}

func (h *Handler) CreateAnnouncement(w http.ResponseWriter, r *http.Request) {
	var req announcementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	in := appann.CreateInput{Title: req.Title, Content: req.Content, Type: req.Type}
	if req.StartTime != "" {
		if t, err := time.Parse(time.RFC3339, req.StartTime); err == nil {
			in.StartTime = &t
		}
	}
	if req.EndTime != "" {
		if t, err := time.Parse(time.RFC3339, req.EndTime); err == nil {
			in.EndTime = &t
		}
	}
	id, err := h.annSvc.Create(r.Context(), in)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": map[string]any{"id": id}})
}

func (h *Handler) UpdateAnnouncement(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	var req announcementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	in := appann.UpdateInput{ID: int32(id), Title: req.Title, Content: req.Content, Type: req.Type, IsActive: req.IsActive}
	if req.StartTime != "" {
		if t, err := time.Parse(time.RFC3339, req.StartTime); err == nil {
			in.StartTime = &t
		}
	}
	if req.EndTime != "" {
		if t, err := time.Parse(time.RFC3339, req.EndTime); err == nil {
			in.EndTime = &t
		}
	}
	if err := h.annSvc.Update(r.Context(), in); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "公告已更新"})
}

func (h *Handler) DeleteAnnouncement(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.annSvc.Delete(r.Context(), int32(id)); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "公告已删除"})
}

// ============================================================
// Project
// ============================================================

func (h *Handler) ListProjects(w http.ResponseWriter, r *http.Request) {
	items, err := h.projSvc.List(r.Context())
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": items})
}

type projectRequest struct {
	Title       string   `json:"title" validate:"required"`
	Description string   `json:"description"`
	URL         string   `json:"url"`
	GithubURL   string   `json:"github_url"`
	ImageURL    string   `json:"image_url"`
	TechStack   []string `json:"tech_stack"`
	SortOrder   int      `json:"sort_order"`
}

func (h *Handler) CreateProject(w http.ResponseWriter, r *http.Request) {
	var req projectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.projSvc.Create(r.Context(), appproj.CreateInput{
		Title: req.Title, Description: req.Description, URL: req.URL,
		GithubURL: req.GithubURL, ImageURL: req.ImageURL,
		TechStack: req.TechStack, SortOrder: req.SortOrder,
	}); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"message": "项目已创建"})
}

func (h *Handler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req projectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.projSvc.Update(r.Context(), id, appproj.UpdateInput{
		Title: req.Title, Description: req.Description, URL: req.URL,
		GithubURL: req.GithubURL, ImageURL: req.ImageURL,
		TechStack: req.TechStack, SortOrder: req.SortOrder,
	}); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "项目已更新"})
}

func (h *Handler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.projSvc.Delete(r.Context(), id); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "项目已删除"})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
