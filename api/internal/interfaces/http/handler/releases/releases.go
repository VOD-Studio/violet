// Package releases 提供 releases 模块的 HTTP handler。
package releases

import (
	"net/http"

	appreleases "blog-api/internal/application/releases"
	"blog-api/internal/interfaces/http/response"
)

// Handler 更新日志 HTTP handler
type Handler struct {
	svc *appreleases.Service
}

// NewHandler 构造更新日志 handler
func NewHandler(svc *appreleases.Service) *Handler {
	return &Handler{svc: svc}
}

// GetReleases 公开更新日志（About 页更新日志区块用，无需鉴权）
func (h *Handler) GetReleases(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.Get(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, data)
}
