// Package handler 提供 HTTP 请求处理器，负责接收请求、验证参数、调用服务层并返回响应
package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"blog-api/internal/pkg/auth"
	"blog-api/internal/pkg/request"
	"blog-api/internal/pkg/response"
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
// GET /api/v1/posts
// 查询参数：page, limit, status, tag, search
func (h *PostHandler) List(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "List").Msg("处理请求")

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
		log.Error().Err(err).Str("operation", "ListPosts").Msg("服务调用失败")
		response.InternalServerError(w, "查询文章列表失败")
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
		/** 更新时间 */
		UpdatedAt string `json:"updatedAt"`
	}

	items := make([]postListItem, 0, len(result.Posts))
	for _, p := range result.Posts {
		item := postListItem{
			ID:         p.ID.String(),
			Title:      p.Title,
			Slug:       p.Slug,
			Status:     p.Status,
			ViewCount:  p.ViewCount,
			UpdatedAt:  p.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
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
	response.Success(w, map[string]interface{}{
		"posts": items,
		"total": result.Total,
		"page":  result.Page,
		"limit": result.Limit,
	})
	log.Info().Int("status", http.StatusOK).Int64("total", result.Total).Msg("请求处理成功")
}

// listByTag 按标签 slug 查询文章
func (h *PostHandler) listByTag(w http.ResponseWriter, r *http.Request, tagSlug string, page, limit int) {
	log.Info().Str("handler", "listByTag").Str("tag_slug", tagSlug).Msg("处理请求")

	// 通过标签 slug 查找标签 ID，再用 ListPosts 筛选
	tag, err := h.tagService.GetTagBySlug(r.Context(), tagSlug)
	if err != nil {
		if errors.Is(err, service.ErrTagNotFound) {
			log.Warn().Str("tag_slug", tagSlug).Msg("标签不存在")
			response.Error(w, http.StatusNotFound, "tag_not_found", "标签不存在")
			return
		}
		log.Error().Err(err).Str("operation", "GetTagBySlug").Msg("服务调用失败")
		response.InternalServerError(w, "查询标签失败")
		return
	}

	// 使用 ListPosts 按标签 ID 筛选
	result, err := h.postService.ListPosts(r.Context(), service.ListPostsParams{
		Page:  page,
		Limit: limit,
		TagID: int(tag.ID),
	})
	if err != nil {
		log.Error().Err(err).Str("operation", "ListPosts").Msg("服务调用失败")
		response.InternalServerError(w, "查询文章列表失败")
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
	response.Success(w, map[string]interface{}{
		"posts": items,
		"total": result.Total,
		"page":  result.Page,
		"limit": result.Limit,
	})
	log.Info().Int("status", http.StatusOK).Int64("total", result.Total).Msg("请求处理成功")
}

// GetByID 按 ID 或 slug 获取文章（统一端点）
// GET /api/v1/posts/:id
// 自动识别参数是 UUID 还是 slug
func (h *PostHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	identifier := chi.URLParam(r, "id")
	log.Info().Str("handler", "GetByID").Str("identifier", identifier).Msg("处理请求")

	if identifier == "" {
		log.Warn().Msg("参数验证失败：缺少文章标识")
		response.Error(w, http.StatusBadRequest, "invalid_param", "缺少文章标识")
		return
	}

	// 尝试解析为 UUID，如果失败则当作 slug 处理
	var detail *service.PostDetail
	var err error

	id, parseErr := uuid.Parse(identifier)
	if parseErr == nil {
		// 是有效的 UUID，按 ID 查询
		log.Debug().Str("type", "uuid").Str("id", identifier).Msg("识别为 UUID")
		post, err := h.postService.GetPostByID(r.Context(), id)
		if err != nil {
			if errors.Is(err, service.ErrPostNotFound) {
				log.Warn().Str("id", identifier).Msg("文章不存在")
				response.NotFound(w, "文章不存在")
				return
			}
			log.Error().Err(err).Str("operation", "GetPostByID").Msg("服务调用失败")
			response.InternalServerError(w, "查询文章失败")
			return
		}

		// 查询文章标签
		tags, err := h.postService.ListPostTags(r.Context(), post.ID)
		if err != nil {
			log.Error().Err(err).Str("operation", "ListPostTags").Msg("服务调用失败")
			response.InternalServerError(w, "查询标签失败")
			return
		}

		detail = &service.PostDetail{
			Post: post,
			Tags: tags,
		}
	} else {
		// 不是 UUID，按 slug 查询
		log.Debug().Str("type", "slug").Str("slug", identifier).Msg("识别为 slug")
		detail, err = h.postService.GetPostBySlug(r.Context(), identifier)
		if err != nil {
			if errors.Is(err, service.ErrPostNotFound) {
				log.Warn().Str("slug", identifier).Msg("文章不存在")
				response.NotFound(w, "文章不存在")
				return
			}
			log.Error().Err(err).Str("operation", "GetPostBySlug").Msg("服务调用失败")
			response.InternalServerError(w, "查询文章失败")
			return
		}
	}

	// 构建响应
	type tagItem struct {
		ID   int32  `json:"id"`
		Name string `json:"name"`
		Slug string `json:"slug"`
	}

	tagItems := make([]tagItem, 0, len(detail.Tags))
	for _, t := range detail.Tags {
		tagItems = append(tagItems, tagItem{ID: t.ID, Name: t.Name, Slug: t.Slug})
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
	seoDescription := ""
	if p.SeoDescription.Valid {
		seoDescription = p.SeoDescription.String
	}
	seoKeywords := ""
	if p.SeoKeywords.Valid {
		seoKeywords = p.SeoKeywords.String
	}

	response.Success(w, map[string]interface{}{
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
		"seoDescription":  seoDescription,
		"seoKeywords":     seoKeywords,
		"tags":            tagItems,
	})
	log.Info().Int("status", http.StatusOK).Str("post_id", p.ID.String()).Msg("请求处理成功")
}

// Create 创建文章
// POST /api/v1/posts
// 需要认证
func (h *PostHandler) Create(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "Create").Msg("处理请求")

	var req service.CreatePostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		response.BadRequest(w, err.Error())
		return
	}

	if err := h.validate.Struct(req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		if validationErr, ok := err.(validator.ValidationErrors); ok {
			details := request.FormatValidationError(validationErr)
			response.ValidationError(w, "请求验证失败", details)
		} else {
			response.BadRequest(w, err.Error())
		}
		return
	}

	// 从上下文获取作者 ID
	userID, err := auth.GetUserID(r)
	if err != nil {
		log.Warn().Msg("参数验证失败：无效的用户身份")
		response.Unauthorized(w, "未认证")
		return
	}
	authorID, err := uuid.Parse(userID)
	if err != nil {
		log.Warn().Err(err).Msg("参数验证失败：无效的用户身份")
		response.Error(w, http.StatusUnauthorized, "unauthorized", "无效的用户身份")
		return
	}

	// 创建文章
	post, err := h.postService.CreatePost(r.Context(), req, authorID)
	if err != nil {
		log.Error().Err(err).Str("operation", "CreatePost").Msg("服务调用失败")
		handlePostServiceError(w, err)
		return
	}

	// 关联标签
	if len(req.TagIDs) > 0 {
		for _, tagID := range req.TagIDs {
			_ = h.postService.AssociateTag(r.Context(), post.ID, tagID)
		}
	}

	response.Created(w, map[string]interface{}{
		"id":          post.ID.String(),
		"title":       post.Title,
		"slug":        post.Slug,
		"status":      post.Status,
		"publishedAt": formatPublishedAt(post.PublishedAt),
	})
	log.Info().Int("status", http.StatusCreated).Str("post_id", post.ID.String()).Msg("请求处理成功")
}

// Update 更新文章
// PUT /api/v1/posts/:id
// 需要认证
func (h *PostHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	log.Info().Str("handler", "Update").Str("id", idStr).Msg("处理请求")

	id, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn().Err(err).Str("id", idStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_param", "无效的文章 ID")
		return
	}

	var req service.UpdatePostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		response.BadRequest(w, err.Error())
		return
	}

	post, err := h.postService.UpdatePost(r.Context(), id, req)
	if err != nil {
		log.Error().Err(err).Str("operation", "UpdatePost").Msg("服务调用失败")
		handlePostServiceError(w, err)
		return
	}

	response.Success(w, map[string]interface{}{
		"id":          post.ID.String(),
		"title":       post.Title,
		"slug":        post.Slug,
		"status":      post.Status,
		"publishedAt": formatPublishedAt(post.PublishedAt),
	})
	log.Info().Int("status", http.StatusOK).Str("post_id", post.ID.String()).Msg("请求处理成功")
}

// Delete 删除文章
// DELETE /api/v1/posts/:id
// 需要认证
func (h *PostHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	log.Info().Str("handler", "Delete").Str("id", idStr).Msg("处理请求")

	id, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn().Err(err).Str("id", idStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_param", "无效的文章 ID")
		return
	}

	if err := h.postService.DeletePost(r.Context(), id); err != nil {
		log.Error().Err(err).Str("operation", "DeletePost").Msg("服务调用失败")
		handlePostServiceError(w, err)
		return
	}

	response.Success(w, MessageResponse{
		Message: "文章已删除",
	})
	log.Info().Int("status", http.StatusOK).Str("post_id", idStr).Msg("请求处理成功")
}

// UpdateStatus 更新文章状态
// PATCH /api/v1/posts/:id/status
// 需要认证
func (h *PostHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	log.Info().Str("handler", "UpdateStatus").Str("id", idStr).Msg("处理请求")

	id, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn().Err(err).Str("id", idStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_param", "无效的文章 ID")
		return
	}

	var req struct {
		Status string `json:"status" validate:"required,oneof=draft published archived"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		response.BadRequest(w, err.Error())
		return
	}

	if err := h.validate.Struct(req); err != nil {
		log.Warn().Err(err).Str("status", req.Status).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "validation_error", "状态值无效，只能为 draft/published/archived")
		return
	}

	post, err := h.postService.UpdatePostStatus(r.Context(), id, req.Status)
	if err != nil {
		log.Error().Err(err).Str("operation", "UpdatePostStatus").Str("id", idStr).Str("status", req.Status).Msg("服务调用失败")
		handlePostServiceError(w, err)
		return
	}

	response.Success(w, map[string]interface{}{
		"id":          post.ID.String(),
		"title":       post.Title,
		"status":      post.Status,
		"publishedAt": formatPublishedAt(post.PublishedAt),
	})
	log.Info().Int("status", http.StatusOK).Str("post_id", post.ID.String()).Str("new_status", post.Status).Msg("请求处理成功")
}

// IncrementView 增加浏览计数
// POST /api/v1/posts/:id/view
func (h *PostHandler) IncrementView(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	log.Info().Str("handler", "IncrementView").Str("id", idStr).Msg("处理请求")

	id, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn().Err(err).Str("id", idStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_param", "无效的文章 ID")
		return
	}

	// 获取客户端 IP 和 UserAgent
	ipAddress := r.Header.Get("X-Real-IP")
	if ipAddress == "" {
		ipAddress = r.Header.Get("X-Forwarded-For")
		if ipAddress != "" {
			// X-Forwarded-For 可能包含多个 IP，取第一个
			parts := strings.Split(ipAddress, ",")
			ipAddress = strings.TrimSpace(parts[0])
		} else {
			ipAddress = r.RemoteAddr
		}
	}
	userAgent := r.Header.Get("User-Agent")

	if err := h.postService.IncrementViewCount(r.Context(), id, ipAddress, userAgent); err != nil {
		log.Error().Err(err).Str("operation", "IncrementViewCount").Msg("服务调用失败")
		response.InternalServerError(w, "更新浏览次数失败")
		return
	}

	response.Success(w, MessageResponse{
		Message: "ok",
	})
	log.Info().Int("status", http.StatusOK).Str("post_id", idStr).Msg("请求处理成功")
}

// handlePostServiceError 处理文章服务错误
func handlePostServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, service.ErrPostNotFound):
		response.NotFound(w, "文章不存在")
	case errors.Is(err, service.ErrSlugExists):
		response.Error(w, http.StatusConflict, "slug_exists", "slug 已存在")
	case errors.Is(err, service.ErrInvalidStatus):
		response.Error(w, http.StatusBadRequest, "invalid_status", "无效的文章状态")
	case errors.Is(err, service.ErrPostSlugInvalid):
		response.Error(w, http.StatusBadRequest, "invalid_slug", "slug 格式无效")
	default:
		response.InternalServerError(w, "服务器内部错误")
	}
}

// formatPublishedAt 格式化发布时间
func formatPublishedAt(t sql.NullTime) string {
	if t.Valid {
		return t.Time.Format("2006-01-02T15:04:05Z07:00")
	}
	return ""
}
