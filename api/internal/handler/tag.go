// Package handler 提供 HTTP 请求处理器，负责接收请求、验证参数、调用服务层并返回响应
package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/rs/zerolog/log"

	"blog-api/internal/service"
)

// TagHandler 标签接口处理器
type TagHandler struct {
	tagService *service.TagService
	validate   *validator.Validate
}

// NewTagHandler 创建标签处理器实例
func NewTagHandler(tagService *service.TagService) *TagHandler {
	return &TagHandler{
		tagService: tagService,
		validate:   validator.New(),
	}
}

// List 标签列表
// GET /api/v1/tags
func (h *TagHandler) List(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "List").Msg("处理请求")

	tags, err := h.tagService.ListTags(r.Context())
	if err != nil {
		log.Error().Err(err).Str("operation", "ListTags").Msg("服务调用失败")
		writeError(w, http.StatusInternalServerError, "internal_error", "查询标签列表失败")
		return
	}

	type tagItem struct {
		ID   int32  `json:"id"`
		Name string `json:"name"`
		Slug string `json:"slug"`
	}

	items := make([]tagItem, 0, len(tags))
	for _, t := range tags {
		items = append(items, tagItem{ID: t.ID, Name: t.Name, Slug: t.Slug})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"tags": items,
	})
	log.Info().Int("status", http.StatusOK).Int("count", len(items)).Msg("请求处理成功")
}

// Create 创建标签
// POST /api/v1/tags
// 需要认证
func (h *TagHandler) Create(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "Create").Msg("处理请求")

	var req struct {
		Name string `json:"name" validate:"required,min=1,max=50"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	if err := h.validate.Struct(req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "validation_error", formatValidationErrors(err))
		return
	}

	tag, err := h.tagService.CreateTag(r.Context(), req.Name)
	if err != nil {
		if errors.Is(err, service.ErrTagExists) {
			log.Warn().Str("name", req.Name).Msg("标签已存在")
			writeError(w, http.StatusConflict, "tag_exists", "标签已存在")
			return
		}
		log.Error().Err(err).Str("operation", "CreateTag").Msg("服务调用失败")
		writeError(w, http.StatusInternalServerError, "internal_error", "创建标签失败")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":   tag.ID,
		"name": tag.Name,
		"slug": tag.Slug,
	})
	log.Info().Int("status", http.StatusCreated).Int32("tag_id", tag.ID).Msg("请求处理成功")
}

// Delete 删除标签
// DELETE /api/v1/tags/:id
// 需要认证
func (h *TagHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	log.Info().Str("handler", "Delete").Str("id", idStr).Msg("处理请求")

	id, err := strconv.Atoi(idStr)
	if err != nil {
		log.Warn().Err(err).Str("id", idStr).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的标签 ID")
		return
	}

	if err := h.tagService.DeleteTag(r.Context(), int32(id)); err != nil {
		if errors.Is(err, service.ErrTagNotFound) {
			log.Warn().Str("id", idStr).Msg("标签不存在")
			writeError(w, http.StatusNotFound, "not_found", "标签不存在")
			return
		}
		log.Error().Err(err).Str("operation", "DeleteTag").Msg("服务调用失败")
		writeError(w, http.StatusInternalServerError, "internal_error", "删除标签失败")
		return
	}

	writeJSON(w, http.StatusOK, MessageResponse{
		Message: "标签已删除",
	})
	log.Info().Int("status", http.StatusOK).Str("tag_id", idStr).Msg("请求处理成功")
}
