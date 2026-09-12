package runtimelog

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	domainlog "blog-api/internal/domain/runtimelog"
	"blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
	"blog-api/internal/middleware"
)

const (
	streamWriteTimeout = 5 * time.Second
	streamAuthInterval = 5 * time.Second
	streamHeartbeat    = 15 * time.Second
	streamDrainBatches = 4
)

var errStreamWrite = errors.New("runtime log stream write failed")

func (h *Handler) Stream(w http.ResponseWriter, r *http.Request) {
	_, ok := w.(http.Flusher)
	if !ok {
		response.RespondError(w, r, shared.Internal("服务器不支持流式响应", nil))
		return
	}
	filter, err := parseFilter(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	filter.Before = 0
	filter.Ascending = true
	cursor, err := h.streamCursor(r, filter.After)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	filter.AfterSet = true
	if !h.delivery.acquireStream() {
		w.Header().Set("Retry-After", "2")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte(`{"error":"capacity_exceeded","message":"实时日志连接已满，请稍后重试"}`))
		return
	}
	defer h.delivery.activeStreams.Add(-1)

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-store")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	if err := writeSSEEvent(w, "ready", strconv.FormatInt(cursor, 10), struct {
		Cursor         string `json:"cursor"`
		BatchLimit     int    `json:"batch_limit"`
		PollIntervalMS int    `json:"poll_interval_ms"`
	}{strconv.FormatInt(cursor, 10), streamBatchLimit, streamPollInterval}); err != nil {
		h.delivery.streamWriteFailures.Add(1)
		return
	}

	poll := time.NewTicker(time.Duration(streamPollInterval) * time.Millisecond)
	auth := time.NewTicker(streamAuthInterval)
	heartbeat := time.NewTicker(streamHeartbeat)
	defer poll.Stop()
	defer auth.Stop()
	defer heartbeat.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-poll.C:
			next, err := h.drainStream(r.Context(), w, filter, cursor)
			if err != nil {
				if errors.Is(err, errStreamWrite) {
					h.delivery.streamWriteFailures.Add(1)
					return
				}
				h.delivery.streamReadFailures.Add(1)
				if writeErr := writeSSEEvent(w, "stream-error", strconv.FormatInt(cursor, 10), map[string]string{
					"message": "运行日志实时读取暂时中断，将从当前游标重连",
				}); writeErr != nil {
					h.delivery.streamWriteFailures.Add(1)
				}
				return
			}
			cursor = next
		case <-auth.C:
			checkCtx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			allowed := h.access != nil && h.access.CanRead(
				checkCtx,
				middleware.GetSessionID(r.Context()),
				middleware.GetUserID(r.Context()),
			)
			cancel()
			if !allowed {
				h.delivery.streamAccessRevoked.Add(1)
				if err := writeSSEEvent(w, "access-revoked", strconv.FormatInt(cursor, 10), map[string]string{
					"message": "会话或运行日志权限已失效",
				}); err != nil {
					h.delivery.streamWriteFailures.Add(1)
				}
				return
			}
		case <-heartbeat.C:
			if err := writeSSEEvent(w, "heartbeat", strconv.FormatInt(cursor, 10), struct{}{}); err != nil {
				h.delivery.streamWriteFailures.Add(1)
				return
			}
		}
	}
}

func (h *Handler) streamCursor(r *http.Request, queryCursor int64) (int64, error) {
	cursor := queryCursor
	if value := r.Header.Get("Last-Event-ID"); value != "" {
		parsed, err := strconv.ParseInt(value, 10, 64)
		if err != nil || parsed < 0 {
			return 0, shared.BadRequest("Last-Event-ID 日志游标格式错误")
		}
		cursor = parsed
	}
	if r.URL.Query().Has("after") || r.Header.Get("Last-Event-ID") != "" {
		return cursor, nil
	}
	bounds, err := h.service.CurrentBounds(r.Context())
	if err != nil {
		return 0, err
	}
	return bounds.Newest, nil
}

func (h *Handler) drainStream(ctx context.Context, w http.ResponseWriter, filter domainlog.Filter, cursor int64) (int64, error) {
	for range streamDrainBatches {
		filter.After = cursor
		filter.Limit = streamBatchLimit
		page, err := h.service.List(ctx, filter)
		if err != nil {
			return cursor, err
		}
		if page.Gap {
			oldest, _ := strconv.ParseInt(page.OldestCursor, 10, 64)
			newest, _ := strconv.ParseInt(page.NewestCursor, 10, 64)
			resume := newest
			if oldest > 0 {
				resume = oldest - 1
			}
			if err := writeSSEEvent(w, "gap", strconv.FormatInt(resume, 10), struct {
				OldestCursor string `json:"oldest_cursor"`
				NewestCursor string `json:"newest_cursor"`
				ResumeCursor string `json:"resume_cursor"`
			}{page.OldestCursor, page.NewestCursor, strconv.FormatInt(resume, 10)}); err != nil {
				return cursor, fmt.Errorf("%w: %v", errStreamWrite, err)
			}
			cursor = resume
		}
		if len(page.Items) > 0 {
			cursor = page.Items[len(page.Items)-1].ID
			if err := writeSSEEvent(w, "logs", strconv.FormatInt(cursor, 10), struct {
				Items []domainlog.Entry `json:"items"`
			}{page.Items}); err != nil {
				return cursor, fmt.Errorf("%w: %v", errStreamWrite, err)
			}
		}
		if !page.HasMore {
			newest, _ := strconv.ParseInt(page.NewestCursor, 10, 64)
			if newest > cursor {
				if err := writeSSEEvent(w, "checkpoint", page.NewestCursor, struct {
					Cursor string `json:"cursor"`
				}{page.NewestCursor}); err != nil {
					return cursor, fmt.Errorf("%w: %v", errStreamWrite, err)
				}
				cursor = newest
			}
			return cursor, nil
		}
	}
	return cursor, nil
}

func writeSSEEvent(w http.ResponseWriter, event, id string, value any) error {
	payload, err := json.Marshal(value)
	if err != nil {
		return err
	}
	controller := http.NewResponseController(w)
	_ = controller.SetWriteDeadline(time.Now().Add(streamWriteTimeout))
	_, err = fmt.Fprintf(w, "id: %s\nevent: %s\ndata: %s\nretry: 1000\n\n", id, event, payload)
	if err == nil {
		err = controller.Flush()
	}
	_ = controller.SetWriteDeadline(time.Time{})
	return err
}
