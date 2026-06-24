import { apiDelete, apiPatch, apiPost, apiPut } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
	BatchAffected,
	BatchUpdateRoleRequest,
	BatchUpdateStatusRequest,
	CreateUserRequest,
	MutationMessageResult,
	UpdateUserRequest,
	UpdateUserRoleRequest,
	UpdateUserStatusRequest,
	UserDetail,
} from "../model/types";
import { adminUserKeys } from "./keys";

/**
 * useCreateUser - 创建用户 mutation
 *
 * 调后端 POST /admin/users，成功后失效列表缓存以拉取新用户。
 *
 * @returns react-query mutation，data 为新建用户详情
 */
export const useCreateUser = () => {
	const qc = useQueryClient();
	return useMutation<UserDetail, Error, CreateUserRequest>({
		mutationFn: (body) => apiPost<UserDetail>("/admin/users", body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: adminUserKeys.lists() });
		},
	});
};

/**
 * useUpdateUser - 编辑用户 mutation
 *
 * 调后端 PUT /admin/users/{id}，成功后失效该用户详情与列表缓存。
 *
 * @param id 目标用户 ID
 * @returns react-query mutation，data 为更新后的用户详情
 */
export const useUpdateUser = (id: string) => {
	const qc = useQueryClient();
	return useMutation<UserDetail, Error, UpdateUserRequest>({
		mutationFn: (body) => apiPut<UserDetail>(`/admin/users/${id}`, body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: adminUserKeys.detail(id) });
			qc.invalidateQueries({ queryKey: adminUserKeys.lists() });
		},
	});
};

/**
 * useDeleteUser - 删除用户 mutation
 *
 * 调后端 DELETE /admin/users/{id}，成功后失效列表缓存。
 *
 * @param id 目标用户 ID
 * @returns react-query mutation，data 为 null
 */
export const useDeleteUser = (id: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => apiDelete<MutationMessageResult>(`/admin/users/${id}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: adminUserKeys.lists() });
			qc.removeQueries({ queryKey: adminUserKeys.detail(id) });
		},
	});
};

/**
 * useUpdateUserRole - 修改用户角色 mutation
 *
 * 调后端 PATCH /admin/users/{id}/role，成功后失效该用户详情与列表缓存。
 *
 * @param id 目标用户 ID
 * @returns react-query mutation，data 为 null
 */
export const useUpdateUserRole = (id: string) => {
	const qc = useQueryClient();
	return useMutation<MutationMessageResult, Error, UpdateUserRoleRequest>({
		mutationFn: (body) => apiPatch<MutationMessageResult>(`/admin/users/${id}/role`, body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: adminUserKeys.detail(id) });
			qc.invalidateQueries({ queryKey: adminUserKeys.lists() });
		},
	});
};

/**
 * useUpdateUserStatus - 启用或禁用用户 mutation
 *
 * 调后端 PATCH /admin/users/{id}/status，成功后失效该用户详情与列表缓存。
 *
 * @param id 目标用户 ID
 * @returns react-query mutation，data 为 null
 */
export const useUpdateUserStatus = (id: string) => {
	const qc = useQueryClient();
	return useMutation<MutationMessageResult, Error, UpdateUserStatusRequest>({
		mutationFn: (body) => apiPatch<MutationMessageResult>(`/admin/users/${id}/status`, body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: adminUserKeys.detail(id) });
			qc.invalidateQueries({ queryKey: adminUserKeys.lists() });
		},
	});
};

/**
 * useBatchUpdateUserStatus - 批量启用或禁用 mutation
 *
 * 调后端 POST /admin/users/batch-status，成功后失效列表缓存。
 *
 * @returns react-query mutation，data 为受影响用户数
 */
export const useBatchUpdateUserStatus = () => {
	const qc = useQueryClient();
	return useMutation<BatchAffected, Error, BatchUpdateStatusRequest>({
		mutationFn: (body) => apiPost<BatchAffected>("/admin/users/batch-status", body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: adminUserKeys.lists() });
		},
	});
};

/**
 * useBatchUpdateUserRole - 批量修改角色 mutation
 *
 * 调后端 POST /admin/users/batch-role，成功后失效列表缓存。
 *
 * @returns react-query mutation，data 为受影响用户数
 */
export const useBatchUpdateUserRole = () => {
	const qc = useQueryClient();
	return useMutation<BatchAffected, Error, BatchUpdateRoleRequest>({
		mutationFn: (body) => apiPost<BatchAffected>("/admin/users/batch-role", body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: adminUserKeys.lists() });
		},
	});
};
