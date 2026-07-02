// Package auth 提供 auth 模块的 HTTP handler。
package auth

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"

	"github.com/go-playground/validator/v10"

	"blog-api/config"
	authcmd "blog-api/internal/application/auth/command"
	authquery "blog-api/internal/application/auth/query"
	"blog-api/internal/domain/user"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
	"blog-api/internal/interfaces/http/response"
)

// Handler auth HTTP 处理器（DDD 版）
type Handler struct {
	register  *authcmd.RegisterUserHandler
	login     *authcmd.LoginHandler
	google    *authcmd.GoogleLoginHandler
	github    *authcmd.GithubLoginHandler
	logout    *authcmd.LogoutHandler
	refresh   *authcmd.RefreshTokenHandler
	verify    *authcmd.VerifyEmailHandler
	forgot    *authcmd.ForgotPasswordHandler
	reset     *authcmd.ResetPasswordHandler
	updatePf  *authcmd.UpdateProfileHandler
	changePwd *authcmd.ChangePasswordHandler
	getMe     *authquery.GetMeHandler

	validate  *validator.Validate
	cookieCfg config.CookieConfig
	ttls      config.TokenTTLs
}

// NewHandler 创建 auth HTTP handler
//
// cookieCfg 用于 login/refresh/logout 时下发/清除 HttpOnly Cookie；
// ttls 提供 access/refresh JWT 过期时长，用于设置承载 refresh token 的 Cookie 的 MaxAge；
// 详见 response.SetAuthTokenCookies / ClearAuthCookies。
func NewHandler(
	register *authcmd.RegisterUserHandler,
	login *authcmd.LoginHandler,
	google *authcmd.GoogleLoginHandler,
	github *authcmd.GithubLoginHandler,
	logout *authcmd.LogoutHandler,
	refresh *authcmd.RefreshTokenHandler,
	verify *authcmd.VerifyEmailHandler,
	forgot *authcmd.ForgotPasswordHandler,
	reset *authcmd.ResetPasswordHandler,
	updatePf *authcmd.UpdateProfileHandler,
	changePwd *authcmd.ChangePasswordHandler,
	getMe *authquery.GetMeHandler,
	cookieCfg config.CookieConfig,
	ttls config.TokenTTLs,
) *Handler {
	return &Handler{
		register: register, login: login, google: google, github: github, logout: logout, refresh: refresh,
		verify: verify, forgot: forgot, reset: reset,
		updatePf: updatePf, changePwd: changePwd, getMe: getMe,
		validate:  validator.New(),
		cookieCfg: cookieCfg,
		ttls:      ttls,
	}
}

// generateCSRFToken 生成 32 字节随机 CSRF token（hex 编码成 64 字符串）
//
// 用于 double-submit cookie 模式：值不依赖任何状态，仅要求不可预测。
// 返回错误时降级为空串（CSRF 中间件会拒绝空 token 的写操作，安全可控）。
func generateCSRFToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	return hex.EncodeToString(b)
}

// Register POST /auth/register
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email" validate:"required,email"`
		Username string `json:"username" validate:"required,min=3,max=32"`
		Password string `json:"password" validate:"required,min=8"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}

	if err := h.register.Handle(r.Context(), authcmd.RegisterUserInput{
		Email: req.Email, Username: req.Username, Password: req.Password,
	}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusCreated, "注册成功，请查收验证邮件")
}

// VerifyEmail POST /auth/verify-email
func (h *Handler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email" validate:"required,email"`
		Code  string `json:"code" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.verify.Handle(r.Context(), authcmd.VerifyEmailInput{Email: req.Email, Code: req.Code}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "邮箱验证成功")
}

// Login POST /auth/login
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email" validate:"required,email"`
		Password string `json:"password" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}

	out, err := h.login.Handle(r.Context(), authcmd.LoginInput{Email: req.Email, Password: req.Password})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	// 下发 HttpOnly Cookie（access + refresh + CSRF double-submit）
	// refresh_token 不再返回到响应体，仅通过 HttpOnly Cookie 传递（防 XSS 偷取）
	csrf := generateCSRFToken()
	response.SetAuthTokenCookies(w, out.TokenPair.AccessToken, out.TokenPair.RefreshToken, csrf, h.cookieCfg, h.ttls)
	response.RespondOK(w, map[string]any{
		"access_token":       out.TokenPair.AccessToken,
		"expires_in":         out.TokenPair.ExpiresIn,
		"refresh_expires_in": out.TokenPair.RefreshExpiresIn,
		"token_type":         "Bearer",
	})
}

// GoogleLogin POST /auth/google
func (h *Handler) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Credential string `json:"credential" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}

	out, err := h.google.Handle(r.Context(), authcmd.GoogleLoginInput{Credential: req.Credential})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}

	csrf := generateCSRFToken()
	response.SetAuthTokenCookies(w, out.TokenPair.AccessToken, out.TokenPair.RefreshToken, csrf, h.cookieCfg, h.ttls)
	response.RespondOK(w, map[string]any{
		"access_token":       out.TokenPair.AccessToken,
		"expires_in":         out.TokenPair.ExpiresIn,
		"refresh_expires_in": out.TokenPair.RefreshExpiresIn,
		"token_type":         "Bearer",
	})
}

// GithubLogin POST /auth/github
func (h *Handler) GithubLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Credential string `json:"credential" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}

	out, err := h.github.Handle(r.Context(), authcmd.GithubLoginInput{Credential: req.Credential})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}

	csrf := generateCSRFToken()
	response.SetAuthTokenCookies(w, out.TokenPair.AccessToken, out.TokenPair.RefreshToken, csrf, h.cookieCfg, h.ttls)
	response.RespondOK(w, map[string]any{
		"access_token":       out.TokenPair.AccessToken,
		"expires_in":         out.TokenPair.ExpiresIn,
		"refresh_expires_in": out.TokenPair.RefreshExpiresIn,
		"token_type":         "Bearer",
	})
}

// Refresh POST /auth/refresh
//
// refresh_token 优先从 HttpOnly Cookie 读取；Cookie 缺失时回退到请求体（向后兼容旧客户端）。
// 成功后下发新的 access + refresh + CSRF Cookie（token 轮转）。
func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	refreshToken := ""

	// 优先从 Cookie 读取（推荐路径）
	if c, err := r.Cookie(h.cookieCfg.RefreshName); err == nil && c.Value != "" {
		refreshToken = c.Value
	}

	// 回退：从请求体读取（兼容旧客户端 / 显式调用场景）
	if refreshToken == "" {
		var req struct {
			RefreshToken string `json:"refresh_token"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil && refreshToken == "" {
			response.RespondError(w, r, err)
			return
		}
		refreshToken = req.RefreshToken
	}

	if refreshToken == "" {
		// 没带 refresh token = 会话不存在/已过期，属鉴权失败而非服务端错误。
		// 必须返回 401（ErrInvalidCredentials）以触发前端的降级链路（弹窗重登），
		// 而非 500——裸 error 会被 RespondError 兜底成 INTERNAL_ERROR。
		response.RespondError(w, r, user.ErrInvalidCredentials)
		return
	}

	pair, err := h.refresh.Handle(r.Context(), authcmd.RefreshTokenInput{RefreshToken: refreshToken})
	if err != nil {
		// refresh 失败通常意味着 refresh token 已失效，清除 Cookie 让客户端回到登录态
		response.ClearAuthCookies(w, h.cookieCfg)
		response.RespondError(w, r, err)
		return
	}
	csrf := generateCSRFToken()
	response.SetAuthTokenCookies(w, pair.AccessToken, pair.RefreshToken, csrf, h.cookieCfg, h.ttls)
	response.RespondOK(w, map[string]any{
		"access_token":       pair.AccessToken,
		"expires_in":         pair.ExpiresIn,
		"refresh_expires_in": pair.RefreshExpiresIn,
		"token_type":         "Bearer",
	})
}

// Logout POST /auth/logout（需认证）
//
// 服务端：blacklist refresh token（Redis）。
// 客户端：清除 access + refresh + CSRF Cookie，使浏览器丢弃 token。
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	if err := h.logout.Handle(r.Context(), authcmd.LogoutInput{UserID: userID}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.ClearAuthCookies(w, h.cookieCfg)
	response.RespondMessage(w, http.StatusOK, "已登出")
}

// GetCSRFToken GET /auth/csrf-token（公开）
//
// 为 double-submit CSRF 防护提供初始 token：
//   - 已登录用户：登录时已下发 mimo_csrf cookie，本端点刷新 token（防止长期不变）
//   - 未登录用户：首次访问时取一个 CSRF cookie 才能发起 login/register（防 login CSRF）
//
// 响应体同时返回 token 字符串（非敏感，攻击者拿不到 cookie 也无法伪造 header）。
func (h *Handler) GetCSRFToken(w http.ResponseWriter, r *http.Request) {
	token := generateCSRFToken()
	// 仅刷新 CSRF cookie，不动 access/refresh token cookie
	http.SetCookie(w, &http.Cookie{
		Name:     h.cookieCfg.CSRFName,
		Value:    token,
		Path:     "/",
		Domain:   h.cookieCfg.Domain,
		MaxAge:   response.CSRFCookieMaxAge,
		Secure:   h.cookieCfg.Secure,
		HttpOnly: false, // 必须 JS 可读
		SameSite: h.cookieCfg.SameSiteMode(),
	})
	response.RespondOK(w, map[string]any{
		"csrf_token": token,
	})
}

// ForgotPassword POST /auth/forgot-password
func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email" validate:"required,email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.forgot.Handle(r.Context(), authcmd.ForgotPasswordInput{Email: req.Email}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	// 始终返回成功（不暴露邮箱是否存在）
	response.RespondMessage(w, http.StatusOK, "如果该邮箱已注册，重置码已发送")
}

// ResetPassword POST /auth/reset-password
func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email       string `json:"email" validate:"required,email"`
		Code        string `json:"code" validate:"required"`
		NewPassword string `json:"new_password" validate:"required,min=8"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.reset.Handle(r.Context(), authcmd.ResetPasswordInput{
		Email: req.Email, Code: req.Code, NewPassword: req.NewPassword,
	}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "密码已重置")
}

// GetMe GET /auth/me（需认证）
func (h *Handler) GetMe(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	dto, err := h.getMe.Handle(r.Context(), userID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// UpdateProfile PATCH /auth/profile（需认证）
func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	var req struct {
		Username  string `json:"username" validate:"omitempty,min=3,max=32"`
		Bio       string `json:"bio" validate:"omitempty,max=500"`
		AvatarURL string `json:"avatar_url" validate:"omitempty,max=2048"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}

	u, err := h.updatePf.Handle(r.Context(), authcmd.UpdateProfileInput{
		UserID: userID, Username: req.Username, Bio: req.Bio, AvatarURL: req.AvatarURL,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]any{
		"id":         u.GetID().String(),
		"username":   u.Username().String(),
		"email":      u.Email().String(),
		"avatar_url": u.AvatarURL(),
		"bio":        u.Bio(),
		"role":       string(u.Role()),
	})
}

// ChangePassword PATCH /auth/password（需认证）
func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	var req struct {
		OldPassword string `json:"old_password" validate:"required"`
		NewPassword string `json:"new_password" validate:"required,min=8"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}

	if err := h.changePwd.Handle(r.Context(), authcmd.ChangePasswordInput{
		UserID: userID, OldPassword: req.OldPassword, NewPassword: req.NewPassword,
	}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "密码已修改，请重新登录")
}
