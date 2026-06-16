// Package role 提供 role/permission 聚合的 HTTP handler（DDD 版）。
//
// 与 internal/handler（旧分层）并存。P2.2d 将路由切换到此 handler，
// 然后删除旧的 role.go / permission.go handler。
package role

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-playground/validator/v10"

	apppermcmd "blog-api/internal/application/permission/command"
	apppermq "blog-api/internal/application/permission/query"
	approle "blog-api/internal/application/role"
	"blog-api/internal/application/role/command"
	"blog-api/internal/application/role/query"
	interfacesmw "blog-api/internal/interfaces/http/middleware"
)

// Handler role/permission HTTP 处理器（DDD 版）
type Handler struct {
	roleQuery  *query.ListRolesWithUserCountHandler
	roleDetail *query.GetRoleWithPermissionsHandler
	roleCreate *command.CreateRoleHandler
	roleUpdate *command.UpdateRoleHandler
	roleDelete *command.DeleteRoleHandler
	rolePerms  *command.ReplaceRolePermissionsHandler

	permList   *apppermq.ListPermissionsHandler
	permCreate *apppermcmd.CreatePermissionHandler
	permUpdate *apppermcmd.UpdatePermissionHandler
	permDelete *apppermcmd.DeletePermissionHandler

	validate *validator.Validate
}

// NewHandler 创建 role/permission HTTP handler
func NewHandler(
	roleQuery *query.ListRolesWithUserCountHandler,
	roleDetail *query.GetRoleWithPermissionsHandler,
	roleCreate *command.CreateRoleHandler,
	roleUpdate *command.UpdateRoleHandler,
	roleDelete *command.DeleteRoleHandler,
	rolePerms *command.ReplaceRolePermissionsHandler,
	permList *apppermq.ListPermissionsHandler,
	permCreate *apppermcmd.CreatePermissionHandler,
	permUpdate *apppermcmd.UpdatePermissionHandler,
	permDelete *apppermcmd.DeletePermissionHandler,
) *Handler {
	return &Handler{
		roleQuery: roleQuery, roleDetail: roleDetail,
		roleCreate: roleCreate, roleUpdate: roleUpdate, roleDelete: roleDelete,
		rolePerms: rolePerms,
		permList:  permList, permCreate: permCreate, permUpdate: permUpdate, permDelete: permDelete,
		validate: validator.New(),
	}
}

// ============================================================
// Role 相关 handler
// ============================================================

// ListRoles 获取角色列表
func (h *Handler) ListRoles(w http.ResponseWriter, r *http.Request) {
	roles, err := h.roleQuery.Handle(r.Context())
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": roles})
}

// GetRole 获取角色详情（含权限）
func (h *Handler) GetRole(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}

	detail, err := h.roleDetail.Handle(r.Context(), query.GetRoleWithPermissionsInput{ID: int32(id)})
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": detail})
}

// CreateRoleRequest 创建角色请求 DTO
type CreateRoleRequest struct {
	Name        string `json:"name" validate:"required,min=2,max=50"`
	Description string `json:"description"`
}

// CreateRole 创建角色
func (h *Handler) CreateRole(w http.ResponseWriter, r *http.Request) {
	var req CreateRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}

	out, err := h.roleCreate.Handle(r.Context(), command.CreateRoleInput{
		Name: req.Name, Description: req.Description,
	})
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": map[string]any{"id": out.ID}})
}

// UpdateRoleRequest 更新角色请求 DTO
type UpdateRoleRequest struct {
	Name        string `json:"name" validate:"omitempty,min=2,max=50"`
	Description string `json:"description"`
}

// UpdateRole 更新角色
func (h *Handler) UpdateRole(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}

	var req UpdateRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}

	if err := h.roleUpdate.Handle(r.Context(), command.UpdateRoleInput{
		ID: int32(id), Name: req.Name, Description: req.Description,
	}); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "角色已更新"})
}

// DeleteRole 删除角色
func (h *Handler) DeleteRole(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}

	if err := h.roleDelete.Handle(r.Context(), command.DeleteRoleInput{ID: int32(id)}); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "角色已删除"})
}

// UpdateRolePermissionsRequest 更新角色权限请求 DTO
type UpdateRolePermissionsRequest struct {
	PermissionCodes []string `json:"permission_codes" validate:"required"`
}

// UpdateRolePermissions 替换角色权限
func (h *Handler) UpdateRolePermissions(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}

	var req UpdateRolePermissionsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}

	if err := h.rolePerms.Handle(r.Context(), command.ReplaceRolePermissionsInput{
		RoleID: int32(id), PermissionCodes: req.PermissionCodes,
	}); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "角色权限已更新"})
}

// ============================================================
// Permission 相关 handler
// ============================================================

// ListPermissions 获取所有权限点
func (h *Handler) ListPermissions(w http.ResponseWriter, r *http.Request) {
	perms, err := h.permList.Handle(r.Context())
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": perms})
}

// CreatePermissionRequest 创建权限请求 DTO
type CreatePermissionRequest struct {
	Code        string `json:"code" validate:"required"`
	Name        string `json:"name" validate:"required"`
	Description string `json:"description"`
}

// CreatePermission 创建权限点
func (h *Handler) CreatePermission(w http.ResponseWriter, r *http.Request) {
	var req CreatePermissionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	if err := h.validate.Struct(req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}

	out, err := h.permCreate.Handle(r.Context(), apppermcmd.CreatePermissionInput{
		Code: req.Code, Name: req.Name, Description: req.Description,
	})
	if err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": map[string]any{"id": out.ID}})
}

// UpdatePermissionRequest 更新权限请求 DTO
type UpdatePermissionRequest struct {
	Name        string `json:"name" validate:"required"`
	Description string `json:"description"`
}

// UpdatePermission 更新权限点
func (h *Handler) UpdatePermission(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")

	var req UpdatePermissionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}

	if err := h.permUpdate.Handle(r.Context(), apppermcmd.UpdatePermissionInput{
		Code: code, Name: req.Name, Description: req.Description,
	}); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "权限已更新"})
}

// DeletePermission 删除权限点
func (h *Handler) DeletePermission(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")

	if err := h.permDelete.Handle(r.Context(), apppermcmd.DeletePermissionInput{Code: code}); err != nil {
		interfacesmw.RespondError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "权限已删除"})
}

// ============================================================
// 辅助
// ============================================================

// writeJSON 写 JSON 响应（与 interfaces/middleware 一致的封装风格）
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// 编译期断言：使用 approle 避免未使用 import
var _ = approle.RoleDTO{}
