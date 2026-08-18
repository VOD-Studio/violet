/**
 * admin-roles API 客户端
 */
import { apiDelete, apiGet, apiGetPaged, apiPost, apiPut } from "@shared/api/request";
import type { PagedResponse, PageQuery } from "@shared/api/types";
import type {
	CreateRoleRequest,
	RoleWithPermissionsDTO,
	UpdateRolePermissionsRequest,
	UpdateRoleRequest,
} from "../model/role-detail-types";
import type { RoleDTO } from "../model/types";

/**
 * 获取角色列表（分页，含 user_count）
 *
 * GET /admin/roles?page=&limit=
 * 需管理员权限。
 */
export const listRoles = async (query: PageQuery): Promise<PagedResponse<RoleDTO>> => {
	return apiGetPaged<RoleDTO>("/admin/roles", { params: query });
};

/**
 * 获取角色详情（含权限列表）
 *
 * GET /admin/roles/{id}
 * 返回角色详情及关联的权限列表。需管理员权限。
 */
export const getRoleDetail = async (id: number): Promise<RoleWithPermissionsDTO> => {
	return apiGet<RoleWithPermissionsDTO>(`/admin/roles/${id}`);
};

/**
 * 创建角色
 *
 * POST /admin/roles
 * 需管理员权限。
 */
export const createRole = async (data: CreateRoleRequest): Promise<RoleDTO> => {
	return apiPost<RoleDTO>("/admin/roles", data);
};

/**
 * 更新角色
 *
 * PUT /admin/roles/{id}
 * 需管理员权限。
 */
export const updateRole = async (id: number, data: UpdateRoleRequest): Promise<RoleDTO> => {
	return apiPut<RoleDTO>(`/admin/roles/${id}`, data);
};

/**
 * 删除角色
 *
 * DELETE /admin/roles/{id}
 * 需管理员权限。
 */
export const deleteRole = async (id: number): Promise<void> => {
	return apiDelete<void>(`/admin/roles/${id}`);
};

/**
 * 设置角色权限
 *
 * PUT /admin/roles/{id}/permissions
 * 设置角色的所有权限。需管理员权限。
 */
export const updateRolePermissions = async (
	id: number,
	data: UpdateRolePermissionsRequest,
): Promise<void> => {
	return apiPut<void>(`/admin/roles/${id}/permissions`, data);
};
