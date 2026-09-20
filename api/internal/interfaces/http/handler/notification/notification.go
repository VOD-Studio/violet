// Package notification 提供通知管理的 HTTP handler（登录用户视角）。
//
// 通知是 per-user 的私有数据，所有端点需登录（SessionAuth）。
// 写操作（标记已读）走 CSRF double-submit。
package notification

import (
	"encoding/json"
	"io"
	"net/http"

	appnotification "blog-api/internal/application/notification"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
	"blog-api/internal/middleware"
)

// Handler 通知 HTTP handler。
type Handler struct {
	svc  *appnotification.Service
	push *appnotification.PushService
}

// NewHandler 构造通知 handler。
func NewHandler(svc *appnotification.Service, push *appnotification.PushService) *Handler {
	return &Handler{svc: svc, push: push}
}

// List 列出当前用户的通知（分页）。
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID := mustGetUserID(r)

	result, err := h.svc.ListByUser(r.Context(), userID, response.ParsePageQuery(r))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, result.Items, result.Page, result.Limit, result.Total)
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

// --- 浏览器通知（Web Push）---

// PushConfig 返回站点 VAPID 公钥与推送启用状态（前端据此决定是否展示开关）。
func (h *Handler) PushConfig(w http.ResponseWriter, _ *http.Request) {
	response.RespondOK(w, map[string]any{
		"public_key": h.push.PublicKey(),
		"enabled":    h.push.Enabled(),
	})
}

// SavePushSubscription 注册当前浏览器的推送订阅。
func (h *Handler) SavePushSubscription(w http.ResponseWriter, r *http.Request) {
	userID := mustGetUserID(r)
	var req struct {
		Endpoint string `json:"endpoint"`
		Keys     struct {
			P256DH string `json:"p256dh"`
			Auth   string `json:"auth"`
		} `json:"keys"`
	}
	if err := decodeJSON(r, &req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.push.Subscribe(r.Context(), userID, req.Endpoint, req.Keys.P256DH, req.Keys.Auth, r.UserAgent()); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusCreated, "浏览器通知已启用")
}

// DeletePushSubscription 注销当前浏览器的推送订阅。
func (h *Handler) DeletePushSubscription(w http.ResponseWriter, r *http.Request) {
	userID := mustGetUserID(r)
	var req struct {
		Endpoint string `json:"endpoint"`
	}
	if err := decodeJSON(r, &req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.push.Unsubscribe(r.Context(), userID, req.Endpoint); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondNoContent(w)
}

// decodeJSON 解析请求体；上限 1MB（推送订阅是几百字节的密钥载荷）。
func decodeJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	if err := decoder.Decode(target); err != nil {
		return domainshared.BadRequest("请求体格式非法")
	}
	return nil
}
