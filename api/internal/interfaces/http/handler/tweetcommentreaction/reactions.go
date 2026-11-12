// Package tweetcommentreaction 提供推文评论回应的 HTTP 适配。
package tweetcommentreaction

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"

	app "blog-api/internal/application/tweetcommentreaction"
	"blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/middleware"
	"blog-api/internal/interfaces/http/response"
)

const maxBatchBodyBytes = 16 << 10

// Handler 推文评论回应处理器。
type Handler struct {
	svc *app.Service
}

// NewHandler 构造处理器。
func NewHandler(svc *app.Service) *Handler {
	return &Handler{svc: svc}
}

// List 获取评论的聚合回应。
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.List(r.Context(), r.PathValue("id"), r.PathValue("commentId"), middleware.GetUserIDFromContext(r))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, items)
}

// Batch 批量读取同一推文下的评论回应。
func (h *Handler) Batch(w http.ResponseWriter, r *http.Request) {
	var body struct {
		CommentIDs []string `json:"comment_ids"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBatchBodyBytes))
	if err := decoder.Decode(&body); err != nil {
		respondBatchDecodeError(w, r, err)
		return
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		if err == nil {
			err = shared.BadRequest("请求体只能包含一个 JSON 对象")
		}
		respondBatchDecodeError(w, r, err)
		return
	}
	items, err := h.svc.Batch(r.Context(), r.PathValue("id"), body.CommentIDs, middleware.GetUserIDFromContext(r))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, items)
}

func respondBatchDecodeError(w http.ResponseWriter, r *http.Request, err error) {
	var maxBytesErr *http.MaxBytesError
	if errors.As(err, &maxBytesErr) {
		response.RespondPayloadTooLarge(w, r, "请求体不能超过 16 KiB")
		return
	}
	response.RespondError(w, r, err)
}

// Add 添加一种系统目录表情回应。
func (h *Handler) Add(w http.ResponseWriter, r *http.Request) {
	var body struct {
		EmojiID int32 `json:"emoji_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.svc.Add(r.Context(), r.PathValue("id"), r.PathValue("commentId"), middleware.GetUserIDFromContext(r), body.EmojiID); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "回应已添加")
}

// Remove 移除自己的指定表情回应。
func (h *Handler) Remove(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("emojiId"), 10, 32)
	if err != nil || id <= 0 {
		response.RespondError(w, r, shared.BadRequest("表情 ID 必须为正整数"))
		return
	}
	if err := h.svc.Remove(r.Context(), r.PathValue("id"), r.PathValue("commentId"), middleware.GetUserIDFromContext(r), int32(id)); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "回应已移除")
}
