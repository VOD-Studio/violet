package runtimelog

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"

	applog "blog-api/internal/application/runtimelog"
	domainlog "blog-api/internal/domain/runtimelog"
	"blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
)

type updatePolicyRequest struct {
	ExpectedVersion *int64 `json:"expected_version"`
	RetentionDays   int    `json:"retention_days"`
	MaxRecords      int64  `json:"max_records"`
	MaxBytes        int64  `json:"max_bytes"`
}

func (h *Handler) GetPolicy(w http.ResponseWriter, r *http.Request) {
	snapshot, err := h.maintenance.Snapshot(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	response.RespondOK(w, snapshot)
}

func (h *Handler) UpdatePolicy(w http.ResponseWriter, r *http.Request) {
	var req updatePolicyRequest
	if err := decodePolicyRequest(w, r, &req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if req.ExpectedVersion == nil {
		response.RespondError(w, r, shared.BadRequest("expected_version 必须是非负整数"))
		return
	}
	policy, err := h.maintenance.UpdatePolicy(
		r.Context(), *req.ExpectedVersion, req.RetentionDays, req.MaxRecords, req.MaxBytes,
	)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	response.RespondOK(w, struct {
		Policy   domainlog.Policy      `json:"policy"`
		Rotation applog.RotationStatus `json:"rotation"`
	}{Policy: policy, Rotation: h.maintenance.Status()})
}

func (h *Handler) Rotate(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 45*time.Second)
	defer cancel()
	result, err := h.maintenance.RotateNow(ctx)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	response.RespondOK(w, struct {
		Result   applog.RotationResult `json:"result"`
		Rotation applog.RotationStatus `json:"rotation"`
	}{Result: result, Rotation: h.maintenance.Status()})
}

func decodePolicyRequest(w http.ResponseWriter, r *http.Request, target any) error {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return shared.BadRequest("请求格式错误：" + err.Error())
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return shared.BadRequest("请求只能包含一个 JSON 对象")
	}
	return nil
}
