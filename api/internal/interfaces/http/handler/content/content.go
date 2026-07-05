// Package content 提供 announcement + project 的 HTTP handler。
package content

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-playground/validator/v10"

	appann "blog-api/internal/application/announcement"
	appproj "blog-api/internal/application/project"
	"blog-api/internal/interfaces/http/response"
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
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, items)
}

func (h *Handler) ListActiveAnnouncements(w http.ResponseWriter, r *http.Request) {
	items, err := h.annSvc.ListActive(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, items)
}

func (h *Handler) GetAnnouncement(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.annSvc.Get(r.Context(), int32(id))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// GetActiveAnnouncement 公开端点：获取单个生效公告（article 详情页用）
func (h *Handler) GetActiveAnnouncement(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.annSvc.GetActive(r.Context(), int32(id))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

type announcementRequest struct {
	Title       string   `json:"title" validate:"required"`
	Content     string   `json:"content"`
	Type        string   `json:"type" validate:"required,oneof=info warning success error"`
	Display     string   `json:"display" validate:"omitempty,oneof=banner card article"`
	IsActive    *bool    `json:"is_active"`
	StartTime   string   `json:"start_time"`
	EndTime     string   `json:"end_time"`
	SortOrder   *int     `json:"sort_order"`
	Affects     []string `json:"affects"`
	ContentMD   string   `json:"content_md"`
	ContentHTML string   `json:"content_html"`
	CoverImage  string   `json:"cover_image"`
	Excerpt     string   `json:"excerpt"`
}

func (h *Handler) CreateAnnouncement(w http.ResponseWriter, r *http.Request) {
	var req announcementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	in := appann.CreateInput{
		Title: req.Title, Content: req.Content, Type: req.Type,
		Display: req.Display, SortOrder: derefInt(req.SortOrder),
		Affects: req.Affects, ContentMD: req.ContentMD, ContentHTML: req.ContentHTML,
		CoverImage: req.CoverImage, Excerpt: req.Excerpt,
	}
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
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, map[string]any{"id": id})
}

func (h *Handler) UpdateAnnouncement(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	var req announcementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	in := appann.UpdateInput{
		ID: int32(id), Title: req.Title, Content: req.Content, Type: req.Type,
		Display: req.Display, IsActive: req.IsActive, SortOrder: req.SortOrder,
		Affects: req.Affects, ContentMD: req.ContentMD, ContentHTML: req.ContentHTML,
		CoverImage: req.CoverImage, Excerpt: req.Excerpt,
	}
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
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "公告已更新")
}

func (h *Handler) DeleteAnnouncement(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.annSvc.Delete(r.Context(), int32(id)); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "公告已删除")
}

// ============================================================
// Project
// ============================================================

func (h *Handler) ListProjects(w http.ResponseWriter, r *http.Request) {
	items, err := h.projSvc.List(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, items)
}

// GetProject 获取项目详情（公开）
func (h *Handler) GetProject(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	dto, err := h.projSvc.Get(r.Context(), id)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
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
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.projSvc.Create(r.Context(), appproj.CreateInput{
		Title: req.Title, Description: req.Description, URL: req.URL,
		GithubURL: req.GithubURL, ImageURL: req.ImageURL,
		TechStack: req.TechStack, SortOrder: req.SortOrder,
	}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusCreated, "项目已创建")
}

func (h *Handler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req projectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.projSvc.Update(r.Context(), id, appproj.UpdateInput{
		Title: req.Title, Description: req.Description, URL: req.URL,
		GithubURL: req.GithubURL, ImageURL: req.ImageURL,
		TechStack: req.TechStack, SortOrder: req.SortOrder,
	}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "项目已更新")
}

func (h *Handler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.projSvc.Delete(r.Context(), id); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "项目已删除")
}

// derefInt 解引用 *int,nil 返回 0
func derefInt(p *int) int {
	if p == nil {
		return 0
	}
	return *p
}
