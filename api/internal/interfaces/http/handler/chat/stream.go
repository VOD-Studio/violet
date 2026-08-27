package chat

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	appchat "blog-api/internal/application/chat"
	"blog-api/internal/interfaces/http/response"
)

type StreamHandler struct {
	manager *appchat.ConnectionManager
	svc     *appchat.Service
}

// NewStreamHandler 构造聊天 SSE handler。
func NewStreamHandler(manager *appchat.ConnectionManager, svc *appchat.Service) *StreamHandler {
	return &StreamHandler{manager: manager, svc: svc}
}

// Stream 建立当前用户聊天事件流。
func (h *StreamHandler) Stream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		response.RespondError(w, r, fmt.Errorf("当前响应不支持 SSE"))
		return
	}
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	lastSequence := int64(0)
	if value := r.Header.Get("Last-Event-ID"); value != "" {
		lastSequence, err = strconv.ParseInt(value, 10, 64)
		if err != nil || lastSequence < 0 {
			lastSequence = 0
		}
	}
	if events, replayErr := h.svc.EventsAfter(r.Context(), userID, lastSequence, 100); replayErr == nil {
		for _, event := range events {
			writeEvent(w, event)
		}
		flusher.Flush()
	}

	ch, cleanup := h.manager.Register(userID)
	defer cleanup()
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case event, open := <-ch:
			if !open {
				return
			}
			writeEvent(w, event)
			flusher.Flush()
		case <-ticker.C:
			_, _ = fmt.Fprint(w, ": heartbeat\n\n")
			flusher.Flush()
		}
	}
}

// writeEvent 写一帧 SSE。空 ID（瞬态事件，如输入状态）不写 `id:` 行——
// 该字段驱动浏览器自动重连的 Last-Event-ID，写入瞬态事件会污染其他事件类型
// 依赖的补发序号。
func writeEvent(w http.ResponseWriter, event appchat.EventDTO) {
	if event.ID != "" {
		fmt.Fprintf(w, "id: %s\n", event.ID)
	}
	fmt.Fprintf(w, "event: chat\ndata: %s\n\n", appchat.MarshalEvent(event))
}
