/**
 * admin-users TanStack Query Hooks
 *
 * 封装用户管理的查询和变更操作
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "./client";
import { adminUsersKeys } from "./keys";
import type {
    BatchUpdateRoleRequest,
    BatchUpdateStatusRequest,
    CreateUserRequest,
    ListUsersRequest,
    UpdateUserRequest,
    UpdateUserRoleRequest,
    UpdateUserStatusRequest,
} from "../model/types";

/**
 * useAdminUsers - 查询用户列表
 */
export const useAdminUsers = (params: ListUsersRequest) => {
    return useQuery({
        queryKey: adminUsersKeys.list(params),
        queryFn: () => api.listUsers(params),
        staleTime: 5 * 60 * 1000, // 5 分钟
    });
};

/**
 * useAdminUser - 查询单个用户详情
 */
export const useAdminUser = (id: string) => {
    return useQuery({
        queryKey: adminUsersKeys.detail(id),
        queryFn: () => api.getUserDetail(id),
        enabled: !!id,
    });
};

/**
 * useCreateUser - 创建用户
 */
export const useCreateUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateUserRequest) => api.createUser(data),
        onSuccess: () => {
            // 使列表缓存失效，触发重新获取
            queryClient.invalidateQueries({ queryKey: adminUsersKeys.lists() });
            toast.success("用户创建成功");
        },
        onError: (error: Error) => {
            toast.error(`创建用户失败: ${error.message}`);
        },
    });
};

/**
 * useUpdateUser - 更新用户
 */
export const useUpdateUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) =>
            api.updateUser(id, data),
        onSuccess: (_, variables) => {
            // 使列表和该用户详情缓存失效
            queryClient.invalidateQueries({ queryKey: adminUsersKeys.lists() });
            queryClient.invalidateQueries({ queryKey: adminUsersKeys.detail(variables.id) });
            toast.success("用户更新成功");
        },
        onError: (error: Error) => {
            toast.error(`更新用户失败: ${error.message}`);
        },
    });
};

/**
 * useDeleteUser - 删除用户
 */
export const useDeleteUser = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => api.deleteUser(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: adminUsersKeys.lists() });
            toast.success("用户删除成功");
        },
        onError: (error: Error) => {
            toast.error(`删除用户失败: ${error.message}`);
        },
    });
};

/**
 * useUpdateUserRole - 更新用户角色
 */
export const useUpdateUserRole = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateUserRoleRequest }) =>
            api.updateUserRole(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: adminUsersKeys.lists() });
            queryClient.invalidateQueries({ queryKey: adminUsersKeys.detail(variables.id) });
            toast.success("用户角色更新成功");
        },
        onError: (error: Error) => {
            toast.error(`更新角色失败: ${error.message}`);
        },
    });
};

/**
 * useUpdateUserStatus - 更新用户状态
 */
export const useUpdateUserStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateUserStatusRequest }) =>
            api.updateUserStatus(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: adminUsersKeys.lists() });
            queryClient.invalidateQueries({ queryKey: adminUsersKeys.detail(variables.id) });
            toast.success("用户状态更新成功");
        },
        onError: (error: Error) => {
            toast.error(`更新状态失败: ${error.message}`);
        },
    });
};

/**
 * useBatchUpdateStatus - 批量启用/禁用用户
 */
export const useBatchUpdateStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: BatchUpdateStatusRequest) => api.batchUpdateStatus(data),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: adminUsersKeys.lists() });
            toast.success(`已更新 ${result.affected} 个用户的状态`);
        },
        onError: (error: Error) => {
            toast.error(`批量更新失败: ${error.message}`);
        },
    });
};

/**
 * useBatchUpdateRole - 批量修改用户角色
 */
export const useBatchUpdateRole = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: BatchUpdateRoleRequest) => api.batchUpdateRole(data),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: adminUsersKeys.lists() });
            toast.success(`已更新 ${result.affected} 个用户的角色`);
        },
        onError: (error: Error) => {
            toast.error(`批量更新失败: ${error.message}`);
        },
    });
};
