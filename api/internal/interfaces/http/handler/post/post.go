// Package post 提供 post 模块的 HTTP handler。
package post

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-playground/validator/v10"

	apppost "blog-api/internal/application/post"
	domainshared "blog-api/internal/domain/shared"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
	"blog-api/internal/interfaces/http/response"
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
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// GetByID 按 ID 获取文章（后台管理）
func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	dto, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// ListPublished 列出已发布文章（前台公开）
func (h *Handler) ListPublished(w http.ResponseWriter, r *http.Request) {
	page, limit := response.ParsePagingWithMax(r, 50)
	tag := r.URL.Query().Get("tag")
	items, total, err := h.svc.ListPublished(r.Context(), page, limit, tag)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, items, page, limit, total)
}

// ArchiveYears 归档年份索引（前台公开）。
// 返回所有含已发布文章的年份（倒序），供归档页渲染年份导航并按年懒加载。
func (h *Handler) ArchiveYears(w http.ResponseWriter, r *http.Request) {
	years, err := h.svc.ListArchiveYears(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]any{"years": years})
}

// ArchiveByYear 指定年份归档（前台公开）。
// 返回该年全部已发布文章的精简项（倒序），前端再按月分组展示。
func (h *Handler) ArchiveByYear(w http.ResponseWriter, r *http.Request) {
	yearStr := r.PathValue("year")
	year, err := strconv.Atoi(yearStr)
	if err != nil {
		response.RespondError(w, r, domainshared.BadRequest("无效的年份"))
		return
	}
	dto, err := h.svc.GetArchiveByYear(r.Context(), year)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// ListAll 列出所有文章（后台）
func (h *Handler) ListAll(w http.ResponseWriter, r *http.Request) {
	page, limit := response.ParsePaging(r)
	status := r.URL.Query().Get("status")
	items, total, err := h.svc.ListAll(r.Context(), page, limit, status)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, items, page, limit, total)
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
	IsFeatured     bool     `json:"is_featured"`
}

// Create 创建文章（后台）
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	var req createPostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.Create(r.Context(), apppost.CreateInput{
		AuthorID: userID, Title: req.Title, Slug: req.Slug,
		ContentMD: req.ContentMD, ContentHTML: req.ContentHTML,
		Excerpt: req.Excerpt, CoverImage: req.CoverImage,
		SEOTitle: req.SEOTitle, SEODescription: req.SEODescription,
		Tags: req.Tags, IsFeatured: req.IsFeatured,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

// Update 更新文章
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	userID := interfacesmw.GetUserIDFromContext(r)
	var req createPostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.svc.Update(r.Context(), apppost.UpdateInput{
		ID: id, Title: req.Title, Slug: req.Slug,
		ContentMD: req.ContentMD, ContentHTML: req.ContentHTML,
		Excerpt: req.Excerpt, CoverImage: req.CoverImage,
		SEOTitle: req.SEOTitle, SEODescription: req.SEODescription,
		Tags: req.Tags, IsFeatured: req.IsFeatured,
	}, userID); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "文章已更新")
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
		response.RespondError(w, r, err)
		return
	}
	response.RespondNoContent(w)
}

// UpdateStatus 更新文章状态（后台：draft/published/archived）
func (h *Handler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		Status string `json:"status" validate:"required,oneof=draft published archived"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.UpdateStatus(r.Context(), id, req.Status)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// SetFeatured 设置文章精选标记（后台）
func (h *Handler) SetFeatured(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		IsFeatured bool `json:"is_featured"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.SetFeatured(r.Context(), id, req.IsFeatured)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// Publish 发布文章
func (h *Handler) Publish(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Publish(r.Context(), id); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "文章已发布")
}

// Delete 删除文章 (移至回收站)
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Delete(r.Context(), id); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "文章已移至回收站")
}

// Restore 恢复已删除的文章
func (h *Handler) Restore(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Restore(r.Context(), id); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "文章已恢复")
}

// HardDelete 彻底删除文章
func (h *Handler) HardDelete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.HardDelete(r.Context(), id); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "文章已彻底删除")
}


// ImportURL 导入远程链接文档：解析网页正文为 HTML，供编辑器插入
func (h *Handler) ImportURL(w http.ResponseWriter, r *http.Request) {
	var req struct {
		URL              string `json:"url" validate:"required,url"`
		AIRestoreFormula bool   `json:"ai_restore_formula"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	res, err := h.svc.ImportURL(r.Context(), req.URL, apppost.ImportURLOpts{AIRestoreFormula: req.AIRestoreFormula})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, res)
}

// Slugify 根据标题生成 slug(中文转拼音),供前端标题输入后预填 slug 输入框。
func (h *Handler) Slugify(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title string `json:"title" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	res, err := h.svc.Slugify(r.Context(), req.Title)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, res)
}

// ListVersions 获取文章的历史版本列表
func (h *Handler) ListVersions(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	versions, err := h.svc.ListVersions(r.Context(), id)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, versions)
}

// GetVersion 获取指定的历史版本详情
func (h *Handler) GetVersion(w http.ResponseWriter, r *http.Request) {
	versionID := r.PathValue("versionId")
	v, err := h.svc.GetVersion(r.Context(), versionID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, v)
}

// RestoreVersion 将文章回滚到指定版本
func (h *Handler) RestoreVersion(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	versionID := r.PathValue("versionId")
	userID := interfacesmw.GetUserIDFromContext(r)

	if err := h.svc.RestoreVersion(r.Context(), id, versionID, userID); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "已回滚到指定版本")
}
