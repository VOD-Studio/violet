// Package github 提供 github 模块的 HTTP handler。
package github

import (
	"net/http"

	appgithub "blog-api/internal/application/github"
	"blog-api/internal/interfaces/http/response"
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
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}

// GetRepos 获取 GitHub 仓库数据（公开）
func (h *Handler) GetRepos(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetRepos(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}
