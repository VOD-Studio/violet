package presence

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	apppresence "blog-api/internal/application/presence"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
	"blog-api/internal/middleware"
)

// streamHeartbeat 推送流心跳；短于反向代理默认的 60 秒空闲超时。
const streamHeartbeat = 25 * time.Second

// Handler 实时状态的后台管理、公开读取与推送流。
type Handler struct {
	svc *apppresence.Service
}

func NewHandler(svc *apppresence.Service) *Handler { return &Handler{svc: svc} }

// --- 后台 ---

// ListDevices 列出设备与连接诊断。GET /admin/presence/devices
func (h *Handler) ListDevices(w http.ResponseWriter, r *http.Request) {
	devices, err := h.svc.ListDevices(r.Context())
	respond(w, r, devices, err)
}

// IssueDevice 签发设备凭证；凭证只在本次响应出现。POST /admin/presence/devices
func (h *Handler) IssueDevice(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DisplayName string `json:"display_name"`
	}
	if !decode(w, r, &req) {
		return
	}
	issued, err := h.svc.IssueDevice(r.Context(), req.DisplayName)
	w.Header().Set("Cache-Control", "no-store")
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, issued)
}

// RevokeDevice 撤销设备并断开其连接。DELETE /admin/presence/devices/{id}
func (h *Handler) RevokeDevice(w http.ResponseWriter, r *http.Request) {
	respond(w, r, nil, h.svc.RevokeDevice(r.Context(), r.PathValue("id")))
}

// Settings 读取公开策略。GET /admin/presence/settings
func (h *Handler) Settings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.svc.Settings(r.Context())
	respond(w, r, settings, err)
}

// UpdateSettings 覆盖公开策略。PUT /admin/presence/settings
func (h *Handler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PublicRead *bool `json:"public_read"`
	}
	if !decode(w, r, &req) {
		return
	}
	if req.PublicRead == nil {
		response.RespondError(w, r, domainshared.Validation("public_read 必填"))
		return
	}
	actorID, err := domainshared.ParseID(middleware.GetUserID(r.Context()))
	if err != nil {
		response.RespondError(w, r, domainshared.Unauthorized("未登录"))
		return
	}
	settings, err := h.svc.UpdateSettings(r.Context(), actorID, apppresence.SettingsDTO{PublicRead: *req.PublicRead})
	respond(w, r, settings, err)
}

// --- 公开 ---

// Public 读取当前公开状态；公开读取关闭时设备列表为空。GET /presence
func (h *Handler) Public(w http.ResponseWriter, r *http.Request) {
	presence, err := h.svc.Public(r.Context())
	respond(w, r, presence, err)
}

// Stream 推送当前公开状态：连上立即发一次，之后每次变化重发完整状态。GET /presence/stream
//
// 事件名 presence，data 与 GET /presence 的 data 字段同形。
func (h *Handler) Stream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		response.RespondError(w, r, domainshared.Internal("服务器不支持流式响应", nil))
		return
	}
	changes, unsubscribe, err := h.svc.Subscribe()
	if err != nil {
		w.Header().Set("Retry-After", "30")
		status := http.StatusServiceUnavailable
		if errors.Is(err, apppresence.ErrTooManySubscribers) {
			status = http.StatusTooManyRequests
		}
		response.RespondMessage(w, status, "实时状态推送暂不可用")
		return
	}
	defer unsubscribe()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)

	ctx := r.Context()
	push := func() bool {
		presence, err := h.svc.Public(ctx)
		if err != nil {
			return false
		}
		data, err := json.Marshal(presence)
		if err != nil {
			return false
		}
		if _, err := w.Write([]byte("event: presence\ndata: " + string(data) + "\n\n")); err != nil {
			return false
		}
		flusher.Flush()
		return true
	}
	if !push() {
		return
	}
	heartbeat := time.NewTicker(streamHeartbeat)
	defer heartbeat.Stop()
	for {
		select {
		case _, open := <-changes:
			if !open || !push() {
				return
			}
		case <-heartbeat.C:
			if _, err := w.Write([]byte(": heartbeat\n\n")); err != nil {
				return
			}
			flusher.Flush()
		case <-ctx.Done():
			return
		}
	}
}

func respond(w http.ResponseWriter, r *http.Request, value any, err error) {
	w.Header().Set("Cache-Control", "no-store")
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, value)
}

func decode(w http.ResponseWriter, r *http.Request, target any) bool {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		response.RespondError(w, r, domainshared.BadRequest("请求体格式错误"))
		return false
	}
	return true
}
