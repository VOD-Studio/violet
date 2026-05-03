package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"blog-api/internal/service"
)

// UserManagementHandler 用户管理接口处理器
type UserManagementHandler struct {
	userService *service.UserService
}

// NewUserManagementHandler 创建用户管理处理器实例
func NewUserManagementHandler(userService *service.UserService) *UserManagementHandler {
	return &UserManagementHandler{
		userService: userService,
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
// 需要管理员认证，支持分页查询
func (h *UserManagementHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	result, err := h.userService.ListUsers(r.Context(), page, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "查询用户列表失败")
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

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"users": items,
		"total": result.Total,
		"page":  result.Page,
		"limit": result.Limit,
	})
}

// UpdateUserRole 修改用户角色
// PATCH /api/v1/admin/users/:id/role
// 需要管理员认证
func (h *UserManagementHandler) UpdateUserRole(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	targetID, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的用户 ID")
		return
	}

	var req struct {
		Role string `json:"role" validate:"required,oneof=user admin superadmin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	if req.Role != "user" && req.Role != "admin" && req.Role != "superadmin" {
		writeError(w, http.StatusBadRequest, "invalid_role", "角色值无效，只能为 user 或 admin")
		return
	}

	user, err := h.userService.UpdateUserRole(r.Context(), targetID, req.Role)
	if err != nil {
		handleUserServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, userResponse{
		ID:            user.ID.String(),
		Username:      user.Username,
		Email:         user.Email,
		Role:          user.Role,
		IsActive:      user.IsActive,
		EmailVerified: user.EmailVerified,
		CreatedAt:     user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	})
}

// UpdateUserStatus 启用/禁用用户
// PATCH /api/v1/admin/users/:id/status
// 需要管理员认证
func (h *UserManagementHandler) UpdateUserStatus(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	targetID, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_param", "无效的用户 ID")
		return
	}

	var req struct {
		IsActive bool `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body", "请求体格式无效")
		return
	}

	user, err := h.userService.UpdateUserStatus(r.Context(), targetID, req.IsActive)
	if err != nil {
		handleUserServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, userResponse{
		ID:            user.ID.String(),
		Username:      user.Username,
		Email:         user.Email,
		Role:          user.Role,
		IsActive:      user.IsActive,
		EmailVerified: user.EmailVerified,
		CreatedAt:     user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	})
}

// handleUserServiceError 处理用户服务错误
func handleUserServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, service.ErrUserNotFound):
		writeError(w, http.StatusNotFound, "user_not_found", "用户不存在")
	case errors.Is(err, service.ErrInvalidRole):
		writeError(w, http.StatusBadRequest, "invalid_role", err.Error())
	default:
		writeError(w, http.StatusInternalServerError, "internal_error", "服务器内部错误")
	}
}
