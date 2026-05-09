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

// BatchUpdateUserStatus 批量启用/禁用用户
// POST /api/v1/admin/users/batch-status
// 需要管理员认证
func (h *UserManagementHandler) BatchUpdateUserStatus(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "BatchUpdateUserStatus").Msg("处理请求")

	operatorID := middleware.GetUserID(r.Context())
	operatorRole := middleware.GetUserRole(r.Context())

	var req struct {
		UserIDs  []string `json:"user_ids" validate:"required,min=1"`
		IsActive bool     `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		response.BadRequest(w, err.Error())
		return
	}

	if len(req.UserIDs) == 0 {
		log.Warn().Msg("用户 ID 列表为空")
		response.Error(w, http.StatusBadRequest, "invalid_param", "用户 ID 列表不能为空")
		return
	}

	// 解析 UUID
	userIDs := make([]uuid.UUID, 0, len(req.UserIDs))
	for _, idStr := range req.UserIDs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			log.Warn().Err(err).Str("id", idStr).Msg("无效的用户 ID")
			response.Error(w, http.StatusBadRequest, "invalid_param", "无效的用户 ID: "+idStr)
			return
		}
		userIDs = append(userIDs, id)
	}

	// 检查是否有超级管理员被选中（非超级管理员不能操作超级管理员）
	if operatorRole != "superadmin" {
		users, err := h.userService.GetUsersByIDs(r.Context(), userIDs)
		if err != nil {
			log.Error().Err(err).Msg("查询用户信息失败")
			response.InternalServerError(w, "查询用户信息失败")
			return
		}
		for _, u := range users {
			if u.Role == "superadmin" {
				log.Warn().Str("user_id", u.ID.String()).Msg("普通管理员无法操作超级管理员")
				response.Error(w, http.StatusForbidden, "cannot_modify_superadmin", "普通管理员无法操作超级管理员账户")
				return
			}
		}
	}

	users, err := h.userService.BatchUpdateUserStatus(r.Context(), userIDs, req.IsActive)
	if err != nil {
		log.Error().Err(err).Str("operation", "BatchUpdateUserStatus").Msg("服务调用失败")
		handleUserServiceError(w, err)
		return
	}

	// 记录审计日志
	operatorUUID, _ := uuid.Parse(operatorID)
	batchAction := "batch_disable_users"
	if req.IsActive {
		batchAction = "batch_enable_users"
	}
	_ = h.auditService.LogWithDetail(r.Context(), service.AuditLogEntry{
		UserID:       uuid.NullUUID{UUID: operatorUUID, Valid: true},
		UserName:     middleware.GetUserEmail(r.Context()),
		Action:       batchAction,
		ResourceType: "user",
		ResourceID:   "",
		ResourceName: "",
		IPAddress:    getClientIPFromRequest(r),
	}, map[string]interface{}{
		"user_ids":  req.UserIDs,
		"count":     len(users),
		"is_active": req.IsActive,
	})

	items := make([]userResponse, 0, len(users))
	for _, u := range users {
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
		"users":     items,
		"count":     len(items),
		"is_active": req.IsActive,
	})
	log.Info().Int("status", http.StatusOK).Int("count", len(items)).Bool("is_active", req.IsActive).Msg("请求处理成功")
}

// BatchUpdateUserRole 批量修改用户角色
// POST /api/v1/admin/users/batch-role
// 需要管理员认证
func (h *UserManagementHandler) BatchUpdateUserRole(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "BatchUpdateUserRole").Msg("处理请求")

	operatorID := middleware.GetUserID(r.Context())
	operatorRole := middleware.GetUserRole(r.Context())

	var req struct {
		UserIDs []string `json:"user_ids" validate:"required,min=1"`
		Role    string   `json:"role" validate:"required,oneof=user admin superadmin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		response.BadRequest(w, err.Error())
		return
	}

	if len(req.UserIDs) == 0 {
		log.Warn().Msg("用户 ID 列表为空")
		response.Error(w, http.StatusBadRequest, "invalid_param", "用户 ID 列表不能为空")
		return
	}

	if req.Role != "user" && req.Role != "admin" && req.Role != "superadmin" {
		log.Warn().Str("role", req.Role).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_role", "角色值无效，只能为 user、admin 或 superadmin")
		return
	}

	// 解析 UUID
	userIDs := make([]uuid.UUID, 0, len(req.UserIDs))
	for _, idStr := range req.UserIDs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			log.Warn().Err(err).Str("id", idStr).Msg("无效的用户 ID")
			response.Error(w, http.StatusBadRequest, "invalid_param", "无效的用户 ID: "+idStr)
			return
		}
		// 不能修改自己的角色
		if idStr == operatorID {
			log.Warn().Str("user_id", operatorID).Msg("不能修改自己的角色")
			response.Error(w, http.StatusBadRequest, "cannot_modify_self", "不能修改自己的角色")
			return
		}
		userIDs = append(userIDs, id)
	}

	// 检查是否有超级管理员被选中（非超级管理员不能操作超级管理员）
	if operatorRole != "superadmin" {
		users, err := h.userService.GetUsersByIDs(r.Context(), userIDs)
		if err != nil {
			log.Error().Err(err).Msg("查询用户信息失败")
			response.InternalServerError(w, "查询用户信息失败")
			return
		}
		for _, u := range users {
			if u.Role == "superadmin" {
				log.Warn().Str("user_id", u.ID.String()).Msg("普通管理员无法操作超级管理员")
				response.Error(w, http.StatusForbidden, "cannot_modify_superadmin", "普通管理员无法操作超级管理员账户")
				return
			}
		}
	}

	users, err := h.userService.BatchUpdateUserRole(r.Context(), userIDs, req.Role)
	if err != nil {
		log.Error().Err(err).Str("operation", "BatchUpdateUserRole").Msg("服务调用失败")
		handleUserServiceError(w, err)
		return
	}

	// 记录审计日志
	operatorUUID, _ := uuid.Parse(operatorID)
	_ = h.auditService.LogWithDetail(r.Context(), service.AuditLogEntry{
		UserID:       uuid.NullUUID{UUID: operatorUUID, Valid: true},
		UserName:     middleware.GetUserEmail(r.Context()),
		Action:       "batch_update_role",
		ResourceType: "user",
		ResourceID:   "",
		ResourceName: "",
		IPAddress:    getClientIPFromRequest(r),
	}, map[string]interface{}{
		"user_ids": req.UserIDs,
		"count":    len(users),
		"new_role": req.Role,
	})

	items := make([]userResponse, 0, len(users))
	for _, u := range users {
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
		"users":    items,
		"count":    len(items),
		"new_role": req.Role,
	})
	log.Info().Int("status", http.StatusOK).Int("count", len(items)).Str("new_role", req.Role).Msg("请求处理成功")
}

// UpdateUserRole 修改用户角色
// PATCH /api/v1/admin/users/:id/role
// 需要管理员认证
func (h *UserManagementHandler) UpdateUserRole(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	log.Info().Str("handler", "UpdateUserRole").Str("id", idStr).Msg("处理请求")

	operatorID := middleware.GetUserID(r.Context())
	operatorRole := middleware.GetUserRole(r.Context())

	targetID, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn().Err(err).Str("id", idStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_param", "无效的用户 ID")
		return
	}

	// 检查是否在修改自己的角色
	if operatorID == idStr {
		log.Warn().Str("user_id", operatorID).Msg("不能修改自己的角色")
		response.Error(w, http.StatusBadRequest, "cannot_modify_self", "不能修改自己的角色")
		return
	}

	var req struct {
		Role string `json:"role" validate:"required,oneof=user admin superadmin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		response.BadRequest(w, err.Error())
		return
	}

	if req.Role != "user" && req.Role != "admin" && req.Role != "superadmin" {
		log.Warn().Str("role", req.Role).Msg("参数验证失败")
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

	user, err := h.userService.UpdateUserRole(r.Context(), targetID, req.Role)
	if err != nil {
		log.Error().Err(err).Str("operation", "UpdateUserRole").Str("user_id", idStr).Msg("服务调用失败")
		handleUserServiceError(w, err)
		return
	}

	// 记录审计日志
	operatorUUID, _ := uuid.Parse(operatorID)
	_ = h.auditService.LogWithDetail(r.Context(), service.AuditLogEntry{
		UserID:       uuid.NullUUID{UUID: operatorUUID, Valid: true},
		UserName:     middleware.GetUserEmail(r.Context()),
		Action:       "update_role",
		ResourceType: "user",
		ResourceID:   targetID.String(),
		ResourceName: user.Username,
		IPAddress:    getClientIPFromRequest(r),
	}, map[string]interface{}{
		"new_role": req.Role,
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
	log.Info().Int("status", http.StatusOK).Str("user_id", idStr).Str("new_role", req.Role).Msg("请求处理成功")
}

// UpdateUserStatus 启用/禁用用户
// PATCH /api/v1/admin/users/:id/status
// 需要管理员认证
func (h *UserManagementHandler) UpdateUserStatus(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	log.Info().Str("handler", "UpdateUserStatus").Str("id", idStr).Msg("处理请求")

	operatorID := middleware.GetUserID(r.Context())
	operatorRole := middleware.GetUserRole(r.Context())

	targetID, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn().Err(err).Str("id", idStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_param", "无效的用户 ID")
		return
	}

	// 检查是否在修改自己的状态
	if operatorID == idStr {
		log.Warn().Str("user_id", operatorID).Msg("不能修改自己的状态")
		response.Error(w, http.StatusBadRequest, "cannot_modify_self", "不能修改自己的状态")
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

	var req struct {
		IsActive bool `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数验证失败")
		response.BadRequest(w, err.Error())
		return
	}

	user, err := h.userService.UpdateUserStatus(r.Context(), targetID, req.IsActive)
	if err != nil {
		log.Error().Err(err).Str("operation", "UpdateUserStatus").Str("user_id", idStr).Msg("服务调用失败")
		handleUserServiceError(w, err)
		return
	}

	// 记录审计日志
	operatorUUID, _ := uuid.Parse(operatorID)
	action := "disable_user"
	if req.IsActive {
		action = "enable_user"
	}
	_ = h.auditService.LogWithDetail(r.Context(), service.AuditLogEntry{
		UserID:       uuid.NullUUID{UUID: operatorUUID, Valid: true},
		UserName:     middleware.GetUserEmail(r.Context()),
		Action:       action,
		ResourceType: "user",
		ResourceID:   targetID.String(),
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
	log.Info().Int("status", http.StatusOK).Str("user_id", idStr).Bool("is_active", req.IsActive).Msg("请求处理成功")
}
