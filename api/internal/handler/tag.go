package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"

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
	tags, err := h.tagService.ListTags(r.Context())
	if err != nil {
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
}

// Create 创建标签
// POST /api/v1/tags
// 需要认证
func (h *TagHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name" validate:"required,min=1,max=50"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	if err := h.validate.Struct(req); err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", formatValidationErrors(err))
		return
	}

	tag, err := h.tagService.CreateTag(r.Context(), req.Name)
	if err != nil {
		if errors.Is(err, service.ErrTagExists) {
			writeError(w, http.StatusConflict, "tag_exists", "标签已存在")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "创建标签失败")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":   tag.ID,
		"name": tag.Name,
		"slug": tag.Slug,
	})
}

// Delete 删除标签
// DELETE /api/v1/tags/:id
// 需要认证
func (h *TagHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的标签 ID")
		return
	}

	if err := h.tagService.DeleteTag(r.Context(), int32(id)); err != nil {
		if errors.Is(err, service.ErrTagNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "标签不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "删除标签失败")
		return
	}

	writeJSON(w, http.StatusOK, MessageResponse{
		Message: "标签已删除",
	})
}
