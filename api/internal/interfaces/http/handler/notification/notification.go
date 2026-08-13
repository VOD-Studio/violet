// Package notification 提供通知管理的 HTTP handler（登录用户视角）。
//
// 通知是 per-user 的私有数据，所有端点需登录（SessionAuth）。
// 写操作（标记已读）走 CSRF double-submit。
package notification

import (
	"net/http"

	appnotification "blog-api/internal/application/notification"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
	"blog-api/internal/middleware"
)

// Handler 通知 HTTP handler。
type Handler struct {
	svc *appnotification.Service
}

// NewHandler 构造通知 handler。
func NewHandler(svc *appnotification.Service) *Handler {
	return &Handler{svc: svc}
}

// List 列出当前用户的通知（分页）。
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID := mustGetUserID(r)
	page, limit := response.ParsePaging(r)

	dtos, total, err := h.svc.ListByUser(r.Context(), userID, page, limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, dtos, page, limit, total)
}

// UnreadCount 返回当前用户的未读通知数。
func (h *Handler) UnreadCount(w http.ResponseWriter, r *http.Request) {
	userID := mustGetUserID(r)
	count, err := h.svc.CountUnread(r.Context(), userID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]any{"unread_count": count})
}

// MarkRead 标记单条通知已读。
func (h *Handler) MarkRead(w http.ResponseWriter, r *http.Request) {
	userID := mustGetUserID(r)
	notiID, err := domainshared.ParseID(r.PathValue("id"))
	if err != nil {
		response.RespondError(w, r, domainshared.ErrInvalidID)
		return
	}
	if err := h.svc.MarkAsRead(r.Context(), notiID, userID); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "已标记已读")
}

// MarkAllRead 标记当前用户全部通知已读。
func (h *Handler) MarkAllRead(w http.ResponseWriter, r *http.Request) {
	userID := mustGetUserID(r)
	if err := h.svc.MarkAllAsRead(r.Context(), userID); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "全部已读")
}

// mustGetUserID 从 ctx 提取当前登录用户 ID（SessionAuth 已保证非空）。
func mustGetUserID(r *http.Request) domainshared.ID {
	idStr := middleware.GetUserID(r.Context())
	id, _ := domainshared.ParseID(idStr)
	return id
}
