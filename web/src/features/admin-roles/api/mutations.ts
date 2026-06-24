import { apiDelete, apiPatch, apiPost } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
	CreatePermission,
	CreateRole,
	UpdatePermission,
	UpdateRole,
	UpdateRolePermissions,
} from "../model/types";
import { roleKeys } from "./keys";

/**
 * useCreateRole - 创建角色 mutation
 *
 * 对接 POST /admin/roles，成功后 invalidate 角色列表使缓存自动刷新。
 */
export const useCreateRole = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: CreateRole) => apiPost<{ id: number }>("/admin/roles", body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
		},
	});
};

/**
 * useUpdateRole - 更新角色 mutation
 *
 * 对接 PATCH /admin/roles/{id}，后端返回消息信封 data 为 null。
 * 成功后 invalidate 角色列表与该角色详情。
 *
 * @param id 角色 ID
 */
export const useUpdateRole = (id: number) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: UpdateRole) => apiPatch<null>(`/admin/roles/${id}`, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
			queryClient.invalidateQueries({ queryKey: roleKeys.detail(id) });
		},
	});
};

/**
 * useDeleteRole - 删除角色 mutation
 *
 * 对接 DELETE /admin/roles/{id}，后端返回消息信封 data 为 null。
 *
 * @param id 角色 ID
 */
export const useDeleteRole = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: number) => apiDelete<null>(`/admin/roles/${id}`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
		},
	});
};

/**
 * useUpdateRolePermissions - 设置角色权限 mutation
 *
 * 对接 PATCH /admin/roles/{id}/permissions，整体替换该角色的权限集合。
 * 成功后 invalidate 角色列表、该角色详情以及权限点列表。
 *
 * @param id 角色 ID
 */
export const useUpdateRolePermissions = (id: number) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: UpdateRolePermissions) =>
			apiPatch<null>(`/admin/roles/${id}/permissions`, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
			queryClient.invalidateQueries({ queryKey: roleKeys.detail(id) });
		},
	});
};

/**
 * useCreatePermission - 创建权限 mutation
 *
 * 对接 POST /admin/permissions，仅超级管理员可调用。成功后 invalidate 权限点列表。
 */
export const useCreatePermission = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: CreatePermission) => apiPost<{ id: number }>("/admin/permissions", body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: roleKeys.permissions() });
		},
	});
};

/**
 * useUpdatePermission - 更新权限 mutation
 *
 * 对接 PATCH /admin/permissions/{code}，path param 为 code 而非数字 id。
 * 成功后 invalidate 权限点列表与角色列表，后者可能携带 permission_codes。
 *
 * @param code 权限 code
 */
export const useUpdatePermission = (code: string) => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: UpdatePermission) => apiPatch<null>(`/admin/permissions/${code}`, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: roleKeys.permissions() });
			queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
			queryClient.invalidateQueries({ queryKey: roleKeys.details() });
		},
	});
};

/**
 * useDeletePermission - 删除权限 mutation
 *
 * 对接 DELETE /admin/permissions/{code}，path param 为 code。
 * 成功后 invalidate 权限点列表与角色相关缓存。
 *
 * @param code 权限 code
 */
export const useDeletePermission = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (code: string) => apiDelete<null>(`/admin/permissions/${code}`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: roleKeys.permissions() });
			queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
			queryClient.invalidateQueries({ queryKey: roleKeys.details() });
		},
	});
};
