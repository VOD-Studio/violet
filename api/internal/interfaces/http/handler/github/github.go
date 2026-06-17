// Package github 提供 github 模块的 HTTP handler。
package github

import (
	"encoding/json"
	"net/http"

	appgithub "blog-api/internal/application/github"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
)

// Handler GitHub 数据 HTTP handler
type Handler struct {
	svc *appgithub.Service
}

// NewHandler 构造 GitHub handler
func NewHandler(svc *appgithub.Service) *Handler {
	return &Handler{svc: svc}
}

// GetContributions 获取 GitHub 贡献数据（公开）
func (h *Handler) GetContributions(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetContributions(r.Context())
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": data})
}

// GetRepos 获取 GitHub 仓库数据（公开）
func (h *Handler) GetRepos(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetRepos(r.Context())
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": data})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
