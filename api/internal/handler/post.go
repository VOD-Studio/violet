package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"

	"blog-api/internal/middleware"
	"blog-api/internal/service"
)

// PostHandler 文章接口处理器
type PostHandler struct {
	postService *service.PostService
	tagService  *service.TagService
	validate    *validator.Validate
}

// NewPostHandler 创建文章处理器实例
func NewPostHandler(postService *service.PostService, tagService *service.TagService) *PostHandler {
	return &PostHandler{
		postService: postService,
		tagService:  tagService,
		validate:    validator.New(),
	}
}

// List 文章列表
// GET /api/posts
// 查询参数：page, limit, status, tag, search
func (h *PostHandler) List(w http.ResponseWriter, r *http.Request) {
	// 解析查询参数
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	status := r.URL.Query().Get("status")
	tagSlug := r.URL.Query().Get("tag")
	search := r.URL.Query().Get("search")

	// 如果指定了标签，按标签查询
	if tagSlug != "" {
		h.listByTag(w, r, tagSlug, page, limit)
		return
	}

	// 通用列表查询
	result, err := h.postService.ListPosts(r.Context(), service.ListPostsParams{
		Page:   page,
		Limit:  limit,
		Status: status,
		Search: search,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "查询文章列表失败")
		return
	}

	// 构建响应，不含正文内容
	type postListItem struct {
		/** 文章唯一标识 */
		ID string `json:"id"`
		/** 文章标题 */
		Title string `json:"title"`
		/** URL slug */
		Slug string `json:"slug"`
		/** 文章摘要 */
		Excerpt *string `json:"excerpt,omitempty"`
		/** 封面图片 */
		CoverImage *string `json:"coverImage,omitempty"`
		/** 发布状态 */
		Status string `json:"status"`
		/** 浏览次数 */
		ViewCount int32 `json:"viewCount"`
		/** 是否精选 */
		IsFeatured bool `json:"isFeatured"`
		/** 发布时间 */
		PublishedAt *string `json:"publishedAt,omitempty"`
		/** 创建时间 */
		CreatedAt string `json:"createdAt"`
	}

	items := make([]postListItem, 0, len(result.Posts))
	for _, p := range result.Posts {
		item := postListItem{
			ID:         p.ID.String(),
			Title:      p.Title,
			Slug:       p.Slug,
			Status:     p.Status,
			ViewCount:  p.ViewCount,
			IsFeatured: p.IsFeatured,
			CreatedAt:  p.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		}
		if p.Excerpt.Valid {
			item.Excerpt = &p.Excerpt.String
		}
		if p.CoverImage.Valid {
			item.CoverImage = &p.CoverImage.String
		}
		if p.PublishedAt.Valid {
			t := p.PublishedAt.Time.Format("2006-01-02T15:04:05Z07:00")
			item.PublishedAt = &t
		}
		items = append(items, item)
	}

	// 设置总数响应头
	w.Header().Set("X-Total-Count", strconv.FormatInt(result.Total, 10))
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"posts": items,
		"total": result.Total,
		"page":  result.Page,
		"limit": result.Limit,
	})
}

// listByTag 按标签 slug 查询文章
func (h *PostHandler) listByTag(w http.ResponseWriter, r *http.Request, tagSlug string, page, limit int) {
	// 通过标签 slug 查找标签 ID，再用 ListPosts 筛选
	tag, err := h.tagService.GetTagBySlug(r.Context(), tagSlug)
	if err != nil {
		if errors.Is(err, service.ErrTagNotFound) {
			writeError(w, http.StatusNotFound, "tag_not_found", "标签不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "查询标签失败")
		return
	}

	// 使用 ListPosts 按标签 ID 筛选
	result, err := h.postService.ListPosts(r.Context(), service.ListPostsParams{
		Page:  page,
		Limit: limit,
		TagID: int(tag.ID),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "查询文章列表失败")
		return
	}

	type postListItem struct {
		/** 文章唯一标识 */
		ID string `json:"id"`
		/** 文章标题 */
		Title string `json:"title"`
		/** URL slug */
		Slug string `json:"slug"`
		/** 文章摘要 */
		Excerpt *string `json:"excerpt,omitempty"`
		/** 封面图片 */
		CoverImage *string `json:"coverImage,omitempty"`
		/** 发布状态 */
		Status string `json:"status"`
		/** 浏览次数 */
		ViewCount int32 `json:"viewCount"`
		/** 是否精选 */
		IsFeatured bool `json:"isFeatured"`
		/** 发布时间 */
		PublishedAt *string `json:"publishedAt,omitempty"`
		/** 创建时间 */
		CreatedAt string `json:"createdAt"`
	}

	items := make([]postListItem, 0, len(result.Posts))
	for _, p := range result.Posts {
		item := postListItem{
			ID:         p.ID.String(),
			Title:      p.Title,
			Slug:       p.Slug,
			Status:     p.Status,
			ViewCount:  p.ViewCount,
			IsFeatured: p.IsFeatured,
			CreatedAt:  p.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		}
		if p.Excerpt.Valid {
			item.Excerpt = &p.Excerpt.String
		}
		if p.CoverImage.Valid {
			item.CoverImage = &p.CoverImage.String
		}
		items = append(items, item)
	}

	w.Header().Set("X-Total-Count", strconv.FormatInt(result.Total, 10))
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"posts": items,
		"total": result.Total,
		"page":  result.Page,
		"limit": result.Limit,
	})
}

// GetBySlug 获取文章详情
// GET /api/posts/:slug
func (h *PostHandler) GetBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if slug == "" {
		writeError(w, http.StatusBadRequest, "invalid_param", "缺少文章 slug")
		return
	}

	detail, err := h.postService.GetPostBySlug(r.Context(), slug)
	if err != nil {
		if errors.Is(err, service.ErrPostNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "文章不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "查询文章失败")
		return
	}

	// 构建响应
	type tagItem struct {
		ID   int32  `json:"id"`
		Name string `json:"name"`
		Slug string `json:"slug"`
	}

	tags := make([]tagItem, 0, len(detail.Tags))
	for _, t := range detail.Tags {
		tags = append(tags, tagItem{ID: t.ID, Name: t.Name, Slug: t.Slug})
	}

	p := detail.Post
	publishedAt := ""
	if p.PublishedAt.Valid {
		publishedAt = p.PublishedAt.Time.Format("2006-01-02T15:04:05Z07:00")
	}
	excerpt := ""
	if p.Excerpt.Valid {
		excerpt = p.Excerpt.String
	}
	coverImage := ""
	if p.CoverImage.Valid {
		coverImage = p.CoverImage.String
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":              p.ID.String(),
		"title":           p.Title,
		"slug":            p.Slug,
		"contentMarkdown": p.ContentMd,
		"contentHtml":     p.ContentHtml,
		"excerpt":         excerpt,
		"coverImage":      coverImage,
		"status":          p.Status,
		"viewCount":       p.ViewCount,
		"isFeatured":      p.IsFeatured,
		"publishedAt":     publishedAt,
		"createdAt":       p.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		"updatedAt":       p.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		"tags":            tags,
	})
}

// Create 创建文章
// POST /api/posts
// 需要认证
func (h *PostHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req service.CreatePostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	if err := h.validate.Struct(req); err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", formatValidationErrors(err))
		return
	}

	// 从上下文获取作者 ID
	userID := middleware.GetUserID(r.Context())
	authorID, err := uuid.Parse(userID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "无效的用户身份")
		return
	}

	// 创建文章
	post, err := h.postService.CreatePost(r.Context(), req, authorID)
	if err != nil {
		handlePostServiceError(w, err)
		return
	}

	// 关联标签
	if len(req.TagIDs) > 0 {
		for _, tagID := range req.TagIDs {
			_ = h.postService.AssociateTag(r.Context(), post.ID, tagID)
		}
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":     post.ID.String(),
		"title":  post.Title,
		"slug":   post.Slug,
		"status": post.Status,
	})
}

// Update 更新文章
// PUT /api/posts/:id
// 需要认证
func (h *PostHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的文章 ID")
		return
	}

	var req service.UpdatePostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	post, err := h.postService.UpdatePost(r.Context(), id, req)
	if err != nil {
		handlePostServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":     post.ID.String(),
		"title":  post.Title,
		"slug":   post.Slug,
		"status": post.Status,
	})
}

// Delete 删除文章
// DELETE /api/posts/:id
// 需要认证
func (h *PostHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的文章 ID")
		return
	}

	if err := h.postService.DeletePost(r.Context(), id); err != nil {
		handlePostServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, MessageResponse{
		Message: "文章已删除",
	})
}

// UpdateStatus 更新文章状态
// PATCH /api/posts/:id/status
// 需要认证
func (h *PostHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的文章 ID")
		return
	}

	var req struct {
		Status string `json:"status" validate:"required,oneof=draft published archived"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	if err := h.validate.Struct(req); err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", "状态值无效，只能为 draft/published/archived")
		return
	}

	post, err := h.postService.UpdatePostStatus(r.Context(), id, req.Status)
	if err != nil {
		handlePostServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":     post.ID.String(),
		"title":  post.Title,
		"status": post.Status,
	})
}

// IncrementView 增加浏览计数
// POST /api/posts/:id/view
func (h *PostHandler) IncrementView(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的文章 ID")
		return
	}

	if err := h.postService.IncrementViewCount(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "更新浏览次数失败")
		return
	}

	writeJSON(w, http.StatusOK, MessageResponse{
		Message: "ok",
	})
}

// handlePostServiceError 处理文章服务错误
func handlePostServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, service.ErrPostNotFound):
		writeError(w, http.StatusNotFound, "not_found", "文章不存在")
	case errors.Is(err, service.ErrSlugExists):
		writeError(w, http.StatusConflict, "slug_exists", "slug 已存在")
	case errors.Is(err, service.ErrInvalidStatus):
		writeError(w, http.StatusBadRequest, "invalid_status", "无效的文章状态")
	case errors.Is(err, service.ErrPostSlugInvalid):
		writeError(w, http.StatusBadRequest, "invalid_slug", "slug 格式无效")
	default:
		writeError(w, http.StatusInternalServerError, "internal_error", "服务器内部错误")
	}
}

