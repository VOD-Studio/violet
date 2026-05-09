// Package handler 提供 HTTP 请求处理器，负责接收请求、验证参数、调用服务层并返回响应
package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"blog-api/internal/pkg/response"
	"blog-api/internal/service"
)

// 辅助函数：获取客户端 IP
func getClientIPFromRequest(r *http.Request) string {
	ip := r.Header.Get("X-Forwarded-For")
	if ip != "" {
		return ip
	}
	return r.RemoteAddr
}

// UserManagementHandler 用户管理接口处理器
type UserManagementHandler struct {
	userService  *service.UserService
	auditService *service.AuditService
}

// NewUserManagementHandler 创建用户管理处理器实例
func NewUserManagementHandler(userService *service.UserService, auditService *service.AuditService) *UserManagementHandler {
	return &UserManagementHandler{
		userService:  userService,
		auditService: auditService,
	}
}

// userResponse 用户信息响应（不包含密码等敏感信息）
type userResponse struct {
	ID            string `json:"id"`
	Username      string `json:"username"`
	Email         string `json:"email"`
	Role          string `json:"role"`
	IsActive      bool   `json:"is_active"`
	EmailVerified bool   `json:"email_verified"`
	CreatedAt     string `json:"created_at"`
}

// ListUsers 获取用户列表
// GET /api/v1/admin/users
// 需要管理员认证，支持分页查询和筛选
func (h *UserManagementHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "ListUsers").Msg("处理请求")

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	search := r.URL.Query().Get("search")
	role := r.URL.Query().Get("role")
	statusStr := r.URL.Query().Get("status")

	// 解析状态筛选
	var isActive *bool
	if statusStr != "" {
		switch statusStr {
		case "active":
			isActive = &[]bool{true}[0]
		case "inactive":
			isActive = &[]bool{false}[0]
		}
	}

	filters := service.UserFilterParams{
		Search:   search,
		Role:     role,
		IsActive: isActive,
	}

	result, err := h.userService.ListUsers(r.Context(), page, limit, filters)
	if err != nil {
		log.Error().Err(err).Str("operation", "ListUsers").Msg("服务调用失败")
		response.InternalServerError(w, "查询用户列表失败")
		return
	}

	items := make([]userResponse, 0, len(result.Users))
	for _, u := range result.Users {
		items = append(items, userResponse{
			ID:            u.ID.String(),
			Username:      u.Username,
			Email:         u.Email,
			Role:          u.Role,
			IsActive:      u.IsActive,
			EmailVerified: u.EmailVerified,
			CreatedAt:     u.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	response.Success(w, map[string]interface{}{
		"users": items,
		"total": result.Total,
		"page":  result.Page,
		"limit": result.Limit,
	})
	log.Info().Int("status", http.StatusOK).Int64("total", result.Total).Msg("请求处理成功")
}

// GetUserDetail 获取用户详情
// GET /api/v1/admin/users/:id
// 需要管理员认证
func (h *UserManagementHandler) GetUserDetail(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	log.Info().Str("handler", "GetUserDetail").Str("id", idStr).Msg("处理请求")

	targetID, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn().Err(err).Str("id", idStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_param", "无效的用户 ID")
		return
	}

	user, err := h.userService.GetUserByID(r.Context(), targetID)
	if err != nil {
		log.Error().Err(err).Str("operation", "GetUserDetail").Str("user_id", idStr).Msg("服务调用失败")
		handleUserServiceError(w, err)
		return
	}

	response.Success(w, userResponse{
		ID:            user.ID.String(),
		Username:      user.Username,
		Email:         user.Email,
		Role:          user.Role,
		IsActive:      user.IsActive,
		EmailVerified: user.EmailVerified,
		CreatedAt:     user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	})
	log.Info().Int("status", http.StatusOK).Str("user_id", idStr).Msg("请求处理成功")
}

// handleUserServiceError 处理用户服务错误
func handleUserServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, service.ErrUserNotFound):
		response.Error(w, http.StatusNotFound, "user_not_found", "用户不存在")
	case errors.Is(err, service.ErrInvalidRole):
		response.Error(w, http.StatusBadRequest, "invalid_role", err.Error())
	case errors.Is(err, service.ErrEmptyUserIDs):
		response.Error(w, http.StatusBadRequest, "invalid_param", err.Error())
	case errors.Is(err, service.ErrCannotModifySelf):
		response.Error(w, http.StatusBadRequest, "cannot_modify_self", err.Error())
	case errors.Is(err, service.ErrCannotModifySuperAdmin):
		response.Error(w, http.StatusForbidden, "cannot_modify_superadmin", err.Error())
	case errors.Is(err, service.ErrUsernameExists):
		response.Error(w, http.StatusConflict, "username_exists", err.Error())
	case errors.Is(err, service.ErrEmailExists):
		response.Error(w, http.StatusConflict, "email_exists", err.Error())
	default:
		response.InternalServerError(w, "服务器内部错误")
	}
}

// isValidRole 检查角色值是否合法
func isValidRole(role string) bool {
	return role == "user" || role == "admin" || role == "superadmin"
}
