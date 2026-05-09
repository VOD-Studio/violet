package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"blog-api/internal/middleware"
	"blog-api/internal/pkg/response"
	"blog-api/internal/service"
)

// CreateUser 管理员创建用户
// POST /api/v1/admin/users
// 需要管理员认证
func (h *UserManagementHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "CreateUser").Msg("处理请求")

	operatorID := middleware.GetUserID(r.Context())

	var req struct {
		Username string `json:"username" validate:"required"`
		Email    string `json:"email" validate:"required,email"`
		Password string `json:"password" validate:"required,min=6"`
		Role     string `json:"role" validate:"required"`
		IsActive bool   `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		response.BadRequest(w, err.Error())
		return
	}

	if req.Username == "" || req.Email == "" || req.Password == "" {
		response.Error(w, http.StatusBadRequest, "invalid_param", "用户名、邮箱和密码不能为空")
		return
	}
	if len(req.Password) < 6 {
		response.Error(w, http.StatusBadRequest, "invalid_param", "密码长度至少 6 个字符")
		return
	}
	if !isValidRole(req.Role) {
		response.Error(w, http.StatusBadRequest, "invalid_role", "角色值无效，只能为 user、admin 或 superadmin")
		return
	}

	user, err := h.userService.CreateUser(r.Context(), service.CreateUserParams{
		Username: req.Username,
		Email:    req.Email,
		Password: req.Password,
		Role:     req.Role,
		IsActive: req.IsActive,
	})
	if err != nil {
		log.Error().Err(err).Str("operation", "CreateUser").Msg("服务调用失败")
		handleUserServiceError(w, err)
		return
	}

	// 记录审计日志
	operatorUUID, _ := uuid.Parse(operatorID)
	_ = h.auditService.LogWithDetail(r.Context(), service.AuditLogEntry{
		UserID:       uuid.NullUUID{UUID: operatorUUID, Valid: true},
		UserName:     middleware.GetUserEmail(r.Context()),
		Action:       "create_user",
		ResourceType: "user",
		ResourceID:   user.ID.String(),
		ResourceName: user.Username,
		IPAddress:    getClientIPFromRequest(r),
	}, nil)

	response.Success(w, userResponse{
		ID:            user.ID.String(),
		Username:      user.Username,
		Email:         user.Email,
		Role:          user.Role,
		IsActive:      user.IsActive,
		EmailVerified: user.EmailVerified,
		CreatedAt:     user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	})
	log.Info().Int("status", http.StatusOK).Str("username", req.Username).Msg("请求处理成功")
}

// UpdateUser 管理员更新用户信息
// PUT /api/v1/admin/users/:id
// 需要管理员认证
func (h *UserManagementHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	log.Info().Str("handler", "UpdateUser").Str("id", idStr).Msg("处理请求")

	operatorID := middleware.GetUserID(r.Context())
	operatorRole := middleware.GetUserRole(r.Context())

	targetID, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn().Err(err).Str("id", idStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_param", "无效的用户 ID")
		return
	}

	// 不能修改自己
	if operatorID == idStr {
		log.Warn().Str("user_id", operatorID).Msg("不能修改自己的信息")
		response.Error(w, http.StatusBadRequest, "cannot_modify_self", "不能修改自己的信息")
		return
	}

	var req struct {
		Username      string `json:"username"`
		Email         string `json:"email"`
		Role          string `json:"role"`
		IsActive      bool   `json:"is_active"`
		EmailVerified bool   `json:"email_verified"`
		Bio           string `json:"bio"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		response.BadRequest(w, err.Error())
		return
	}

	if req.Username == "" || req.Email == "" {
		response.Error(w, http.StatusBadRequest, "invalid_param", "用户名和邮箱不能为空")
		return
	}
	if !isValidRole(req.Role) {
		response.Error(w, http.StatusBadRequest, "invalid_role", "角色值无效，只能为 user、admin 或 superadmin")
		return
	}

	// 检查目标用户是否为超级管理员（非超级管理员不能操作）
	if operatorRole != "superadmin" {
		users, err := h.userService.GetUsersByIDs(r.Context(), []uuid.UUID{targetID})
		if err != nil {
			log.Error().Err(err).Msg("查询用户信息失败")
			response.InternalServerError(w, "查询用户信息失败")
			return
		}
		if len(users) > 0 && users[0].Role == "superadmin" {
			log.Warn().Str("user_id", targetID.String()).Msg("普通管理员无法操作超级管理员")
			response.Error(w, http.StatusForbidden, "cannot_modify_superadmin", "普通管理员无法操作超级管理员账户")
			return
		}
	}

	user, err := h.userService.UpdateUserByAdmin(r.Context(), targetID, service.UpdateUserByAdminParams{
		Username:      req.Username,
		Email:         req.Email,
		Role:          req.Role,
		IsActive:      req.IsActive,
		EmailVerified: req.EmailVerified,
		Bio:           req.Bio,
	})
	if err != nil {
		log.Error().Err(err).Str("operation", "UpdateUser").Str("user_id", idStr).Msg("服务调用失败")
		handleUserServiceError(w, err)
		return
	}

	// 记录审计日志
	operatorUUID, _ := uuid.Parse(operatorID)
	_ = h.auditService.LogWithDetail(r.Context(), service.AuditLogEntry{
		UserID:       uuid.NullUUID{UUID: operatorUUID, Valid: true},
		UserName:     middleware.GetUserEmail(r.Context()),
		Action:       "update_user",
		ResourceType: "user",
		ResourceID:   targetID.String(),
		ResourceName: user.Username,
		IPAddress:    getClientIPFromRequest(r),
	}, map[string]interface{}{
		"username": req.Username,
		"email":    req.Email,
		"role":     req.Role,
	})

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

// DeleteUser 删除用户
// DELETE /api/v1/admin/users/:id
// 需要管理员认证
func (h *UserManagementHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	log.Info().Str("handler", "DeleteUser").Str("id", idStr).Msg("处理请求")

	operatorID := middleware.GetUserID(r.Context())
	operatorRole := middleware.GetUserRole(r.Context())

	targetID, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn().Err(err).Str("id", idStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_param", "无效的用户 ID")
		return
	}

	// 不能删除自己
	if operatorID == idStr {
		log.Warn().Str("user_id", operatorID).Msg("不能删除自己")
		response.Error(w, http.StatusBadRequest, "cannot_modify_self", "不能删除自己的账户")
		return
	}

	// 检查目标用户是否为超级管理员（非超级管理员不能操作）
	if operatorRole != "superadmin" {
		users, err := h.userService.GetUsersByIDs(r.Context(), []uuid.UUID{targetID})
		if err != nil {
			log.Error().Err(err).Msg("查询用户信息失败")
			response.InternalServerError(w, "查询用户信息失败")
			return
		}
		if len(users) > 0 && users[0].Role == "superadmin" {
			log.Warn().Str("user_id", targetID.String()).Msg("普通管理员无法操作超级管理员")
			response.Error(w, http.StatusForbidden, "cannot_modify_superadmin", "普通管理员无法操作超级管理员账户")
			return
		}
	}

	if err := h.userService.DeleteUser(r.Context(), targetID); err != nil {
		log.Error().Err(err).Str("operation", "DeleteUser").Str("user_id", idStr).Msg("服务调用失败")
		handleUserServiceError(w, err)
		return
	}

	// 记录审计日志
	operatorUUID, _ := uuid.Parse(operatorID)
	_ = h.auditService.LogWithDetail(r.Context(), service.AuditLogEntry{
		UserID:       uuid.NullUUID{UUID: operatorUUID, Valid: true},
		UserName:     middleware.GetUserEmail(r.Context()),
		Action:       "delete_user",
		ResourceType: "user",
		ResourceID:   targetID.String(),
		IPAddress:    getClientIPFromRequest(r),
	}, nil)

	response.Success(w, map[string]interface{}{
		"message": "用户已删除",
	})
	log.Info().Int("status", http.StatusOK).Str("user_id", idStr).Msg("请求处理成功")
}
