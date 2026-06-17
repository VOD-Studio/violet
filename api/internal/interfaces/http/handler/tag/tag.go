// Package tag 提供 tag 模块的 HTTP handler。
package tag

import (
	"encoding/json"
	"net/http"
	"strconv"

	apptag "blog-api/internal/application/tag"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
)

// Handler 标签 HTTP handler
type Handler struct {
	svc *apptag.Service
}

// NewHandler 构造标签 handler
func NewHandler(svc *apptag.Service) *Handler {
	return &Handler{svc: svc}
}

// List 列出所有标签（公开）
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	tags, err := h.svc.List(r.Context())
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": tags})
}

// Create 创建标签（后台）
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.Create(r.Context(), req.Name)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": dto})
}

// Delete 删除标签（后台）
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.svc.Delete(r.Context(), int32(id)); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "标签已删除"})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
