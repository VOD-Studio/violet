// Package handler 提供 HTTP 请求处理器，负责接收请求、验证参数、调用服务层并返回响应
package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"blog-api/internal/pkg/auth"
	"blog-api/internal/pkg/postutil"
	"blog-api/internal/pkg/request"
	"blog-api/internal/pkg/response"
	"blog-api/internal/service"
)

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
		"publishedAt": postutil.FormatPublishedAt(post.PublishedAt),
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
		"publishedAt": postutil.FormatPublishedAt(post.PublishedAt),
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
		"publishedAt": postutil.FormatPublishedAt(post.PublishedAt),
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
