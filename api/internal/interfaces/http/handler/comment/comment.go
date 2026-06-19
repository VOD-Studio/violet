// Package comment 提供 comment 模块的 HTTP handler。
package comment

import (
	"encoding/json"
	"net/http"

	"github.com/go-playground/validator/v10"

	appcomment "blog-api/internal/application/comment"
	"blog-api/internal/interfaces/http/response"
)

// Handler 评论 HTTP 处理器
type Handler struct {
	svc      *appcomment.Service
	validate *validator.Validate
}

// NewHandler 创建评论 handler
func NewHandler(svc *appcomment.Service) *Handler {
	return &Handler{svc: svc, validate: validator.New()}
}

// ListByPost 按文章列出评论（前台公开）
func (h *Handler) ListByPost(w http.ResponseWriter, r *http.Request) {
	postID := r.PathValue("postId")
	page, limit := response.ParsePaging(r)
	items, total, err := h.svc.ListByPost(r.Context(), postID, page, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, items, page, limit, total)
}

// ListPending 列出待审核评论（后台）
func (h *Handler) ListPending(w http.ResponseWriter, r *http.Request) {
	page, limit := response.ParsePaging(r)
	items, total, err := h.svc.ListPending(r.Context(), page, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, items, page, limit, total)
}

// ListAll 全局评论列表（后台管理，支持状态筛选）
func (h *Handler) ListAll(w http.ResponseWriter, r *http.Request) {
	page, limit := response.ParsePaging(r)
	status := r.URL.Query().Get("status")
	items, total, err := h.svc.ListAll(r.Context(), status, page, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, items, page, limit, total)
}

// CountPending 统计待审核评论数量（后台角标）
func (h *Handler) CountPending(w http.ResponseWriter, r *http.Request) {
	count, err := h.svc.CountPending(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]any{"count": count})
}

// GetDetail 获取评论详情（后台管理，含所属文章）
func (h *Handler) GetDetail(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	dto, err := h.svc.GetDetail(r.Context(), id)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

type batchUpdateStatusRequest struct {
	IDs    []string `json:"ids" validate:"required,min=1,max=100"`
	Status string   `json:"status" validate:"required,oneof=pending approved spam deleted"`
}

// BatchUpdateStatus 批量更新评论状态
func (h *Handler) BatchUpdateStatus(w http.ResponseWriter, r *http.Request) {
	var req batchUpdateStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	affected, err := h.svc.BatchUpdateStatus(r.Context(), req.IDs, req.Status)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]any{"affected": affected})
}

type createCommentRequest struct {
	Body        string `json:"body" validate:"required"`
	ParentID    string `json:"parent_id"`
	AuthorName  string `json:"author_name" validate:"required"`
	AuthorEmail string `json:"author_email" validate:"required,email"`
	AuthorURL   string `json:"author_url"`
	AvatarURL   string `json:"avatar_url"`
}

// Create 创建评论（前台公开）
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	postID := r.PathValue("postId")
	var req createCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}

	dto, err := h.svc.Create(r.Context(), appcomment.CreateInput{
		PostID: postID, ParentID: req.ParentID,
		AuthorName: req.AuthorName, AuthorEmail: req.AuthorEmail,
		AuthorURL: req.AuthorURL, AvatarURL: req.AvatarURL,
		Body: req.Body,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

// Approve 审核通过
func (h *Handler) Approve(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Approve(r.Context(), id); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "评论已审核通过")
}

// MarkSpam 标记垃圾
func (h *Handler) MarkSpam(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.MarkSpam(r.Context(), id); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "评论已标记为垃圾")
}

// Delete 删除评论
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Delete(r.Context(), id); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "评论已删除")
}
