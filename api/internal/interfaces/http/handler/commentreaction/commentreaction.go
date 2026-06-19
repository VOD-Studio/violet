// Package commentreaction 提供 commentreaction 模块的 HTTP handler。
package commentreaction

import (
	"encoding/json"
	"net/http"
	"strconv"

	appcr "blog-api/internal/application/commentreaction"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
	"blog-api/internal/interfaces/http/response"
)

// Handler 评论反应 HTTP handler
type Handler struct {
	svc *appcr.Service
}

// NewHandler 构造评论反应 handler
func NewHandler(svc *appcr.Service) *Handler {
	return &Handler{svc: svc}
}

// GetCommentReactions 获取评论反应列表
func (h *Handler) GetCommentReactions(w http.ResponseWriter, r *http.Request) {
	commentID := r.PathValue("comment_id")
	reactions, err := h.svc.List(r.Context(), commentID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, reactions)
}

// AddReaction 添加反应
func (h *Handler) AddReaction(w http.ResponseWriter, r *http.Request) {
	commentID := r.PathValue("comment_id")
	var req struct {
		EmojiID int32 `json:"emoji_id" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	userID := interfacesmw.GetUserIDFromContext(r)
	ip := appcr.ExtractIP(r)
	if err := h.svc.Add(r.Context(), appcr.AddInput{
		CommentID: commentID, EmojiID: req.EmojiID, UserID: userID, IPAddress: ip,
	}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "反应已添加")
}

// RemoveReaction 移除反应
func (h *Handler) RemoveReaction(w http.ResponseWriter, r *http.Request) {
	commentID := r.PathValue("comment_id")
	emojiID, err := strconv.Atoi(r.PathValue("emoji_id"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	userID := interfacesmw.GetUserIDFromContext(r)
	ip := appcr.ExtractIP(r)
	if err := h.svc.Remove(r.Context(), commentID, userID, ip, int32(emojiID)); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "反应已移除")
}

// GetReactionsBatch 批量获取评论反应
func (h *Handler) GetReactionsBatch(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CommentIDs []string `json:"comment_ids" validate:"required,min=1"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	results, err := h.svc.Batch(r.Context(), req.CommentIDs)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, results)
}
