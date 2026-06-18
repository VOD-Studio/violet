// Package auth 提供 auth/user 聚合的 HTTP handler（DDD 版）。
//
package auth

import (
	"encoding/json"
	"net/http"

	"github.com/go-playground/validator/v10"

	authcmd "blog-api/internal/application/auth/command"
	authquery "blog-api/internal/application/auth/query"
	"blog-api/internal/infrastructure/auth"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
)

// Handler auth HTTP 处理器（DDD 版）
type Handler struct {
	register  *authcmd.RegisterUserHandler
	login     *authcmd.LoginHandler
	logout    *authcmd.LogoutHandler
	refresh   *authcmd.RefreshTokenHandler
	verify    *authcmd.VerifyEmailHandler
	forgot    *authcmd.ForgotPasswordHandler
	reset     *authcmd.ResetPasswordHandler
	updatePf  *authcmd.UpdateProfileHandler
	changePwd *authcmd.ChangePasswordHandler
	getMe     *authquery.GetMeHandler

	validate *validator.Validate
}

// NewHandler 创建 auth HTTP handler
func NewHandler(
	register *authcmd.RegisterUserHandler,
	login *authcmd.LoginHandler,
	logout *authcmd.LogoutHandler,
	refresh *authcmd.RefreshTokenHandler,
	verify *authcmd.VerifyEmailHandler,
	forgot *authcmd.ForgotPasswordHandler,
	reset *authcmd.ResetPasswordHandler,
	updatePf *authcmd.UpdateProfileHandler,
	changePwd *authcmd.ChangePasswordHandler,
	getMe *authquery.GetMeHandler,
) *Handler {
	return &Handler{
		register: register, login: login, logout: logout, refresh: refresh,
		verify: verify, forgot: forgot, reset: reset,
		updatePf: updatePf, changePwd: changePwd, getMe: getMe,
		validate: validator.New(),
	}
}

// Register POST /auth/ddd/register
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email" validate:"required,email"`
		Username string `json:"username" validate:"required,min=3,max=32"`
		Password string `json:"password" validate:"required,min=8"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}

	if err := h.register.Handle(r.Context(), authcmd.RegisterUserInput{
		Email: req.Email, Username: req.Username, Password: req.Password,
	}); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"message": "注册成功，请查收验证邮件"})
}

// VerifyEmail POST /auth/ddd/verify-email
func (h *Handler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email" validate:"required,email"`
		Code  string `json:"code" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.verify.Handle(r.Context(), authcmd.VerifyEmailInput{Email: req.Email, Code: req.Code}); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "邮箱验证成功"})
}

// Login POST /auth/ddd/login
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email" validate:"required,email"`
		Password string `json:"password" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}

	out, err := h.login.Handle(r.Context(), authcmd.LoginInput{Email: req.Email, Password: req.Password})
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"data": map[string]any{
			"access_token":       out.TokenPair.AccessToken,
			"refresh_token":      out.TokenPair.RefreshToken,
			"expires_in":         out.TokenPair.ExpiresIn,
			"refresh_expires_in": out.TokenPair.RefreshExpiresIn,
			"token_type":         "Bearer",
		},
	})
}

// Refresh POST /auth/ddd/refresh
func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}

	pair, err := h.refresh.Handle(r.Context(), authcmd.RefreshTokenInput{RefreshToken: req.RefreshToken})
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"data": map[string]any{
			"access_token":       pair.AccessToken,
			"refresh_token":      pair.RefreshToken,
			"expires_in":         pair.ExpiresIn,
			"refresh_expires_in": pair.RefreshExpiresIn,
			"token_type":         "Bearer",
		},
	})
}

// Logout POST /auth/ddd/logout（需认证）
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	if err := h.logout.Handle(r.Context(), authcmd.LogoutInput{UserID: userID}); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "已登出"})
}

// ForgotPassword POST /auth/ddd/forgot-password
func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email" validate:"required,email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.forgot.Handle(r.Context(), authcmd.ForgotPasswordInput{Email: req.Email}); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	// 始终返回成功（不暴露邮箱是否存在）
	writeJSON(w, http.StatusOK, map[string]any{"message": "如果该邮箱已注册，重置码已发送"})
}

// ResetPassword POST /auth/ddd/reset-password
func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email       string `json:"email" validate:"required,email"`
		Code        string `json:"code" validate:"required"`
		NewPassword string `json:"new_password" validate:"required,min=8"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.reset.Handle(r.Context(), authcmd.ResetPasswordInput{
		Email: req.Email, Code: req.Code, NewPassword: req.NewPassword,
	}); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "密码已重置"})
}

// GetMe GET /auth/ddd/me（需认证）
func (h *Handler) GetMe(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	dto, err := h.getMe.Handle(r.Context(), userID)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": dto})
}

// UpdateProfile PATCH /auth/ddd/profile（需认证）
func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	var req struct {
		Username  string `json:"username"`
		Bio       string `json:"bio"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}

	u, err := h.updatePf.Handle(r.Context(), authcmd.UpdateProfileInput{
		UserID: userID, Username: req.Username, Bio: req.Bio, AvatarURL: req.AvatarURL,
	})
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"data": map[string]any{
			"id":         u.GetID().String(),
			"username":   u.Username().String(),
			"email":      u.Email().String(),
			"avatar_url": u.AvatarURL(),
			"bio":        u.Bio(),
			"role":       string(u.Role()),
		},
	})
}

// ChangePassword PATCH /auth/ddd/password（需认证）
func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	var req struct {
		OldPassword string `json:"old_password" validate:"required"`
		NewPassword string `json:"new_password" validate:"required,min=8"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}

	if err := h.changePwd.Handle(r.Context(), authcmd.ChangePasswordInput{
		UserID: userID, OldPassword: req.OldPassword, NewPassword: req.NewPassword,
	}); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "密码已修改，请重新登录"})
}

// 编译期断言避免未使用 import
var _ = auth.TokenPair{}

// writeJSON 写 JSON 响应
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
