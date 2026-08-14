package notification

import (
	"net/http"
	"time"

	appnotification "blog-api/internal/application/notification"
	domainnotification "blog-api/internal/domain/notification"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
)

// StreamHandler 通知 SSE 流 handler。
//
// 与 code-runner 的 Stream 不同：通知是持续长连接（非一次性 channel），
// 连接管理器维护在线用户连接池，通知写入时广播。
type StreamHandler struct {
	mgr *appnotification.ConnectionManager
	svc *appnotification.Service
}

// NewStreamHandler 构造 SSE 流 handler。
func NewStreamHandler(mgr *appnotification.ConnectionManager, svc *appnotification.Service) *StreamHandler {
	return &StreamHandler{mgr: mgr, svc: svc}
}

// Stream 建立 SSE 连接，持续推送新通知。
//
// GET /notifications/stream。登录鉴权。
// - 心跳 30s（防 Nginx/负载均衡器断开空闲连接）
// - Last-Event-ID：客户端重连时带最后收到的通知 ID，服务端补发漏掉的通知
func (h *StreamHandler) Stream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		response.RespondError(w, r, domainshared.Internal("服务器不支持流式响应", nil))
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	userID := mustGetUserID(r)

	// Last-Event-ID 补发：重连时补发断连期间的通知
	if lastEventID := r.Header.Get("Last-Event-ID"); lastEventID != "" {
		if afterID, err := domainshared.ParseID(lastEventID); err == nil {
			missed, err := h.svc.FindAfterID(r.Context(), userID, afterID, 50)
			if err == nil {
				for _, n := range missed {
					writeNotificationSSE(w, n)
				}
				flusher.Flush()
			}
		}
	}

	// 注册在线连接
	ch, cleanup := h.mgr.Register(userID)
	defer cleanup()

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	ctx := r.Context()
	for {
		select {
		case event := <-ch:
			data := appnotification.EventToJSON(event)
			if _, err := w.Write([]byte("id: " + event.ID + "\n")); err != nil {
				return
			}
			if _, err := w.Write([]byte("data: " + data + "\n\n")); err != nil {
				return
			}
			flusher.Flush()
		case <-ticker.C:
			if _, err := w.Write([]byte(": heartbeat\n\n")); err != nil {
				return
			}
			flusher.Flush()
		case <-ctx.Done():
			return
		}
	}
}

// writeNotificationSSE 写单条通知为 SSE 事件（补发用）。
func writeNotificationSSE(w http.ResponseWriter, n *domainnotification.Notification) {
	data := appnotification.EventToJSON(appnotification.SSEEvent{
		ID:         n.GetID().String(),
		SourceType: string(n.SourceType()),
		SourceID:   n.SourceID().String(),
		Title:      n.Title(),
		Body:       n.Body(),
		Payload:    n.Payload(),
		CreatedAt:  n.CreatedAt().Format(time.RFC3339),
	})
	_, _ = w.Write([]byte("id: " + n.GetID().String() + "\n"))
	_, _ = w.Write([]byte("data: " + data + "\n\n"))
}
