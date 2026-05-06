// Package handler 提供 HTTP 请求处理器，负责接收请求、验证参数、调用服务层并返回响应
package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"

	"blog-api/internal/pkg/response"
	"blog-api/internal/service"
)

// RoleHandler 角色管理接口处理器
type RoleHandler struct {
	roleService *service.RoleService
}

// NewRoleHandler 创建角色管理处理器实例
func NewRoleHandler(roleService *service.RoleService) *RoleHandler {
	return &RoleHandler{
		roleService: roleService,
	}
}

// roleListResponse 角色信息响应
type roleListResponse struct {
	ID          int32  `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	CreatedAt   string `json:"created_at"`
}

// roleDetailResponse 角色及其权限信息响应
type roleDetailResponse struct {
	ID          int32                       `json:"id"`
	Name        string                      `json:"name"`
	Description string                      `json:"description"`
	CreatedAt   string                      `json:"created_at"`
	Permissions []service.PermissionInfo    `json:"permissions"`
}

// ListRoles 获取角色列表
// GET /api/v1/admin/roles
func (h *RoleHandler) ListRoles(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "ListRoles").Msg("处理请求")

	roles, err := h.roleService.ListRoles(r.Context())
	if err != nil {
		log.Error().Err(err).Str("operation", "ListRoles").Msg("服务调用失败")
		response.InternalServerError(w, "查询角色列表失败")
		return
	}

	items := make([]roleListResponse, 0, len(roles))
	for _, role := range roles {
		items = append(items, roleListResponse{
			ID:          role.ID,
			Name:        role.Name,
			Description: role.Description.String,
			CreatedAt:   role.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	response.Success(w, map[string]interface{}{
		"roles": items,
	})
	log.Info().Int("status", http.StatusOK).Int("count", len(items)).Msg("请求处理成功")
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

	if req.Name == "" {
		response.BadRequest(w, "角色名称不能为空")
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
	default:
		response.InternalServerError(w, "服务器内部错误")
	}
}