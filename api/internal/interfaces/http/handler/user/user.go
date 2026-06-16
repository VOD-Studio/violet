// Package user 提供 interfaces 层的 HTTP handler（DDD 版）。
//
// 与 internal/handler（旧分层）并存，P2 阶段逐步迁移并最终替换旧 handler。
// 本 handler 不直接依赖 service/queries，而是依赖 application 层的用例 Handler。
package user

import (
	"encoding/json"
	"net/http"

	"github.com/go-playground/validator/v10"

	"blog-api/internal/application/user/command"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
)

// RegisterRequest 注册请求 DTO
type RegisterRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Username string `json:"username" validate:"required,min=3,max=32"`
	Password string `json:"password" validate:"required,min=8,max=72"`
}

// RegisterResponse 注册响应 DTO
type RegisterResponse struct {
	UserID string `json:"user_id"`
}

// Handler 用户相关 HTTP 处理器（DDD 版）
type Handler struct {
	registerHandler *command.RegisterUserHandler
	validate        *validator.Validate
}

// NewHandler 创建用户 HTTP handler
func NewHandler(registerHandler *command.RegisterUserHandler) *Handler {
	return &Handler{
		registerHandler: registerHandler,
		validate:        validator.New(),
	}
}

// Register 用户注册
//
// 流程：
// 1. 解析 + 校验请求 DTO
// 2. 调用 application 层用例（domain 校验、持久化、事件发布）
// 3. 返回响应（错误统一由 RespondError 翻译）
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	// 1. 解析请求
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}

	// 2. 字段级校验（validator tag）
	if err := h.validate.Struct(req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}

	// 3. 调用用例
	out, err := h.registerHandler.Handle(r.Context(), command.RegisterUserInput{
		Email:    req.Email,
		Username: req.Username,
		Password: req.Password,
	})
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}

	// 4. 返回 201 Created
	resp := RegisterResponse{UserID: out.UserID.String()}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}
