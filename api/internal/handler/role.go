// Package handler 提供 HTTP 请求处理器，负责接收请求、验证参数、调用服务层并返回响应
package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"blog-api/internal/middleware"
	"blog-api/internal/pkg/response"
	"blog-api/internal/service"
)

// RoleHandler 角色管理接口处理器
type RoleHandler struct {
	roleService       *service.RoleService
	permissionService *service.PermissionService
	auditService      *service.AuditService
}

// NewRoleHandler 创建角色管理处理器实例
func NewRoleHandler(roleService *service.RoleService, permissionService *service.PermissionService, auditService *service.AuditService) *RoleHandler {
	return &RoleHandler{
		roleService:       roleService,
		permissionService: permissionService,
		auditService:      auditService,
	}
}

// 辅助函数：获取客户端 IP
func getClientIPFromRequestRole(r *http.Request) string {
	ip := r.Header.Get("X-Forwarded-For")
	if ip != "" {
		return ip
	}
	return r.RemoteAddr
}

// roleListResponse 角色信息响应（含用户数量）
type roleListResponse struct {
	ID          int32  `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	CreatedAt   string `json:"created_at"`
	UserCount   int64  `json:"user_count"`
}

// roleDetailResponse 角色及其权限信息响应
type roleDetailResponse struct {
	ID          int32                    `json:"id"`
	Name        string                   `json:"name"`
	Description string                   `json:"description"`
	CreatedAt   string                   `json:"created_at"`
	Permissions []service.PermissionInfo `json:"permissions"`
}

// ListRoles 获取角色列表
// GET /api/v1/admin/roles
func (h *RoleHandler) ListRoles(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "ListRoles").Msg("处理请求")

	roles, err := h.roleService.ListRolesWithUserCount(r.Context())
	if err != nil {
		log.Error().Err(err).Str("operation", "ListRoles").Msg("服务调用失败")
		response.InternalServerError(w, "查询角色列表失败")
		return
	}

	response.Success(w, map[string]interface{}{
		"roles": roles,
	})
	log.Info().Int("status", http.StatusOK).Int("count", len(roles)).Msg("请求处理成功")
}

// GetAllPermissions 获取所有权限定义
// GET /api/v1/admin/permissions
func (h *RoleHandler) GetAllPermissions(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "GetAllPermissions").Msg("处理请求")

	permissions := h.roleService.GetAllPermissions()

	response.Success(w, map[string]interface{}{
		"permissions": permissions,
	})
	log.Info().Int("status", http.StatusOK).Int("count", len(permissions)).Msg("请求处理成功")
}

// CreateRole 创建角色
// POST /api/v1/admin/roles
func (h *RoleHandler) CreateRole(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "CreateRole").Msg("处理请求")

	var req struct {
		Name        string `json:"name" validate:"required,min=1,max=50"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数解析失败")
		response.BadRequest(w, err.Error())
		return
	}

	// 参数验证
	if req.Name == "" {
		response.BadRequest(w, "角色名称不能为空")
		return
	}
	if len(req.Name) > 50 {
		response.BadRequest(w, "角色名称长度不能超过 50 字符")
		return
	}
	if len(req.Description) > 200 {
		response.BadRequest(w, "角色描述长度不能超过 200 字符")
		return
	}

	role, err := h.roleService.CreateRole(r.Context(), req.Name, req.Description)
	if err != nil {
		log.Error().Err(err).Str("operation", "CreateRole").Msg("服务调用失败")
		handleRoleServiceError(w, err)
		return
	}

	response.Success(w, roleListResponse{
		ID:          role.ID,
		Name:        role.Name,
		Description: role.Description.String,
		CreatedAt:   role.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UserCount:   0,
	})
	log.Info().Int("status", http.StatusOK).Int32("role_id", role.ID).Msg("请求处理成功")
}

// UpdateRole 更新角色
// PATCH /api/v1/admin/roles/{id}
func (h *RoleHandler) UpdateRole(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	log.Info().Str("handler", "UpdateRole").Str("id", idStr).Msg("处理请求")

	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		log.Warn().Err(err).Str("id", idStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_param", "无效的角色 ID")
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数解析失败")
		response.BadRequest(w, err.Error())
		return
	}

	// 参数验证
	if req.Name != "" && len(req.Name) > 50 {
		response.BadRequest(w, "角色名称长度不能超过 50 字符")
		return
	}
	if len(req.Description) > 200 {
		response.BadRequest(w, "角色描述长度不能超过 200 字符")
		return
	}

	role, err := h.roleService.UpdateRole(r.Context(), int32(id), req.Name, req.Description)
	if err != nil {
		log.Error().Err(err).Str("operation", "UpdateRole").Int32("role_id", int32(id)).Msg("服务调用失败")
		handleRoleServiceError(w, err)
		return
	}

	response.Success(w, roleListResponse{
		ID:          role.ID,
		Name:        role.Name,
		Description: role.Description.String,
		CreatedAt:   role.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UserCount:   0,
	})
	log.Info().Int("status", http.StatusOK).Int32("role_id", int32(id)).Msg("请求处理成功")
}

// DeleteRole 删除角色
// DELETE /api/v1/admin/roles/{id}
func (h *RoleHandler) DeleteRole(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	log.Info().Str("handler", "DeleteRole").Str("id", idStr).Msg("处理请求")

	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		log.Warn().Err(err).Str("id", idStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_param", "无效的角色 ID")
		return
	}

	err = h.roleService.DeleteRole(r.Context(), int32(id))
	if err != nil {
		log.Error().Err(err).Str("operation", "DeleteRole").Int32("role_id", int32(id)).Msg("服务调用失败")
		handleRoleServiceError(w, err)
		return
	}

	// 记录审计日志
	operatorID := middleware.GetUserID(r.Context())
	operatorUUID, _ := uuid.Parse(operatorID)
	_ = h.auditService.Log(r.Context(), service.AuditLogEntry{
		UserID:       uuid.NullUUID{UUID: operatorUUID, Valid: true},
		UserName:     middleware.GetUserEmail(r.Context()),
		Action:       "delete_role",
		ResourceType: "role",
		ResourceID:   idStr,
		ResourceName: "",
		IPAddress:    getClientIPFromRequestRole(r),
	})

	response.Success(w, map[string]interface{}{
		"message": "角色删除成功",
	})
	log.Info().Int("status", http.StatusOK).Int32("role_id", int32(id)).Msg("请求处理成功")
}

// GetRolePermissions 获取角色权限
// GET /api/v1/admin/roles/{id}/permissions
func (h *RoleHandler) GetRolePermissions(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	log.Info().Str("handler", "GetRolePermissions").Str("id", idStr).Msg("处理请求")

	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		log.Warn().Err(err).Str("id", idStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_param", "无效的角色 ID")
		return
	}

	result, err := h.roleService.GetRoleWithPermissions(r.Context(), int32(id))
	if err != nil {
		log.Error().Err(err).Str("operation", "GetRolePermissions").Int32("role_id", int32(id)).Msg("服务调用失败")
		handleRoleServiceError(w, err)
		return
	}

	response.Success(w, roleDetailResponse{
		ID:          result.ID,
		Name:        result.Name,
		Description: result.Description,
		CreatedAt:   result.CreatedAt,
		Permissions: result.Permissions,
	})
	log.Info().Int("status", http.StatusOK).Int32("role_id", int32(id)).Msg("请求处理成功")
}

// UpdateRolePermissions 设置角色权限
// PATCH /api/v1/admin/roles/{id}/permissions
func (h *RoleHandler) UpdateRolePermissions(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	log.Info().Str("handler", "UpdateRolePermissions").Str("id", idStr).Msg("处理请求")

	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		log.Warn().Err(err).Str("id", idStr).Msg("参数验证失败")
		response.Error(w, http.StatusBadRequest, "invalid_param", "无效的角色 ID")
		return
	}

	var req struct {
		Permissions []string `json:"permissions"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数解析失败")
		response.BadRequest(w, err.Error())
		return
	}

	err = h.roleService.UpdateRolePermissions(r.Context(), int32(id), req.Permissions)
	if err != nil {
		log.Error().Err(err).Str("operation", "UpdateRolePermissions").Int32("role_id", int32(id)).Msg("服务调用失败")
		handleRoleServiceError(w, err)
		return
	}

	// 记录审计日志
	operatorID := middleware.GetUserID(r.Context())
	operatorUUID, _ := uuid.Parse(operatorID)
	_ = h.auditService.LogWithDetail(r.Context(), service.AuditLogEntry{
		UserID:       uuid.NullUUID{UUID: operatorUUID, Valid: true},
		UserName:     middleware.GetUserEmail(r.Context()),
		Action:       "update_role_permissions",
		ResourceType: "role",
		ResourceID:   idStr,
		ResourceName: "",
		IPAddress:    getClientIPFromRequestRole(r),
	}, map[string]interface{}{
		"permissions": req.Permissions,
	})

	response.Success(w, map[string]interface{}{
		"message": "角色权限更新成功",
	})
	log.Info().Int("status", http.StatusOK).Int32("role_id", int32(id)).Msg("请求处理成功")
}

// handleRoleServiceError 处理角色服务错误
func handleRoleServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, service.ErrRoleNotFound):
		response.Error(w, http.StatusNotFound, "role_not_found", "角色不存在")
	case errors.Is(err, service.ErrRoleNameExists):
		response.Error(w, http.StatusConflict, "role_name_exists", "角色名称已存在")
	case errors.Is(err, service.ErrRoleInUse):
		response.Error(w, http.StatusConflict, "role_in_use", "角色正在被用户使用，无法删除")
	case errors.Is(err, service.ErrInvalidPermission):
		response.Error(w, http.StatusBadRequest, "invalid_permission", err.Error())
	case errors.Is(err, service.ErrCannotModifyBuiltinRole):
		response.Error(w, http.StatusForbidden, "cannot_modify_builtin", "不能修改或删除内置角色")
	case errors.Is(err, service.ErrPermissionAddFailed):
		response.Error(w, http.StatusInternalServerError, "permission_add_failed", err.Error())
	default:
		response.InternalServerError(w, "服务器内部错误")
	}
}
