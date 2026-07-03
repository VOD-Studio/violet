/**
 * admin-roles TanStack Query Hooks
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
    CreateRoleRequest,
    UpdateRolePermissionsRequest,
    UpdateRoleRequest,
} from "../model/role-detail-types";
import * as api from "./client";
import { adminRolesKeys } from "./keys";

/**
 * useAdminRoles - 查询角色列表
 */
export const useAdminRoles = () => {
    return useQuery({
        queryKey: adminRolesKeys.list(),
        queryFn: () => api.listRoles(),
        staleTime: 30 * 60 * 1000, // 30 分钟（角色变化不频繁）
    });
};

/**
 * useRoleDetail - 查询角色详情（含权限列表）
 */
export const useRoleDetail = (id: number) => {
    return useQuery({
        queryKey: adminRolesKeys.detail(id),
        queryFn: () => api.getRoleDetail(id),
        staleTime: 5 * 60 * 1000, // 5 分钟
    });
};

/**
 * useCreateRole - 创建角色 mutation
 */
export const useCreateRole = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateRoleRequest) => api.createRole(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: adminRolesKeys.lists() });
            toast.success("角色创建成功");
        },
        onError: (error: Error) => {
            toast.error(`创建角色失败：${error.message}`);
        },
    });
};

/**
 * useUpdateRole - 更新角色 mutation
 */
export const useUpdateRole = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateRoleRequest }) =>
            api.updateRole(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: adminRolesKeys.lists() });
            queryClient.invalidateQueries({ queryKey: adminRolesKeys.detail(variables.id) });
            toast.success("角色更新成功");
        },
        onError: (error: Error) => {
            toast.error(`更新角色失败：${error.message}`);
        },
    });
};

/**
 * useDeleteRole - 删除角色 mutation
 */
export const useDeleteRole = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => api.deleteRole(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: adminRolesKeys.lists() });
            toast.success("角色删除成功");
        },
        onError: (error: Error) => {
            toast.error(`删除角色失败：${error.message}`);
        },
    });
};

/**
 * useUpdateRolePermissions - 设置角色权限 mutation
 */
export const useUpdateRolePermissions = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateRolePermissionsRequest }) =>
            api.updateRolePermissions(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: adminRolesKeys.detail(variables.id) });
            toast.success("角色权限更新成功");
        },
        onError: (error: Error) => {
            toast.error(`更新角色权限失败：${error.message}`);
        },
    });
};
