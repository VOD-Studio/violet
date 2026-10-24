package ompusage

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"

	app "blog-api/internal/application/omp_usage"
	"blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
	"blog-api/internal/middleware"
)

// MaxBatchBytes 在解析前限制请求体，事件数量另由应用层限制为 200。
const MaxBatchBytes = 512 * 1024

type Handler struct{ service *app.Service }

func NewHandler(service *app.Service) *Handler { return &Handler{service: service} }

func (h *Handler) Batch(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, MaxBatchBytes)
	var input struct {
		Events []app.EventInput `json:"events"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		response.RespondError(w, r, shared.BadRequest("请求体无效、含未知字段或超过 512 KiB"))
		return
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		response.RespondError(w, r, shared.BadRequest("请求体只能包含一个 JSON 对象"))
		return
	}
	result, err := h.service.Ingest(r.Context(), middleware.GetUserID(r.Context()), input.Events)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, result)
}

// 拒绝调用方指定身份及未知参数，不静默忽略越权意图。
func query(r *http.Request, timeseries bool) (string, string, error) {
	values, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		return "", "", shared.BadRequest("查询参数编码无效")
	}
	for key, entries := range values {
		if (key != "range" && (!timeseries || key != "bucket")) || len(entries) != 1 || entries[0] == "" {
			err = shared.BadRequest("查询参数无效")
			break
		}
	}
	return values.Get("range"), values.Get("bucket"), err
}

func (h *Handler) Summary(w http.ResponseWriter, r *http.Request) {
	selected, _, err := query(r, false)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	result, err := h.service.Summary(r.Context(), middleware.GetUserID(r.Context()), selected)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	response.RespondOK(w, result)
}

func (h *Handler) Models(w http.ResponseWriter, r *http.Request) {
	selected, _, err := query(r, false)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	result, err := h.service.Models(r.Context(), middleware.GetUserID(r.Context()), selected)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	response.RespondOK(w, result)
}

func (h *Handler) Timeseries(w http.ResponseWriter, r *http.Request) {
	selected, bucket, err := query(r, true)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	result, err := h.service.Timeseries(r.Context(), middleware.GetUserID(r.Context()), selected, bucket)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	response.RespondOK(w, result)
}
