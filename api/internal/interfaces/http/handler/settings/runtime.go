package settings

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	appsettings "blog-api/internal/application/settings"
	"blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
)

// RuntimeHandler 只暴露固定四组策略，不提供任意键写入口。
type RuntimeHandler struct{ policies *appsettings.RuntimePolicies }

func NewRuntimeHandler(policies *appsettings.RuntimePolicies) *RuntimeHandler {
	return &RuntimeHandler{policies: policies}
}

func runtimeError(w http.ResponseWriter, r *http.Request, err error) {
	var validation *appsettings.RuntimeValidationError
	if errors.As(err, &validation) {
		response.WriteJSON(w, http.StatusBadRequest, map[string]any{"error": "VALIDATION_ERROR", "message": validation.Error(), "request_id": response.GetRequestID(r), "details": validation.Details})
		return
	}
	response.RespondError(w, r, err)
}

func getRuntime[T any](w http.ResponseWriter, r *http.Request, get func(context.Context) (appsettings.RuntimeView[T], error)) {
	view, err := get(r.Context())
	if err != nil {
		runtimeError(w, r, err)
		return
	}
	response.RespondOK(w, view)
}

func updateRuntime[T any](w http.ResponseWriter, r *http.Request, update func(context.Context, appsettings.RuntimeUpdate) (appsettings.RuntimeView[T], error)) {
	var in appsettings.RuntimeUpdate
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&in); err != nil {
		runtimeError(w, r, shared.BadRequest("请求格式错误："+err.Error()))
		return
	}
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		runtimeError(w, r, shared.BadRequest("请求只能包含一个 JSON 对象"))
		return
	}
	view, err := update(r.Context(), in)
	if err != nil {
		runtimeError(w, r, err)
		return
	}
	response.RespondOK(w, view)
}

func (h *RuntimeHandler) GetRateLimit(w http.ResponseWriter, r *http.Request) {
	getRuntime(w, r, h.policies.GetRateLimit)
}
func (h *RuntimeHandler) UpdateRateLimit(w http.ResponseWriter, r *http.Request) {
	updateRuntime(w, r, h.policies.UpdateRateLimit)
}
func (h *RuntimeHandler) GetImage(w http.ResponseWriter, r *http.Request) {
	getRuntime(w, r, h.policies.GetImage)
}
func (h *RuntimeHandler) UpdateImage(w http.ResponseWriter, r *http.Request) {
	updateRuntime(w, r, h.policies.UpdateImage)
}
func (h *RuntimeHandler) GetUploadQueue(w http.ResponseWriter, r *http.Request) {
	getRuntime(w, r, h.policies.GetUploadQueue)
}
func (h *RuntimeHandler) UpdateUploadQueue(w http.ResponseWriter, r *http.Request) {
	updateRuntime(w, r, h.policies.UpdateUploadQueue)
}
func (h *RuntimeHandler) GetCodeRunner(w http.ResponseWriter, r *http.Request) {
	getRuntime(w, r, h.policies.GetCodeRunner)
}
func (h *RuntimeHandler) UpdateCodeRunner(w http.ResponseWriter, r *http.Request) {
	updateRuntime(w, r, h.policies.UpdateCodeRunner)
}

// GetUploadQueuePolicy 仅供已登录上传者读取当前实例的有效调度上限。
func (h *RuntimeHandler) GetUploadQueuePolicy(w http.ResponseWriter, r *http.Request) {
	if err := h.policies.UploadQueueError(); err != nil {
		runtimeError(w, r, shared.Internal("上传调度策略暂不可用", err))
		return
	}
	value, version := h.policies.UploadQueue()
	response.RespondOK(w, map[string]any{"version": version, "max_concurrent_files": value.MaxConcurrentFiles})
}
