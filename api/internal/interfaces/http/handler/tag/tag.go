// Package tag 提供 tag 模块的 HTTP handler。
package tag

import (
	"encoding/json"
	"net/http"
	"strconv"

	apptag "blog-api/internal/application/tag"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
)

// Handler 标签 HTTP handler
type Handler struct {
	svc *apptag.Service
}

// NewHandler 构造标签 handler
func NewHandler(svc *apptag.Service) *Handler {
	return &Handler{svc: svc}
}

// List 列出标签（公开；无分页参数时全量，带 page/limit 时分页）
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	if r.URL.Query().Get("page") == "" && r.URL.Query().Get("limit") == "" {
		tags, err := h.svc.List(r.Context())
		if err != nil {
			response.RespondError(w, r, err)
			return
		}
		response.RespondOK(w, tags)
		return
	}
	result, err := h.svc.ListPage(r.Context(), response.ParsePageQuery(r))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, result.Items, result.Page, result.Limit, result.Total)
}

// Create 创建标签（后台）
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.Create(r.Context(), req.Name)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

// updateTagRequest 更新标签请求
type updateTagRequest struct {
	Name string `json:"name"`
}

// Update 更新标签（后台）
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	var req updateTagRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if req.Name == "" {
		response.RespondError(w, r, domainshared.BadRequest("标签名不能为空"))
		return
	}
	dto, err := h.svc.Update(r.Context(), apptag.UpdateInput{ID: int32(id), Name: req.Name})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// Delete 删除标签（后台）
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.svc.Delete(r.Context(), int32(id)); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "标签已删除")
}
