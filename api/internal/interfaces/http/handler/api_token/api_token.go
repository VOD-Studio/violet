// Package apitoken 提供 PAT 管理的 HTTP handler（后台 CRUD）。
package apitoken

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-playground/validator/v10"

	appapitoken "blog-api/internal/application/api_token"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
	"blog-api/internal/interfaces/http/response"
)

// 预定义过期选项（秒）。前端传 expiry 字符串枚举，映射到 Duration。
var expiryOptions = map[string]time.Duration{
	"90d":  90 * 24 * time.Hour,
	"365d": 365 * 24 * time.Hour,
	"never": 0,
}

// Handler PAT 管理 HTTP handler。
type Handler struct {
	svc      *appapitoken.Service
	validate *validator.Validate
}

// NewHandler 构造 PAT 管理 handler。
func NewHandler(svc *appapitoken.Service) *Handler {
	return &Handler{svc: svc, validate: validator.New()}
}

type createTokenRequest struct {
	Name   string   `json:"name" validate:"required,max=100"`
	Scopes []string `json:"scopes" validate:"required,min=1,dive,oneof=posts:read posts:write posts:publish"`
	Expiry string   `json:"expiry" validate:"omitempty,oneof=90d 365d never"`
}

// Create 创建 PAT（后台 admin）。返回明文 token，仅此一次。
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	var req createTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	expiry := req.Expiry
	if expiry == "" {
		expiry = "90d" // 默认 90 天（spec：默认 90 天）
	}
	result, err := h.svc.Create(r.Context(), appapitoken.CreateInput{
		UserID:    userID,
		Name:      req.Name,
		Scopes:    req.Scopes,
		ExpiresIn: expiryOptions[expiry],
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, result.Token)
}

// List 列出当前用户的全部 PAT。
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	dtos, err := h.svc.List(r.Context(), userID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dtos)
}

// Delete 吊销 PAT。
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	userID := interfacesmw.GetUserIDFromContext(r)
	if err := h.svc.Delete(r.Context(), id, userID); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "令牌已吊销")
}
