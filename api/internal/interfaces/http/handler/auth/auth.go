// Package auth 提供 auth 模块的 HTTP handler。
package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"

	"blog-api/config"
	authcmd "blog-api/internal/application/auth/command"
	authquery "blog-api/internal/application/auth/query"
	appsettings "blog-api/internal/application/settings"
	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/opsgrant"
	domainsettings "blog-api/internal/domain/settings"
	domainsession "blog-api/internal/domain/session"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
	"blog-api/internal/interfaces/http/response"
	"blog-api/internal/middleware"
)
// Handler auth HTTP 处理器（DDD 版）
type Handler struct {
	register      *authcmd.RegisterUserHandler
	login         *authcmd.LoginHandler
	google        *authcmd.GoogleLoginHandler
	github        *authcmd.GithubLoginHandler
	logout        *authcmd.LogoutHandler
	createSession *authcmd.CreateSessionHandler
	verify        *authcmd.VerifyEmailHandler
	forgot        *authcmd.ForgotPasswordHandler
	reset         *authcmd.ResetPasswordHandler
	updatePf      *authcmd.UpdateProfileHandler
	changePwd     *authcmd.ChangePasswordHandler
	getMe         *authquery.GetMeHandler
	settings          *appsettings.Service                // OAuth 开关与安全组运行时读取
	oauthCreds        *authcmd.OAuthCredentials           // OAuth 凭据运行时存储（后台可写）
	listSessions      *authcmd.ListUserSessionsHandler    // 设备/会话列表
	revokeSession     *authcmd.RevokeUserSessionHandler   // 会话吊销
	issueGrant        *authcmd.IssueOpsGrantHandler       // 短时运维授权签发
	revokeGrant       *authcmd.RevokeOpsGrantHandler      // 运维授权主动吊销
	requestGrantCode  *authcmd.RequestOpsGrantCodeHandler // 授权邮箱验证码

	validate  *validator.Validate  // 请求体校验器
	cookieCfg config.CookieConfig  // session cookie 配置（名/域/Secure/SameSite）
	session   config.SessionConfig // session 生命周期配置（IdleTTL/MaxTTL）
}

// NewHandler 创建 auth HTTP handler。
//
// cookieCfg 用于 login/logout 时下发/清除 session Cookie；
// session 提供 idleTTL/maxTTL，用于设置 Cookie MaxAge 与 CreateSession 的绝对寿命。
func NewHandler(
	register *authcmd.RegisterUserHandler,
	login *authcmd.LoginHandler,
	google *authcmd.GoogleLoginHandler,
	github *authcmd.GithubLoginHandler,
	logout *authcmd.LogoutHandler,
	createSession *authcmd.CreateSessionHandler,
	verify *authcmd.VerifyEmailHandler,
	forgot *authcmd.ForgotPasswordHandler,
	reset *authcmd.ResetPasswordHandler,
	updatePf *authcmd.UpdateProfileHandler,
	changePwd *authcmd.ChangePasswordHandler,
	getMe *authquery.GetMeHandler,
	settings *appsettings.Service,
	oauthCreds *authcmd.OAuthCredentials,
	cookieCfg config.CookieConfig,
	session config.SessionConfig,
	listSessions *authcmd.ListUserSessionsHandler,
	revokeSession *authcmd.RevokeUserSessionHandler,
	issueGrant *authcmd.IssueOpsGrantHandler,
	revokeGrant *authcmd.RevokeOpsGrantHandler,
	requestGrantCode *authcmd.RequestOpsGrantCodeHandler,
	opsGrants appshared.OpsGrantStore,
) *Handler {
	return &Handler{
		register: register, login: login, google: google, github: github, logout: logout,
		createSession: createSession,
		verify: verify, forgot: forgot, reset: reset,
		updatePf: updatePf, changePwd: changePwd, getMe: getMe, settings: settings,
		oauthCreds: oauthCreds,
		listSessions: listSessions, revokeSession: revokeSession,
		issueGrant: issueGrant, revokeGrant: revokeGrant, requestGrantCode: requestGrantCode,
		validate:  validator.New(),
		cookieCfg: cookieCfg,
		session:   session,
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

// ensureOAuthEnabled 校验 OAuth 登录方式可用：管理员开关开启 + 凭据已配置。
// 开关与凭据独立维护（开关在 site_settings，凭据在 env/后台写入），
// 开而未配时返回明确的「未配置」错误而非登录时才暴露。
func (h *Handler) ensureOAuthEnabled(ctx context.Context, provider string) error {
	settings, err := h.settings.GetAll(ctx)
	if err != nil {
		return err
	}
	switch provider {
	case "google":
		if !settings.GoogleLoginEnabled {
			return domainsettings.ErrOAuthProviderDisabled
		}
		if h.oauthCreds.GoogleClientID() == "" {
			return domainsettings.ErrOAuthNotConfigured
		}
	case "github":
		if !settings.GithubLoginEnabled {
			return domainsettings.ErrOAuthProviderDisabled
		}
		if h.oauthCreds.GithubClientID() == "" || h.oauthCreds.GithubClientSecret() == "" {
			return domainsettings.ErrOAuthNotConfigured
		}
	}
	return nil
}

// GetOAuthStatus GET /admin/oauth/status —— OAuth 凭据状态检测。
// 各 provider 返回 enabled（管理员开关）/凭据配置状态/脱敏预览，
// persisted=false 提示后台写入未落盘（重启后失效）。
func (h *Handler) GetOAuthStatus(w http.ResponseWriter, r *http.Request) {
	settings, err := h.settings.GetAll(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	st := h.oauthCreds.Status()
	response.RespondOK(w, map[string]any{
		"google_login_enabled": settings.GoogleLoginEnabled,
		"github_login_enabled": settings.GithubLoginEnabled,
		"google":               st.Google,
		"github":               st.Github,
		"persisted":            st.Persisted,
	})
}

// VerifyOAuthCredentials POST /admin/oauth/verify —— 探测凭据在 provider 侧的有效性。
// 用假 code 打 token 端点读错误码（OAuth 无公开 client 查询端点，防枚举）：
// GitHub 404=App 已删 / incorrect_client_credentials=secret 错 / bad_verification_code=有效；
// Google invalid_client=已删 / 其余=client 存在。手动触发，勿自动轮询。
func (h *Handler) VerifyOAuthCredentials(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Provider string `json:"provider" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	result, err := h.oauthCreds.VerifyProvider(r.Context(), req.Provider)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, result)
}

// UpdateOAuthCredentials PUT /admin/oauth/credentials —— 后台写入 OAuth 凭据。
// 内存立即生效；nil 字段不更新（前端留空=保持原值，secret 不回显）。
func (h *Handler) UpdateOAuthCredentials(w http.ResponseWriter, r *http.Request) {
	var req struct {
		GoogleClientID     *string `json:"google_client_id"`
		GithubClientID     *string `json:"github_client_id"`
		GithubClientSecret *string `json:"github_client_secret"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if req.GoogleClientID == nil && req.GithubClientID == nil && req.GithubClientSecret == nil {
		response.RespondError(w, r, domainsettings.ErrInvalidSetting)
		return
	}
	if err := h.oauthCreds.Update(authcmd.OAuthCredentialUpdate{
		GoogleClientID:     req.GoogleClientID,
		GithubClientID:     req.GithubClientID,
		GithubClientSecret: req.GithubClientSecret,
	}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	st := h.oauthCreds.Status()
	response.RespondOK(w, map[string]any{
		"google":    st.Google,
		"github":    st.Github,
		"persisted": st.Persisted,
	})
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

	if err := h.register.Handle(ctxWithAuditInfo(r), authcmd.RegisterUserInput{
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
	if err := h.verify.Handle(ctxWithAuditInfo(r), authcmd.VerifyEmailInput{Email: req.Email, Code: req.Code}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "邮箱验证成功")
}

// Login POST /auth/login
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Identifier string `json:"identifier" validate:"required"`
		Password   string `json:"password" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}

	out, err := h.login.Handle(ctxWithAuditInfo(r), authcmd.LoginInput{Identifier: req.Identifier, Password: req.Password})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	// 创建 opaque session 并下发 violet_session + violet_csrf + violet_uid Cookie。
	// csrf 由 session 自带（CreateSession 生成），不再单独 generateCSRFToken。
	if !h.establishSession(w, r, out.UserID) {
		return
	}
	response.RespondOK(w, map[string]any{
		"user_id": out.UserID,
	})
}

// establishSession 统一的登录会话落地：读取安全组并发上限、记录客户端
// IP/UserAgent、创建 session 并下发 Cookie。三种登录方式共用。
func (h *Handler) establishSession(w http.ResponseWriter, r *http.Request, userID string) bool {
	maxDevices := 0
	if h.settings != nil {
		if settings, err := h.settings.GetAll(r.Context()); err == nil {
			maxDevices = settings.SessionMaxDevices
		}
	}
	sess, err := h.createSession.Handle(ctxWithAuditInfo(r), authcmd.CreateSessionInput{
		UserID: userID, IdleTTL: h.session.IdleTTL, MaxTTL: h.session.MaxTTL,
		MaxDevices: maxDevices,
		Client: domainsession.ClientContext{
			IP: middleware.GetClientIP(r), UserAgent: r.UserAgent(),
		},
	})
	if err != nil {
		response.RespondError(w, r, err)
		return false
	}
	response.SetSessionCookie(w, sess.SessionID, sess.CSRFToken, userID, h.cookieCfg, h.session.IdleTTL)
	return true
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
	if err := h.ensureOAuthEnabled(r.Context(), "google"); err != nil {
		response.RespondError(w, r, err)
		return
	}

	out, err := h.google.Handle(ctxWithAuditInfo(r), authcmd.GoogleLoginInput{Credential: req.Credential})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if !h.establishSession(w, r, out.UserID) {
		return
	}
	response.RespondOK(w, map[string]any{
		"user_id": out.UserID,
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
	if err := h.ensureOAuthEnabled(r.Context(), "github"); err != nil {
		response.RespondError(w, r, err)
		return
	}

	out, err := h.github.Handle(ctxWithAuditInfo(r), authcmd.GithubLoginInput{Credential: req.Credential})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if !h.establishSession(w, r, out.UserID) {
		return
	}
	response.RespondOK(w, map[string]any{
		"user_id": out.UserID,
	})
}

// Session GET /auth/session（SSR 探活，只读）
//
// 命门不变量①：只返回 claims，绝不续期、绝不 Set-Cookie。续期由后续真实业务请求的
// SessionAuth 中间件做（挂在本端点的是 SessionAuthReadOnly，touch=false）。SSR 拿到
// claims 即可判断登录态与角色，完整 UserDTO 由客户端 useMe 按需拉。
func (h *Handler) Session(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	if userID == "" {
		response.RespondError(w, r, user.ErrInvalidCredentials)
		return
	}
	response.RespondOK(w, map[string]any{
		"user_id":                userID,
		"role":                   interfacesmw.GetUserRoleFromContext(r),
		"email":                  interfacesmw.GetUserEmailFromContext(r),
		"is_root": interfacesmw.GetUserIsRootFromContext(r),
	})
}

// Logout POST /auth/logout（需认证）
//
// 删除当前 session（登出当前设备，不影响该用户其他设备），清除 session 相关 Cookie。
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	sessionID := interfacesmw.GetSessionIDFromContext(r)
	if err := h.logout.Handle(ctxWithAuditInfo(r), authcmd.LogoutInput{UserID: userID, SessionID: sessionID}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.ClearSessionCookies(w, h.cookieCfg)
	response.RespondMessage(w, http.StatusOK, "已登出")
}

// GetCSRFToken GET /auth/csrf-token（公开）
//
// 为 double-submit CSRF 防护提供初始 token：
//   - 已登录用户：登录时已下发 violet_csrf cookie，本端点刷新 token（防止长期不变）
//   - 未登录用户：首次访问时取一个 CSRF cookie 才能发起 login/register（防 login CSRF）
//
// 响应体同时返回 token 字符串（非敏感，攻击者拿不到 cookie 也无法伪造 header）。
func (h *Handler) GetCSRFToken(w http.ResponseWriter, r *http.Request) {
	token := generateCSRFToken()
	cfg := response.EffectiveCookieConfig(h.cookieCfg)
	// 仅刷新 CSRF cookie，不动 access/refresh token cookie
	http.SetCookie(w, &http.Cookie{
		Name:     cfg.CSRFName,
		Value:    token,
		Path:     "/",
		Domain:   cfg.Domain,
		MaxAge:   response.CSRFCookieMaxAge,
		Secure:   cfg.Secure,
		HttpOnly: false, // 必须 JS 可读
		SameSite: cfg.SameSiteMode(),
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
		Username   *string `json:"username" validate:"omitempty,min=3,max=32"`
		DisplayName *string `json:"display_name" validate:"omitempty,max=32"`
		Bio        *string `json:"bio" validate:"omitempty,max=500"`
		AvatarURL  *string `json:"avatar_url" validate:"omitempty,max=2048"`
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
		UserID: userID, Username: req.Username, DisplayName: req.DisplayName, Bio: req.Bio, AvatarURL: req.AvatarURL,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]any{
		"id":         u.GetID().String(),
		"username":   u.Username().String(),
		"display_name": u.DisplayName().String(),
		"email":      u.Email().String(),
		"avatar_url": u.AvatarURL(),
		"bio":        u.Bio(),
		"role":       string(u.Role()),
	})
}

// ctxWithAuditInfo 把客户端 IP/UA 注入 ctx，供审计订阅者提取 Actor 网络信息。
//
// 登录/注册等匿名请求不走 session 中间件（无 cookie），
// 中间件注入的审计上下文在此补齐。
func ctxWithAuditInfo(r *http.Request) context.Context {
	ctx := r.Context()
	ctx = context.WithValue(ctx, middleware.ClientIPKey, middleware.GetClientIP(r))
	ctx = context.WithValue(ctx, middleware.UserAgentKey, r.UserAgent())
	return ctx
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

// ListSessions GET /auth/sessions（需认证）
//
// 返回当前用户全部有效登录会话（设备列表）。条目只含派生公开标识，
// 不下发 session id 等凭据。
func (h *Handler) ListSessions(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	sessionID := interfacesmw.GetSessionIDFromContext(r)
	sessions, err := h.listSessions.Handle(r.Context(), userID, sessionID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, sessions)
}

// RevokeSession DELETE /auth/sessions/{publicID}（需认证）
//
// 吊销当前用户的指定会话。publicID 是 SHA-256 派生标识，属主校验在用例内
// 完成（仅遍历本人会话做哈希匹配），不提供跨用户吊销。吊销当前会话等同
// 该设备登出（客户端应清理本地状态）。
func (h *Handler) RevokeSession(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	publicID := chi.URLParam(r, "publicID")
	if publicID == "" {
		response.RespondError(w, r, authcmd.ErrSessionNotOwned)
		return
	}
	if err := h.revokeSession.Handle(ctxWithAuditInfo(r), authcmd.RevokeUserSessionInput{
		OperatorID: userID, TargetUserID: userID, PublicID: publicID,
	}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "会话已吊销")
}

// RequestOpsGrantCode POST /auth/ops-grant/code（需认证）
//
// 向账号绑定邮箱发送短时运维授权验证码（OAuth 无密码用户的二次验证通道）。
func (h *Handler) RequestOpsGrantCode(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	if err := h.requestGrantCode.Handle(r.Context(), authcmd.RequestOpsGrantCodeInput{UserID: userID}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "验证码已发送到账号绑定邮箱")
}

// IssueOpsGrant POST /auth/ops-grant（需认证）
//
// 通过当前密码或邮箱验证码换取绑定当前会话的短时运维授权。
// 授权绑定用户+会话+类别+有效期，退出/改密/吊销/超时即失效。
func (h *Handler) IssueOpsGrant(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	sessionID := interfacesmw.GetSessionIDFromContext(r)
	var req struct {
		Category string `json:"category" validate:"required"`
		Method   string `json:"method" validate:"required,oneof=password email_code"`
		Password string `json:"password"`
		Code     string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, shared.BadRequest("无效的请求体"))
		return
	}
	if err := h.validate.Struct(req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	out, err := h.issueGrant.Handle(ctxWithAuditInfo(r), authcmd.IssueOpsGrantInput{
		UserID: userID, SessionID: sessionID,
		Category: opsgrant.Category(req.Category), Method: req.Method,
		Password: req.Password, Code: req.Code,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]any{
		"category":   req.Category,
		"expires_at": out.ExpiresAt.UTC().Format(time.RFC3339),
	})
}
// RevokeOpsGrant DELETE /auth/ops-grant（需认证）
//
// 主动放弃当前会话的全部短时运维授权（完成后主动收权），结果入审计。
func (h *Handler) RevokeOpsGrant(w http.ResponseWriter, r *http.Request) {
	userID := interfacesmw.GetUserIDFromContext(r)
	sessionID := interfacesmw.GetSessionIDFromContext(r)
	if err := h.revokeGrant.Handle(ctxWithAuditInfo(r), userID, sessionID); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "运维授权已吊销")
}
