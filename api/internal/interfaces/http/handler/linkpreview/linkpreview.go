// Package linkpreview 提供链接卡片模块的 HTTP handler。
package linkpreview

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-playground/validator/v10"

	applp "blog-api/internal/application/linkpreview"
	"blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
)

// lookupService handler 层依赖的 application service 接口视图。
//
// 独立定义而非直接用 *applp.Service：让 handler 测试可注入 stub
// （与 friendlink handler 同模式）。
type lookupService interface {
	Lookup(ctx context.Context, urls []string) map[string]*applp.LinkCardDTO
}

// Handler 链接卡片 HTTP 处理器。
type Handler struct {
	svc      lookupService
	validate *validator.Validate
}

// NewHandler 创建 handler。
func NewHandler(svc *applp.Service) *Handler {
	return &Handler{svc: svc, validate: validator.New()}
}

// lookupRequest 批量取卡片请求体。
type lookupRequest struct {
	// URLs 原文链接列表，≤10 个；非法项（非 http/https、解析失败）由服务端规范化丢弃
	URLs []string `json:"urls" validate:"required,max=10"`
}

// Lookup 批量取链接卡片（POST /link-cards/lookup）。
//
// 返回当前可展示的卡片（key 为规范化 URL）；miss 或过期的在后台异步抓取，
// 本次响应不含。公开端点：IP 限流由路由层挂载。
func (h *Handler) Lookup(w http.ResponseWriter, r *http.Request) {
	var req lookupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		var invalidErr validator.ValidationErrors
		if errors.As(err, &invalidErr) {
			response.RespondError(w, r, shared.Validation("链接数量超过上限"))
			return
		}
		response.RespondError(w, r, err)
		return
	}
	cards := h.svc.Lookup(r.Context(), req.URLs)
	if cards == nil {
		cards = map[string]*applp.LinkCardDTO{}
	}
	response.RespondOK(w, map[string]any{"cards": cards})
}
