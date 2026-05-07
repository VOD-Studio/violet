// Package handler 提供 HTTP 请求处理器，负责接收请求、验证参数、调用服务层并返回响应
package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"

	"blog-api/internal/pkg/response"
	"blog-api/internal/service"
)

// PermissionHandler 权限管理接口处理器
type PermissionHandler struct {
	permissionService *service.PermissionService
}

// NewPermissionHandler 创建权限管理处理器实例
func NewPermissionHandler(permissionService *service.PermissionService) *PermissionHandler {
	return &PermissionHandler{
		permissionService: permissionService,
	}
}

// permissionResponse 权限信息响应
type permissionResponse struct {
	ID        int32  `json:"id"`
	Code      string `json:"code"`
	Name      string `json:"name"`
	CreatedAt string `json:"created_at"`
}

// CreatePermission 创建权限
// POST /api/v1/admin/permissions
func (h *PermissionHandler) CreatePermission(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("handler", "CreatePermission").Msg("处理请求")

	var req struct {
		Code string `json:"code" validate:"required"`
		Name string `json:"name" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数解析失败")
		response.BadRequest(w, err.Error())
		return
	}

	if req.Code == "" || req.Name == "" {
		response.BadRequest(w, "权限代码和名称不能为空")
		return
	}

	perm, err := h.permissionService.CreatePermission(r.Context(), req.Code, req.Name)
	if err != nil {
		log.Error().Err(err).Str("operation", "CreatePermission").Msg("服务调用失败")
		handlePermissionServiceError(w, err)
		return
	}

	response.Success(w, permissionResponse{
		ID:        perm.ID,
		Code:      perm.Code,
		Name:      perm.Name,
		CreatedAt: perm.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	})
	log.Info().Int("status", http.StatusOK).Int32("permission_id", perm.ID).Msg("请求处理成功")
}

// UpdatePermission 更新权限
// PATCH /api/v1/admin/permissions/{code}
func (h *PermissionHandler) UpdatePermission(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	log.Info().Str("handler", "UpdatePermission").Str("code", code).Msg("处理请求")

	var req struct {
		Name string `json:"name" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Warn().Err(err).Msg("参数解析失败")
		response.BadRequest(w, err.Error())
		return
	}

	if req.Name == "" {
		response.BadRequest(w, "权限名称不能为空")
		return
	}

	perm, err := h.permissionService.UpdatePermission(r.Context(), code, req.Name)
	if err != nil {
		log.Error().Err(err).Str("operation", "UpdatePermission").Str("code", code).Msg("服务调用失败")
		handlePermissionServiceError(w, err)
		return
	}

	response.Success(w, permissionResponse{
		ID:        perm.ID,
		Code:      perm.Code,
		Name:      perm.Name,
		CreatedAt: perm.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	})
	log.Info().Int("status", http.StatusOK).Str("code", code).Msg("请求处理成功")
}

// DeletePermission 删除权限
// DELETE /api/v1/admin/permissions/{code}
func (h *PermissionHandler) DeletePermission(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	log.Info().Str("handler", "DeletePermission").Str("code", code).Msg("处理请求")

	err := h.permissionService.DeletePermission(r.Context(), code)
	if err != nil {
		log.Error().Err(err).Str("operation", "DeletePermission").Str("code", code).Msg("服务调用失败")
		handlePermissionServiceError(w, err)
		return
	}

	response.Success(w, map[string]interface{}{
		"message": "权限删除成功",
	})
	log.Info().Int("status", http.StatusOK).Str("code", code).Msg("请求处理成功")
}

// handlePermissionServiceError 处理权限服务错误
func handlePermissionServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, service.ErrPermissionNotFound):
		response.Error(w, http.StatusNotFound, "permission_not_found", "权限不存在")
	case errors.Is(err, service.ErrPermissionCodeExists):
		response.Error(w, http.StatusConflict, "permission_code_exists", "权限代码已存在")
	case errors.Is(err, service.ErrPermissionInUse):
		response.Error(w, http.StatusConflict, "permission_in_use", "权限正在被角色使用，无法删除")
	case errors.Is(err, service.ErrInvalidPermissionCode):
		response.Error(w, http.StatusBadRequest, "invalid_permission_code", err.Error())
	case errors.Is(err, service.ErrPermissionCodeTooLong):
		response.Error(w, http.StatusBadRequest, "permission_code_too_long", err.Error())
	default:
		response.InternalServerError(w, "服务器内部错误")
	}
}