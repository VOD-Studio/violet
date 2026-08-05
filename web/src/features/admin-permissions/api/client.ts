/**
 * admin-permissions API 客户端
 */
import { apiDelete, apiGet, apiPatch, apiPost } from "@/shared/api/request";
import type {
	CreatePermissionRequest,
	PermissionDTO,
	UpdatePermissionRequest,
} from "../model/types";

/**
 * 获取所有权限列表
 *
 * GET /admin/permissions
 * 需要管理员权限
 */
export const listPermissions = async (): Promise<PermissionDTO[]> => {
	return apiGet<PermissionDTO[]>("/admin/permissions");
};

/**
 * 创建权限
 *
 * POST /admin/permissions
 * 需要超级管理员权限
 */
export const createPermission = async (data: CreatePermissionRequest): Promise<PermissionDTO> => {
	return apiPost<PermissionDTO>("/admin/permissions", data);
};

/**
 * 更新权限
 *
 * PATCH /admin/permissions/{id}
 * 需要超级管理员权限
 */
export const updatePermission = async (
	id: number,
	data: UpdatePermissionRequest,
): Promise<PermissionDTO> => {
	return apiPatch<PermissionDTO>(`/admin/permissions/${id}`, data);
};

/**
 * 删除权限
 *
 * DELETE /admin/permissions/{id}
 * 需要超级管理员权限
 */
export const deletePermission = async (id: number): Promise<void> => {
	return apiDelete<void>(`/admin/permissions/${id}`);
};
