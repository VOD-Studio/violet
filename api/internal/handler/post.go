// Package handler 提供 HTTP 请求处理器，负责接收请求、验证参数、调用服务层并返回响应
package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"blog-api/internal/pkg/postutil"
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
			UpdatedAt:  postutil.FormatTime(p.UpdatedAt),
			IsFeatured: p.IsFeatured,
			CreatedAt:  postutil.FormatTime(p.CreatedAt),
		}
		if p.Excerpt.Valid {
			item.Excerpt = &p.Excerpt.String
		}
		if p.CoverImage.Valid {
			item.CoverImage = &p.CoverImage.String
		}
		if p.PublishedAt.Valid {
			t := postutil.FormatTime(p.PublishedAt.Time)
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
			CreatedAt:  postutil.FormatTime(p.CreatedAt),
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
		publishedAt = postutil.FormatTime(p.PublishedAt.Time)
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
		"createdAt":       postutil.FormatTime(p.CreatedAt),
		"updatedAt":       postutil.FormatTime(p.UpdatedAt),
		"seoDescription":  seoDescription,
		"seoKeywords":     seoKeywords,
		"tags":            tagItems,
	})
	log.Info().Int("status", http.StatusOK).Str("post_id", p.ID.String()).Msg("请求处理成功")
}
