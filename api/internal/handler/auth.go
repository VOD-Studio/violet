// Package handler 提供 HTTP 请求处理器，负责接收请求、验证参数、调用服务层并返回响应
package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/rs/zerolog/log"

	"blog-api/internal/middleware"
	"blog-api/internal/service"
)

// AuthHandler 认证相关接口处理器
type AuthHandler struct {
	authService *service.AuthService
	permService *service.PermissionService
	validate *validator.Validate
	uploadPathPrefix string
}

// NewAuthHandler 创建认证处理器实例
func NewAuthHandler(authService *service.AuthService, permService *service.PermissionService, uploadPathPrefix string) *AuthHandler {
	return &AuthHandler{
		authService:      authService,
		permService:      permService,
		validate:         validator.New(),
		uploadPathPrefix: uploadPathPrefix,
	}
}

// --- 请求结构体 ---

// RegisterRequest 用户注册请求
type RegisterRequest struct {
	// Email 邮箱地址
	Email string `json:"email" validate:"required,email"`
	// Username 用户名，3-32 个字符
	Username string `json:"username" validate:"required,min=3,max=32"`
	// Password 密码，至少 8 个字符
	Password string `json:"password" validate:"required,min=8,max=72"`
}

// VerifyEmailRequest 邮箱验证请求
type VerifyEmailRequest struct {
	// Email 邮箱地址
	Email string `json:"email" validate:"required,email"`
	// Code 6 位验证码
	Code string `json:"code" validate:"required,len=6"`
}

// LoginRequest 用户登录请求
type LoginRequest struct {
	// Email 邮箱地址
	Email string `json:"email" validate:"required,email"`
	// Password 密码
	Password string `json:"password" validate:"required"`
}

// RefreshTokenRequest 刷新令牌请求
type RefreshTokenRequest struct {
	// RefreshToken 刷新令牌
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// ForgotPasswordRequest 忘记密码请求
type ForgotPasswordRequest struct {
	// Email 邮箱地址
	Email string `json:"email" validate:"required,email"`
}

// ResetPasswordRequest 重置密码请求
type ResetPasswordRequest struct {
	// Email 邮箱地址
	Email string `json:"email" validate:"required,email"`
	// Code 6 位重置码
	Code string `json:"code" validate:"required,len=6"`
	// NewPassword 新密码，至少 8 个字符
	NewPassword string `json:"new_password" validate:"required,min=8,max=72"`
}

// --- 响应结构体 ---

// ErrorResponse 统一错误响应
type ErrorResponse struct {
	// Error 错误类型标识
	Error string `json:"error"`
	// Message 错误描述信息
	Message string `json:"message"`
}

// MessageResponse 统一消息响应
type MessageResponse struct {
	// Message 消息内容
	Message string `json:"message"`
}

// TokenResponse 令牌响应，包含访问令牌和刷新令牌
type TokenResponse struct {
	// AccessToken 访问令牌
	AccessToken string `json:"access_token"`
	// RefreshToken 刷新令牌
	RefreshToken string `json:"refresh_token"`
	// ExpiresIn 访问令牌过期时间（秒）
	ExpiresIn int64 `json:"expires_in"`
	// RefreshExpiresIn 刷新令牌过期时间（秒）
	RefreshExpiresIn int64 `json:"refresh_expires_in"`
	// TokenType 令牌类型
	TokenType string `json:"token_type"`
}

// UserResponse 用户信息响应（不包含敏感信息）
// UserResponse 用户信息响应
type UserResponse struct {
	// ID 用户唯一标识
	ID string `json:"id"`
	// Username 用户名
	Username string `json:"username"`
	// Email 邮箱地址
	Email string `json:"email"`
	// AvatarURL 头像链接
	AvatarURL string `json:"avatar_url"`
	// Bio 个人简介
	Bio string `json:"bio"`
	// Role 用户角色
	Role string `json:"role"`
	// EmailVerified 邮箱是否已验证
	EmailVerified bool `json:"email_verified"`
	// IsActive 账户是否已激活
	IsActive bool `json:"is_active"`
	// Permissions 权限列表
	Permissions []string `json:"permissions,omitempty"`
}

// Register 用户注册接口
// POST /api/v1/auth/register
// 创建新用户并发送邮箱验证码
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "Register").Msg("处理请求")

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	// 验证请求参数
	if err := h.validate.Struct(req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "validation_error", formatValidationErrors(err))
		return
	}

	// 调用认证服务注册用户
	if err := h.authService.Register(r.Context(), req.Email, req.Username, req.Password); err != nil {
		log.Error().Err(err).Str("operation", "Register").Str("email", req.Email).Msg("服务调用失败")
		handleServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, MessageResponse{
		Message: "注册成功，请检查邮箱获取验证码",
	})
	log.Info().Int("status", http.StatusCreated).Str("email", req.Email).Msg("请求处理成功")
}

// VerifyEmail 邮箱验证接口
// POST /api/v1/auth/verify-email
// 使用验证码验证用户邮箱
func (h *AuthHandler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "VerifyEmail").Msg("处理请求")

	var req VerifyEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	// 验证请求参数
	if err := h.validate.Struct(req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "validation_error", formatValidationErrors(err))
		return
	}

	// 调用认证服务验证邮箱
	if err := h.authService.VerifyEmail(r.Context(), req.Email, req.Code); err != nil {
		log.Error().Err(err).Str("operation", "VerifyEmail").Str("email", req.Email).Msg("服务调用失败")
		handleServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, MessageResponse{
		Message: "邮箱验证成功",
	})
	log.Info().Int("status", http.StatusOK).Str("email", req.Email).Msg("请求处理成功")
}

// Login 用户登录接口
// POST /api/v1/auth/login
// 验证邮箱密码并返回 JWT 令牌
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "Login").Msg("处理请求")

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	// 验证请求参数
	if err := h.validate.Struct(req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "validation_error", formatValidationErrors(err))
		return
	}

	// 调用认证服务登录
	tokenPair, err := h.authService.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		log.Error().Err(err).Str("operation", "Login").Str("email", req.Email).Msg("服务调用失败")
		handleServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, TokenResponse{
		AccessToken:       tokenPair.AccessToken,
		RefreshToken:      tokenPair.RefreshToken,
		ExpiresIn:         tokenPair.ExpiresIn,
		RefreshExpiresIn:  tokenPair.RefreshExpiresIn,
		TokenType:         "Bearer",
	})
	log.Info().Int("status", http.StatusOK).Str("email", req.Email).Msg("请求处理成功")
}

// RefreshToken 刷新令牌接口
// POST /api/v1/auth/refresh
// 使用刷新令牌获取新的访问令牌
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "RefreshToken").Msg("处理请求")

	var req RefreshTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	// 验证请求参数
	if err := h.validate.Struct(req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "validation_error", formatValidationErrors(err))
		return
	}

	// 调用认证服务刷新令牌
	tokenPair, err := h.authService.RefreshToken(r.Context(), req.RefreshToken)
	if err != nil {
		log.Error().Err(err).Str("operation", "RefreshToken").Msg("服务调用失败")
		handleServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, TokenResponse{
		AccessToken:       tokenPair.AccessToken,
		RefreshToken:      tokenPair.RefreshToken,
		ExpiresIn:         tokenPair.ExpiresIn,
		RefreshExpiresIn:  tokenPair.RefreshExpiresIn,
		TokenType:         "Bearer",
	})
	log.Info().Int("status", http.StatusOK).Msg("请求处理成功")
}

// Logout 用户登出接口
// POST /api/v1/auth/logout
// 需要认证，删除 Redis 中的刷新令牌
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "Logout").Msg("处理请求")

	// 从上下文获取用户 ID
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		log.Warn().Msg("参数验证失败：未认证")
		writeError(w, http.StatusUnauthorized, "unauthorized", "未认证")
		return
	}

	// 调用认证服务登出
	if err := h.authService.Logout(r.Context(), userID); err != nil {
		log.Error().Err(err).Str("operation", "Logout").Str("user_id", userID).Msg("服务调用失败")
		handleServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, MessageResponse{
		Message: "已成功登出",
	})
	log.Info().Int("status", http.StatusOK).Str("user_id", userID).Msg("请求处理成功")
}

// ForgotPassword 忘记密码接口
// POST /api/v1/auth/forgot-password
// 发送密码重置验证码到用户邮箱
func (h *AuthHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "ForgotPassword").Msg("处理请求")

	var req ForgotPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	// 验证请求参数
	if err := h.validate.Struct(req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "validation_error", formatValidationErrors(err))
		return
	}

	// 调用认证服务发送重置码
	if err := h.authService.ForgotPassword(r.Context(), req.Email); err != nil {
		log.Error().Err(err).Str("operation", "ForgotPassword").Str("email", req.Email).Msg("服务调用失败")
		handleServiceError(w, err)
		return
	}

	// 始终返回成功，不暴露邮箱是否存在
	writeJSON(w, http.StatusOK, MessageResponse{
		Message: "如果该邮箱已注册，您将收到密码重置邮件",
	})
	log.Info().Int("status", http.StatusOK).Msg("请求处理成功")
}

// ResetPassword 重置密码接口
// POST /api/v1/auth/reset-password
// 使用重置码设置新密码
func (h *AuthHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "ResetPassword").Msg("处理请求")

	var req ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	// 验证请求参数
	if err := h.validate.Struct(req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "validation_error", formatValidationErrors(err))
		return
	}

	// 调用认证服务重置密码
	if err := h.authService.ResetPassword(r.Context(), req.Email, req.Code, req.NewPassword); err != nil {
		log.Error().Err(err).Str("operation", "ResetPassword").Str("email", req.Email).Msg("服务调用失败")
		handleServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, MessageResponse{
		Message: "密码重置成功",
	})
	log.Info().Int("status", http.StatusOK).Str("email", req.Email).Msg("请求处理成功")
}

// Me 获取当前用户信息接口
// GET /api/v1/auth/me
// 需要认证，返回当前登录用户的信息
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "Me").Msg("处理请求")

	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		log.Warn().Msg("参数验证失败：未认证")
		writeError(w, http.StatusUnauthorized, "unauthorized", "未认证")
		return
	}

	user, err := h.authService.GetUserByID(r.Context(), userID)
	if err != nil {
		log.Error().Err(err).Str("operation", "GetUserByID").Str("user_id", userID).Msg("服务调用失败")
		handleServiceError(w, err)
		return
	}

	avatarURL := ""
	if user.AvatarUrl.Valid && user.AvatarUrl.String != "" {
		avatarURL = user.AvatarUrl.String
	}
	bio := ""
	if user.Bio.Valid {
		bio = user.Bio.String
	}

	var permissions []string
	if h.permService != nil {
		roleID := middleware.GetUserRoleID(r.Context())
		if user.Role == "superadmin" {
			for code := range h.permService.GetAllPermissions() {
				permissions = append(permissions, code)
			}
		} else if roleID != nil {
			permissions = h.permService.GetPermissionsByRoleID(*roleID)
		}
	}

	writeJSON(w, http.StatusOK, UserResponse{
		ID:            user.ID.String(),
		Username:      user.Username,
		Email:         user.Email,
		AvatarURL:     avatarURL,
		Bio:           bio,
		Role:          user.Role,
		EmailVerified: user.EmailVerified,
		IsActive:      user.IsActive,
		Permissions:   permissions,
	})
	log.Info().Int("status", http.StatusOK).Str("user_id", userID).Msg("请求处理成功")
}

// --- 个人中心 ---

// UpdateProfileRequest 更新个人资料请求
// UpdateProfileRequest 更新个人资料请求
type UpdateProfileRequest struct {
	Username  string `json:"username" validate:"required,min=3,max=50"`
	Bio       string `json:"bio"`
	AvatarURL string `json:"avatar_url"`
}

// UpdatePasswordRequest 修改密码请求
// UpdatePasswordRequest 修改密码请求
type UpdatePasswordRequest struct {
	OldPassword string `json:"old_password" validate:"required"`
	NewPassword string `json:"new_password" validate:"required,min=8,max=72"`
}

// UpdateProfile 更新个人资料接口
// PATCH /api/v1/auth/profile
func (h *AuthHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "UpdateProfile").Msg("处理请求")

	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		log.Warn().Msg("参数验证失败：未认证")
		writeError(w, http.StatusUnauthorized, "unauthorized", "未认证")
		return
	}

	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	if err := h.validate.Struct(req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "validation_error", formatValidationErrors(err))
		return
	}

	user, err := h.authService.UpdateProfile(r.Context(), userID, req.Username, req.Bio, req.AvatarURL)
	if err != nil {
		log.Error().Err(err).Str("operation", "UpdateProfile").Str("user_id", userID).Msg("服务调用失败")
		handleServiceError(w, err)
		return
	}

	avatarURL := ""
	if user.AvatarUrl.Valid && user.AvatarUrl.String != "" {
		avatarURL = user.AvatarUrl.String
	}
	bio := ""
	if user.Bio.Valid {
		bio = user.Bio.String
	}

	writeJSON(w, http.StatusOK, UserResponse{
		ID:            user.ID.String(),
		Username:      user.Username,
		Email:         user.Email,
		AvatarURL:     avatarURL,
		Bio:           bio,
		Role:          user.Role,
		EmailVerified: user.EmailVerified,
		IsActive:      user.IsActive,
	})
	log.Info().Int("status", http.StatusOK).Str("user_id", userID).Msg("请求处理成功")
}

// UpdatePassword 修改密码接口
// PATCH /api/v1/auth/password
func (h *AuthHandler) UpdatePassword(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "UpdatePassword").Msg("处理请求")

	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		log.Warn().Msg("参数验证失败：未认证")
		writeError(w, http.StatusUnauthorized, "unauthorized", "未认证")
		return
	}

	var req UpdatePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	if err := h.validate.Struct(req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		writeError(w, http.StatusBadRequest, "validation_error", formatValidationErrors(err))
		return
	}

	if err := h.authService.UpdatePassword(r.Context(), userID, req.OldPassword, req.NewPassword); err != nil {
		log.Error().Err(err).Str("operation", "UpdatePassword").Str("user_id", userID).Msg("服务调用失败")
		handleServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, MessageResponse{
		Message: "密码修改成功",
	})
	log.Info().Int("status", http.StatusOK).Str("user_id", userID).Msg("请求处理成功")
}

// --- 辅助函数 ---

// writeJSON 写入 JSON 响应
func writeJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(data)
}

// writeError 写入统一格式的错误响应
func writeError(w http.ResponseWriter, statusCode int, errType, message string) {
	writeJSON(w, statusCode, ErrorResponse{
		Error:   errType,
		Message: message,
	})
}

// handleServiceError 根据服务层错误类型返回对应的 HTTP 响应
func handleServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, service.ErrEmailAlreadyExists):
		writeError(w, http.StatusConflict, "email_exists", err.Error())
	case errors.Is(err, service.ErrUsernameAlreadyExists):
		writeError(w, http.StatusConflict, "username_exists", err.Error())
	case errors.Is(err, service.ErrInvalidCredentials):
		writeError(w, http.StatusUnauthorized, "invalid_credentials", err.Error())
	case errors.Is(err, service.ErrAccountNotActivated):
		writeError(w, http.StatusForbidden, "account_not_activated", err.Error())
	case errors.Is(err, service.ErrInvalidVerificationCode):
		writeError(w, http.StatusBadRequest, "invalid_code", err.Error())
	case errors.Is(err, service.ErrTooManyAttempts):
		writeError(w, http.StatusTooManyRequests, "too_many_attempts", err.Error())
	case errors.Is(err, service.ErrInvalidRefreshToken):
		writeError(w, http.StatusUnauthorized, "invalid_refresh_token", err.Error())
	case errors.Is(err, service.ErrUserNotFound):
		writeError(w, http.StatusNotFound, "user_not_found", err.Error())
	default:
		writeError(w, http.StatusInternalServerError, "internal_error", "服务器内部错误")
	}
}

// formatValidationErrors 格式化验证错误为可读字符串
func formatValidationErrors(err error) string {
	if validationErrors, ok := err.(validator.ValidationErrors); ok {
		var messages []string
		for _, e := range validationErrors {
			switch e.Tag() {
			case "required":
				messages = append(messages, e.Field()+" 为必填项")
			case "email":
				messages = append(messages, e.Field()+" 必须是有效的邮箱地址")
			case "min":
				messages = append(messages, e.Field()+" 长度不能少于 "+e.Param()+" 个字符")
			case "max":
				messages = append(messages, e.Field()+" 长度不能超过 "+e.Param()+" 个字符")
			case "len":
				messages = append(messages, e.Field()+" 长度必须为 "+e.Param()+" 个字符")
			default:
				messages = append(messages, e.Field()+" 验证失败: "+e.Tag())
			}
		}
		return strings.Join(messages, "; ")
	}
	return "请求参数验证失败"
}
