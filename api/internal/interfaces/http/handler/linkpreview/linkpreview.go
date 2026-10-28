package linkpreview

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-playground/validator/v10"

	applp "blog-api/internal/application/linkpreview"
	"blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
)

type lookupService interface {
	Lookup(ctx context.Context, urls []string) (applp.LookupResultDTO, error)
}

type Handler struct {
	svc      lookupService
	validate *validator.Validate
}

func NewHandler(svc *applp.Service) *Handler {
	return &Handler{svc: svc, validate: validator.New()}
}

type lookupRequest struct {
	URLs []string `json:"urls" validate:"required,min=1,max=10"`
}

// Lookup 返回当前快照和未完成、不可展示的链接；上游拒绝读取不作为本站 HTTP 错误。
func (h *Handler) Lookup(w http.ResponseWriter, r *http.Request) {
	var req lookupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, shared.Validation("链接请求不是有效的 JSON"))
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, shared.Validation("每次查询需要 1 至 10 个链接"))
		return
	}
	result, err := h.svc.Lookup(r.Context(), req.URLs)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, result)
}
