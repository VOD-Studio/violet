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

type createTweetRequest struct {
	Content string   `json:"content"`
	Images  []string `json:"images"`
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
