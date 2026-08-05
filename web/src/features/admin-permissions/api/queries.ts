/**
 * admin-permissions TanStack Query Hooks
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreatePermissionRequest, UpdatePermissionRequest } from "../model/types";
import * as api from "./client";
import { adminPermissionsKeys } from "./keys";

/**
 * useAdminPermissions - 查询权限列表
 */
export const useAdminPermissions = () => {
	return useQuery({
		queryKey: adminPermissionsKeys.list(),
		queryFn: () => api.listPermissions(),
		staleTime: 30 * 60 * 1000, // 30 分钟（权限变化不频繁）
	});
};

/**
 * useCreatePermission - 创建权限 mutation
 */
export const useCreatePermission = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: CreatePermissionRequest) => api.createPermission(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: adminPermissionsKeys.lists() });
			toast.success("权限创建成功");
		},
		onError: (error: Error) => {
			toast.error(`创建权限失败：${error.message}`);
		},
	});
};

/**
 * useUpdatePermission - 更新权限 mutation
 */
export const useUpdatePermission = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: number; data: UpdatePermissionRequest }) =>
			api.updatePermission(id, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: adminPermissionsKeys.lists() });
			toast.success("权限更新成功");
		},
		onError: (error: Error) => {
			toast.error(`更新权限失败：${error.message}`);
		},
	});
};

/**
 * useDeletePermission - 删除权限 mutation
 */
export const useDeletePermission = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: number) => api.deletePermission(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: adminPermissionsKeys.lists() });
			toast.success("权限删除成功");
		},
		onError: (error: Error) => {
			toast.error(`删除权限失败：${error.message}`);
		},
	});
};
