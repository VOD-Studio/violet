// Package comment 提供 comment 模块的 HTTP handler（DDD 版）。
package comment

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-playground/validator/v10"

	appcomment "blog-api/internal/application/comment"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
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
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}

	items, total, err := h.svc.ListByPost(r.Context(), postID, page, limit)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": items, "total": total})
}

// ListPending 列出待审核评论（后台）
func (h *Handler) ListPending(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}

	items, total, err := h.svc.ListPending(r.Context(), page, limit)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": items, "total": total})
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
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}

	dto, err := h.svc.Create(r.Context(), appcomment.CreateInput{
		PostID: postID, ParentID: req.ParentID,
		AuthorName: req.AuthorName, AuthorEmail: req.AuthorEmail,
		AuthorURL: req.AuthorURL, AvatarURL: req.AvatarURL,
		Body: req.Body,
	})
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": dto})
}

// Approve 审核通过
func (h *Handler) Approve(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Approve(r.Context(), id); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "评论已审核通过"})
}

// MarkSpam 标记垃圾
func (h *Handler) MarkSpam(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.MarkSpam(r.Context(), id); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "评论已标记为垃圾"})
}

// Delete 删除评论
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Delete(r.Context(), id); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "评论已删除"})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
