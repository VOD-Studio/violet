// Package tweet 提供推文前台 HTTP handler。
//
// 路由鉴权在 routing 层区分（公开 GET 裸挂 / 写操作 SessionAuth + 发布限流），
// handler 只做 HTTP 适配；删除的「作者或 tweet:delete-any」双重判定在应用层
// （application/tweet.Service.Delete），与 post 模块同构。
package tweet

import (
	"encoding/json"
	"net/http"

	apptweet "blog-api/internal/application/tweet"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
	"blog-api/internal/interfaces/http/response"
)

// Handler 推文 HTTP handler。
type Handler struct {
	svc *apptweet.Service
}

// NewHandler 构造推文 handler。
func NewHandler(svc *apptweet.Service) *Handler {
	return &Handler{svc: svc}
}

// ListTimeline 全局时间线（公开）：GET /tweets?cursor=&limit=
func (h *Handler) ListTimeline(w http.ResponseWriter, r *http.Request) {
	cursor, limit := response.ParseCursor(r)
	dtos, nextCursor, err := h.svc.ListTimeline(r.Context(), cursor, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCursor(w, dtos, limit, nextCursor != "", nextCursor)
}
// ListByTopic 话题时间线（公开）：GET /tweets/topics/{tag}?cursor=&limit=
func (h *Handler) ListByTopic(w http.ResponseWriter, r *http.Request) {
	cursor, limit := response.ParseCursor(r)
	dtos, nextCursor, err := h.svc.ListByTopic(r.Context(), r.PathValue("tag"), cursor, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCursor(w, dtos, limit, nextCursor != "", nextCursor)
}

type createTweetRequest struct {
	Content string   `json:"content"`
	Images  []string `json:"images"`
	QuoteOf *string  `json:"quote_of,omitempty"`
}

// Create 发推文（登录）：POST /tweets
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req createTweetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.Create(r.Context(), apptweet.CreateInput{
		AuthorID: interfacesmw.GetUserIDFromContext(r),
		Content:  req.Content,
		Images:   req.Images,
		QuoteOf:  req.QuoteOf,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

// Get 推文详情（公开）：GET /tweets/{id}
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	dto, err := h.svc.GetByID(r.Context(), r.PathValue("id"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// Delete 删除推文（登录，作者或 tweet:delete-any）：DELETE /tweets/{id}
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.Delete(r.Context(), r.PathValue("id")); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "推文已删除")
}

// ListByUser 用户主页推文列表（公开）：GET /users/{username}/tweets
func (h *Handler) ListByUser(w http.ResponseWriter, r *http.Request) {
	cursor, limit := response.ParseCursor(r)
	dtos, nextCursor, err := h.svc.ListByUser(r.Context(), r.PathValue("username"), cursor, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCursor(w, dtos, limit, nextCursor != "", nextCursor)
}
// GetUserProfile 用户公开资料卡（公开）：GET /users/{username}
func (h *Handler) GetUserProfile(w http.ResponseWriter, r *http.Request) {
	dto, err := h.svc.GetUserProfile(r.Context(), r.PathValue("username"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}
// Like 点赞推文（登录）：POST /tweets/{id}/like
func (h *Handler) Like(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	if err := h.svc.Like(r.Context(), userID, r.PathValue("id")); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]string{"message": "已点赞"})
}

// Unlike 取消点赞推文（登录）：DELETE /tweets/{id}/like
func (h *Handler) Unlike(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	if err := h.svc.Unlike(r.Context(), userID, r.PathValue("id")); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]string{"message": "已取消点赞"})
}


// --- 推文评论（P2 / issue #107）---

type createCommentRequest struct {
	Body     string               `json:"body"`
	ParentID string               `json:"parent_id"`
	// Pictures 评论附图（可选，Bilibili 式，url/width/height/size）
	Pictures []apptweet.PictureInput `json:"pictures"`
}

// CreateComment 创建评论/回复（登录）：POST /tweets/{id}/comments
func (h *Handler) CreateComment(w http.ResponseWriter, r *http.Request) {
	var req createCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.CreateComment(r.Context(), apptweet.CreateCommentInput{
		TweetID:  r.PathValue("id"),
		AuthorID: interfacesmw.GetUserIDFromContext(r),
		Body:     req.Body,
		Pictures: apptweet.PicturesToDomain(req.Pictures),
		ParentID: req.ParentID,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

// DeleteComment 删除评论（登录，作者或 tweet:delete-any）：DELETE /tweets/{id}/comments/{commentId}
func (h *Handler) DeleteComment(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.DeleteComment(r.Context(), r.PathValue("commentId")); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "评论已删除")
}

// ListComments 列出推文下的顶层评论（公开）：GET /tweets/{id}/comments
func (h *Handler) ListComments(w http.ResponseWriter, r *http.Request) {
	page, limit := response.ParsePaging(r)
	dtos, total, err := h.svc.ListComments(r.Context(), r.PathValue("id"), page, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, dtos, page, limit, total)
}

// ListReplies 列出某顶层评论下的回复（公开）：GET /tweets/{id}/comments/{commentId}/replies
func (h *Handler) ListReplies(w http.ResponseWriter, r *http.Request) {
	page, limit := response.ParsePaging(r)
	dtos, total, err := h.svc.ListReplies(r.Context(), r.PathValue("commentId"), page, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, dtos, page, limit, total)
}