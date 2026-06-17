// Package post 提供 post 模块的 HTTP handler（DDD 版）。
package post

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-playground/validator/v10"

	apppost "blog-api/internal/application/post"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
)

// Handler 文章 HTTP 处理器
type Handler struct {
	svc      *apppost.Service
	validate *validator.Validate
}

// NewHandler 创建文章 handler
func NewHandler(svc *apppost.Service) *Handler {
	return &Handler{svc: svc, validate: validator.New()}
}

// GetBySlug 按 slug 获取文章（前台公开）
func (h *Handler) GetBySlug(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	dto, err := h.svc.GetBySlug(r.Context(), slug)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": dto})
}

// GetByID 按 ID 获取文章（后台管理）
func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	dto, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": dto})
}

// ListPublished 列出已发布文章（前台公开）
func (h *Handler) ListPublished(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 50 {
		limit = 10
	}
	tag := r.URL.Query().Get("tag")

	items, total, err := h.svc.ListPublished(r.Context(), page, limit, tag)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": items, "total": total})
}

// ListAll 列出所有文章（后台）
func (h *Handler) ListAll(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	status := r.URL.Query().Get("status")

	items, total, err := h.svc.ListAll(r.Context(), page, limit, status)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": items, "total": total})
}

type createPostRequest struct {
	Title          string   `json:"title" validate:"required"`
	Slug           string   `json:"slug" validate:"required"`
	ContentMD      string   `json:"content_md"`
	ContentHTML    string   `json:"content_html"`
	Excerpt        string   `json:"excerpt"`
	CoverImage     string   `json:"cover_image"`
	SEOTitle       string   `json:"seo_title"`
	SEODescription string   `json:"seo_description"`
	Tags           []string `json:"tags"`
}

// Create 创建文章（后台）
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	var req createPostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.Create(r.Context(), apppost.CreateInput{
		AuthorID: userID, Title: req.Title, Slug: req.Slug,
		ContentMD: req.ContentMD, ContentHTML: req.ContentHTML,
		Excerpt: req.Excerpt, CoverImage: req.CoverImage,
		SEOTitle: req.SEOTitle, SEODescription: req.SEODescription,
		Tags: req.Tags,
	})
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": dto})
}

// Update 更新文章
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req createPostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.svc.Update(r.Context(), apppost.UpdateInput{
		ID: id, Title: req.Title, Slug: req.Slug,
		ContentMD: req.ContentMD, ContentHTML: req.ContentHTML,
		Excerpt: req.Excerpt, CoverImage: req.CoverImage,
		SEOTitle: req.SEOTitle, SEODescription: req.SEODescription,
		Tags: req.Tags,
	}); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "文章已更新"})
}

// IncrementView 增加浏览计数（前台公开）
func (h *Handler) IncrementView(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ipAddress := r.Header.Get("X-Real-IP")
	if ipAddress == "" {
		ipAddress = r.Header.Get("X-Forwarded-For")
		if ipAddress != "" {
			ipAddress = strings.TrimSpace(strings.Split(ipAddress, ",")[0])
		} else {
			ipAddress = r.RemoteAddr
		}
	}
	userAgent := r.Header.Get("User-Agent")
	if err := h.svc.IncrementView(r.Context(), id, ipAddress, userAgent); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "ok"})
}

// UpdateStatus 更新文章状态（后台：draft/published/archived）
func (h *Handler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		Status string `json:"status" validate:"required,oneof=draft published archived"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.UpdateStatus(r.Context(), id, req.Status)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": dto})
}

// Publish 发布文章
func (h *Handler) Publish(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Publish(r.Context(), id); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "文章已发布"})
}

// Delete 删除文章
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Delete(r.Context(), id); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "文章已删除"})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
