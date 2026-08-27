// Package series 提供系列书模块的 HTTP handler。
package series

import (
	"context"
	"encoding/json"
	"io"
	"net/http"

	"github.com/go-playground/validator/v10"

	appseries "blog-api/internal/application/series"
	ifmw "blog-api/internal/interfaces/http/middleware"
	"blog-api/internal/interfaces/http/response"
)

// seriesService handler 层依赖的 application service 接口视图。
//
// 独立定义而非直接用 *appseries.Service：让 handler 测试可注入 stub。
type seriesService interface {
	ListPublished(ctx context.Context, page, limit int) ([]appseries.SeriesDTO, int64, error)
	GetBySlug(ctx context.Context, slug string) (appseries.SeriesDetailDTO, error)
	GetChapterContextBySlug(ctx context.Context, postSlug string) (*appseries.ChapterContextDTO, error)

	ListAdmin(ctx context.Context, page, limit int) ([]appseries.SeriesAdminDTO, int64, error)
	GetAdmin(ctx context.Context, id string) (appseries.SeriesDetailDTO, error)
	Create(ctx context.Context, in appseries.CreateInput) (appseries.SeriesAdminDTO, error)
	Update(ctx context.Context, id string, in appseries.UpdateInput) (appseries.SeriesAdminDTO, error)
	Delete(ctx context.Context, id, userID string) error

	AddSection(ctx context.Context, id string, in appseries.AddSectionInput) (appseries.SeriesAdminDTO, error)
	RemoveSection(ctx context.Context, seriesID, sectionID, userID string) error
	ReorderSections(ctx context.Context, seriesID string, orderedSectionIDs []string, userID string) error

	AttachChapters(ctx context.Context, seriesID string, in appseries.AttachInput) (appseries.SeriesDetailDTO, error)
	DetachChapter(ctx context.Context, seriesID, postID, userID string) error
	ReorderChapters(ctx context.Context, seriesID string, in appseries.ReorderChaptersInput) error

	GenerateCoverSuggestions(ctx context.Context, id, userID, customPrompt string, n int) ([]string, error)
	GenerateCoverStandalone(ctx context.Context, userID, prompt string, n int) ([]string, error)
}

// Handler 系列书 HTTP 处理器。
type Handler struct {
	svc      seriesService
	validate *validator.Validate
}

// NewHandler 创建系列书 handler。
func NewHandler(svc *appseries.Service) *Handler {
	return &Handler{svc: svc, validate: validator.New()}
}

// ============================================================
// 公开端点
// ============================================================

// ListPublished 公开书架（GET /series，page/limit 分页）。
func (h *Handler) ListPublished(w http.ResponseWriter, r *http.Request) {
	page, limit := response.ParsePaging(r)
	items, total, err := h.svc.ListPublished(r.Context(), page, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, items, page, limit, total)
}

// GetBySlug 公开书籍详情（GET /series/{slug}；draft 书 404）。
func (h *Handler) GetBySlug(w http.ResponseWriter, r *http.Request) {
	dto, err := h.svc.GetBySlug(r.Context(), r.PathValue("slug"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// GetChapterContext 文章的书籍上下文（GET /series/context/{postSlug}）。
//
// 文章不属于任何书（或书未发布）时 data 为 null——前端以 null 判定无归属。
func (h *Handler) GetChapterContext(w http.ResponseWriter, r *http.Request) {
	dto, err := h.svc.GetChapterContextBySlug(r.Context(), r.PathValue("postSlug"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// ============================================================
// 管理端点（SessionAuth + RequirePermission 由路由层承担）
// ============================================================

// ListAdmin 管理书列表（GET /admin/series）。
func (h *Handler) ListAdmin(w http.ResponseWriter, r *http.Request) {
	page, limit := response.ParsePaging(r)
	items, total, err := h.svc.ListAdmin(r.Context(), page, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, items, page, limit, total)
}

// GetAdmin 管理书籍详情（GET /admin/series/{id}）。
func (h *Handler) GetAdmin(w http.ResponseWriter, r *http.Request) {
	dto, err := h.svc.GetAdmin(r.Context(), r.PathValue("id"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// createRequest 建书请求体。
type createRequest struct {
	// Title 书名
	Title string `json:"title" validate:"required"`
	// Slug 书 slug（创建后不可改）
	Slug string `json:"slug" validate:"required"`
	// Description 简介（可空）
	Description string `json:"description"`
	// CoverImage 封面图 URL（可空）
	CoverImage string `json:"cover_image"`
}

// Create 建书（POST /admin/series）。
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req createRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.Create(r.Context(), appseries.CreateInput{
		UserID:      ifmw.GetUserIDFromContext(r),
		Title:       req.Title,
		Slug:        req.Slug,
		Description: req.Description,
		CoverImage:  req.CoverImage,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

// updateRequest 编辑书请求体（PATCH 语义：nil 字段不改）。
type updateRequest struct {
	// Title 书名；nil=不改
	Title *string `json:"title"`
	// Description 简介；nil=不改
	Description *string `json:"description"`
	// CoverImage 封面图 URL；nil=不改
	CoverImage *string `json:"cover_image"`
	// Publish 发布状态意图；nil=不改，true=发布，false=收回
	Publish *bool `json:"publish"`
}

// Update 编辑书（PATCH /admin/series/{id}）。
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	var req updateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.Update(r.Context(), r.PathValue("id"), appseries.UpdateInput{
		UserID:      ifmw.GetUserIDFromContext(r),
		Title:       req.Title,
		Description: req.Description,
		CoverImage:  req.CoverImage,
		Publish:     req.Publish,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// Delete 解散书（DELETE /admin/series/{id}）。
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.Delete(r.Context(), r.PathValue("id"), ifmw.GetUserIDFromContext(r)); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "书已解散，全部章节已解绑")
}

// addSectionRequest 建卷请求体。
type addSectionRequest struct {
	// Title 卷名
	Title string `json:"title" validate:"required"`
}

// AddSection 建卷（POST /admin/series/{id}/sections）。
func (h *Handler) AddSection(w http.ResponseWriter, r *http.Request) {
	var req addSectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.AddSection(r.Context(), r.PathValue("id"), appseries.AddSectionInput{
		UserID: ifmw.GetUserIDFromContext(r),
		Title:  req.Title,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

// RemoveSection 删卷（DELETE /admin/series/{id}/sections/{sectionId}；非空卷 409）。
func (h *Handler) RemoveSection(w http.ResponseWriter, r *http.Request) {
	err := h.svc.RemoveSection(
		r.Context(),
		r.PathValue("id"),
		r.PathValue("sectionId"),
		ifmw.GetUserIDFromContext(r),
	)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "卷已删除")
}

// reorderSectionsRequest 卷全量调序请求体。
type reorderSectionsRequest struct {
	// OrderedSectionIDs 按新顺序排列的卷 ID 全集
	OrderedSectionIDs []string `json:"ordered_section_ids" validate:"required"`
}

// ReorderSections 卷调序（PUT /admin/series/{id}/sections/order）。
func (h *Handler) ReorderSections(w http.ResponseWriter, r *http.Request) {
	var req reorderSectionsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	err := h.svc.ReorderSections(r.Context(), r.PathValue("id"), req.OrderedSectionIDs, ifmw.GetUserIDFromContext(r))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "卷顺序已更新")
}

// attachChaptersRequest 挂章请求体。
type attachChaptersRequest struct {
	// PostIDs 挂入的文章 ID 列表（按给定顺序依次落位）
	PostIDs []string `json:"post_ids" validate:"required,min=1"`
	// SectionID 挂入的卷 ID；空串/省略=书根
	SectionID string `json:"section_id"`
	// AfterPostID 挂到该章之后；空串/省略=所在范围末尾
	AfterPostID string `json:"after_post_id"`
}

// AttachChapters 挂章（POST /admin/series/{id}/chapters）。
func (h *Handler) AttachChapters(w http.ResponseWriter, r *http.Request) {
	var req attachChaptersRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.AttachChapters(r.Context(), r.PathValue("id"), appseries.AttachInput{
		UserID:      ifmw.GetUserIDFromContext(r),
		PostIDs:     req.PostIDs,
		SectionID:   req.SectionID,
		AfterPostID: req.AfterPostID,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// DetachChapter 摘章（DELETE /admin/series/{id}/chapters/{postId}）。
func (h *Handler) DetachChapter(w http.ResponseWriter, r *http.Request) {
	err := h.svc.DetachChapter(
		r.Context(),
		r.PathValue("id"),
		r.PathValue("postId"),
		ifmw.GetUserIDFromContext(r),
	)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "章节已摘除")
}

// reorderChaptersRequest 全树调序请求体。
type reorderChaptersRequest struct {
	// Plans 各范围的新顺序全集
	Plans []reorderScopeRequest `json:"plans" validate:"required,min=1"`
}

// reorderScopeRequest 单个范围的调序。
type reorderScopeRequest struct {
	// SectionID 卷 ID；空串=书根
	SectionID string `json:"section_id"`
	// OrderedPostIDs 按新顺序排列的章节 ID 全集
	OrderedPostIDs []string `json:"ordered_post_ids" validate:"required"`
}

// ReorderChapters 全树调序（PUT /admin/series/{id}/chapters/order）。
func (h *Handler) ReorderChapters(w http.ResponseWriter, r *http.Request) {
	var req reorderChaptersRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	plans := make([]appseries.ReorderScopeInput, 0, len(req.Plans))
	for _, p := range req.Plans {
		plans = append(plans, appseries.ReorderScopeInput{
			SectionID:      p.SectionID,
			OrderedPostIDs: p.OrderedPostIDs,
		})
	}
	err := h.svc.ReorderChapters(r.Context(), r.PathValue("id"), appseries.ReorderChaptersInput{
		UserID: ifmw.GetUserIDFromContext(r),
		Plans:  plans,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "章节顺序已更新")
}


// generateCoversReq AI 封面生成入参。
type generateCoversReq struct {
	// Prompt 自定义提示词；空则用书名+简介构造
	Prompt string `json:"prompt,omitempty"`
	// Count 生成张数 1-10；空默认 2
	Count int `json:"count,omitempty"`
}

// GenerateCovers POST /admin/series/{id}/cover/generate：
// 生成 AI 封面候选并落素材库，返回 URL 列表供挑选（不直接改书封面）。
func (h *Handler) GenerateCovers(w http.ResponseWriter, r *http.Request) {
	var req generateCoversReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err != io.EOF {
		response.RespondError(w, r, err)
		return
	}
	urls, err := h.svc.GenerateCoverSuggestions(
		r.Context(), r.PathValue("id"), ifmw.GetUserIDFromContext(r), req.Prompt, req.Count)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]any{"urls": urls})
}

// GenerateCoversStandalone POST /admin/series/cover/generate（无书 id）：
// 建书流程创建态生图——书未落库，prompt 由前端用表单当前书名/简介构造。
func (h *Handler) GenerateCoversStandalone(w http.ResponseWriter, r *http.Request) {
	var req generateCoversReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err != io.EOF {
		response.RespondError(w, r, err)
		return
	}
	urls, err := h.svc.GenerateCoverStandalone(r.Context(), ifmw.GetUserIDFromContext(r), req.Prompt, req.Count)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]any{"urls": urls})
}
